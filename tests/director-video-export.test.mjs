import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCanvasVideo } from '../director-video-export.mjs';
import A from '../director-animation.js';

// Model an encoder that buffers frames until finalize and an independent container reader.
function encoderFixture({ supported = ['avc'], dropLast = false, drift = 0, failAdd = false, millisecondTimestamps = false } = {}) {
  const state = { samples: [], rendered: [], flushed: false, canceled: 0, disposed: 0, pending: 0, maxPending: 0, probes: [] };
  const media = {
    Quality: class { constructor(options) { Object.assign(this, options); } },
    canEncodeVideo: async (codec, options) => { state.probes.push({ codec, options }); return supported.includes(codec); },
    BufferTarget: class {}, Mp4OutputFormat: class {}, WebMOutputFormat: class {},
    Output: class {
      constructor({ target }) { this.target = target; this.state = 'pending'; }
      addVideoTrack(source, metadata) { state.metadata = metadata; assert.equal(source.config.latencyMode, 'quality'); }
      async start() { this.state = 'started'; }
      async finalize() { state.flushed = true; this.target.buffer = new Uint8Array([1, 2, 3]); this.state = 'finalized'; }
      async cancel() { state.canceled++; this.state = 'canceled'; }
    },
    CanvasSource: class {
      constructor(canvas, config) { this.config = config; }
      async add(timestamp, duration) {
        if (failAdd) throw new Error('encoder failed');
        state.maxPending = Math.max(state.maxPending, ++state.pending);
        await new Promise(resolve => setTimeout(resolve, 1));
        state.samples.push({ timestamp, duration }); state.pending--;
      }
      close() {}
    },
    Input: class {
      async getPrimaryVideoTrack() { assert.equal(state.flushed, true); return { computeDuration: async () => state.samples.at(-1).timestamp + state.samples.at(-1).duration + drift }; }
      async getDurationFromMetadata() { return state.samples.at(-1).timestamp + state.samples.at(-1).duration + drift; }
      dispose() { state.disposed++; }
    }, BlobSource: class {}, ALL_FORMATS: [],
    EncodedPacketSink: class { async *packets() {
      for (const packet of (dropLast ? state.samples.slice(0, -1) : state.samples)) {
        yield millisecondTimestamps ? { ...packet, timestamp: Math.round(packet.timestamp * 1000) / 1000 } : packet;
      }
    } },
  };
  return { state, options: { canvas: { width: 1280, height: 720 }, mediaLoader: async () => media,
    renderFrame: frame => state.rendered.push(frame), yieldControl: async () => {} } };
}

test('an explicitly selected export format is honored instead of silently changing containers',async()=>{
 const plan=A.exportPlan({fps:24,durationFrames:2},[0,1],30);
 const webm=encoderFixture({supported:['avc','vp9']});
 const result=await encodeCanvasVideo({...webm.options,plan,requestedFormat:'webm'});
 assert.equal(result.extension,'.webm');assert.equal(webm.state.probes[0].codec,'vp9');
 const mp4=encoderFixture({supported:['vp9']});
 await assert.rejects(encodeCanvasVideo({...mp4.options,plan,requestedFormat:'mp4'}),/请选择|请选择/);
 assert.equal(mp4.state.rendered.length,0);assert.deepEqual(mp4.state.probes.map(p=>p.codec),['avc']);
});

test('offline export keeps all 30/60 fps frames and timestamps regardless of delayed encoding', async () => {
  for (const rate of [30, 60]) {
    const { state, options } = encoderFixture();
    const plan = A.exportPlan({ fps: 24, durationFrames: 240 }, [24, 71], rate);
    const result = await encodeCanvasVideo({ ...options, plan });
    assert.equal(result.frameCount, 2 * rate); assert.equal(result.duration, 2); assert.equal(result.extension, '.mp4');
    assert.equal(state.rendered[0], 24); assert.equal(state.rendered.at(-1), plan.frameAt(plan.count - 1));
    assert.equal(state.samples[1].timestamp, 1 / rate); assert.equal(state.maxPending, 1);
    assert.equal(state.disposed, 1); assert.equal(state.canceled, 0);
    assert.equal(state.probes[0].options.frameRate, rate);
    assert.deepEqual(state.metadata, { frameRate: rate });
  }
});

test('a partial final frame ends at the exact inclusive work-area boundary', async () => {
  const { state, options } = encoderFixture();
  const plan = A.exportPlan({ fps: 24, durationFrames: 24 }, [5, 5], 30);
  const result = await encodeCanvasVideo({ ...options, plan });
  assert.equal(result.frameCount, 2); assert.equal(result.duration, 1 / 24);
  assert.equal(state.samples.at(-1).duration, 1 / 24 - 1 / 30);
  assert.equal(state.metadata, undefined);
});

test('unsupported AVC uses offline WebM and still verifies its frame count and duration', async () => {
  const { state, options } = encoderFixture({ supported: ['vp9'], millisecondTimestamps: true });
  const result = await encodeCanvasVideo({ ...options, plan: A.exportPlan({ fps: 24, durationFrames: 24 }, [0, 11], 60) });
  assert.deepEqual(state.probes.map(p => p.codec), ['avc', 'vp9']);
  assert.equal(result.extension, '.webm'); assert.equal(result.blob.type, 'video/webm'); assert.equal(result.frameCount, 30);
});

test('cancellation drains/releases encoding resources and never returns a partial file', async () => {
  const { state, options } = encoderFixture();
  await assert.rejects(encodeCanvasVideo({ ...options, plan: A.exportPlan({ fps: 24, durationFrames: 24 }, [0, 11], 60), isCancelled: () => state.samples.length >= 3 }), { name: 'AbortError' });
  assert.equal(state.canceled, 1); assert.equal(state.flushed, false); assert.equal(state.samples.length, 3);
});

test('an encoder failure cancels and frees resources', async () => {
  const { state, options } = encoderFixture({ failAdd: true });
  await assert.rejects(encodeCanvasVideo({ ...options, plan: A.exportPlan({ fps: 24, durationFrames: 24 }, [0, 11], 60) }), /encoder failed/);
  assert.equal(state.canceled, 1);
});

test('container verification rejects dropped frames and incorrect duration before saving', async () => {
  for (const scenario of [{ dropLast: true }, { drift: .2 }]) {
    const { state, options } = encoderFixture(scenario);
    await assert.rejects(encodeCanvasVideo({ ...options, plan: A.exportPlan({ fps: 24, durationFrames: 24 }, [0, 11], 60) }), /校验失败/);
    assert.equal(state.disposed, 1);
  }
});
