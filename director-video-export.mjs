// Offline canvas export: animation time, not browser paint/capture time, defines every frame.
const loadMedia = () => import('./vendor/mediabunny/dist/bundles/mediabunny.min.mjs');
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
const cancelledError = () => Object.assign(new Error('已取消导出'), { name: 'AbortError' });

export async function encodeCanvasVideo({ canvas, plan, renderFrame, isCancelled = () => false,
  onProgress = () => {}, fallbackWebm = false, requestedFormat = 'auto', mediaLoader = loadMedia, yieldControl = yieldTask }) {
  const checkCancelled = () => { if (isCancelled()) throw cancelledError(); };
  checkCancelled();
  const m = await mediaLoader();
  checkCancelled();
  const quality = new m.Quality({ bitrate: 8000000 });
  let codec;
  for (const candidate of (requestedFormat==='mp4' ? ['avc'] : fallbackWebm||requestedFormat==='webm' ? ['vp9', 'vp8'] : ['avc', 'vp9', 'vp8'])) {
    if (await m.canEncodeVideo(candidate, { width: canvas.width, height: canvas.height,
      frameRate: plan.rate, quality, latencyMode: 'quality' })) { codec = candidate; break; }
    checkCancelled();
  }
  checkCancelled();
  if (!codec) throw new Error(requestedFormat==='mp4'?'此浏览器不支持 MP4 编码，请选择 WebM 格式':'此浏览器不支持逐帧视频编码，请使用支持 WebCodecs 的浏览器');
  const mp4 = codec === 'avc', target = new m.BufferTarget();
  const output = new m.Output({ target, format: mp4 ? new m.Mp4OutputFormat({ fastStart: 'in-memory' }) : new m.WebMOutputFormat() });
  try {
    const source = new m.CanvasSource(canvas, { codec, quality, latencyMode: 'quality' });
    // Constant frame-rate metadata supplies WebM's DefaultDuration. Omit it for a partial tail,
    // since snapping that tail to a whole frame would change the work-area duration.
    const fullFrames = Math.abs(plan.seconds * plan.rate - plan.count) < 0.0000001;
    output.addVideoTrack(source, fullFrames ? { frameRate: plan.rate } : undefined);
    await output.start();
    for (let i = 0; i < plan.count; i++) {
      checkCancelled();
      await renderFrame(plan.frameAt(i));
      checkCancelled();
      const timestamp = i / plan.rate;
      await source.add(timestamp, Math.min(1 / plan.rate, plan.seconds - timestamp));
      onProgress(i + 1, plan.count);
      // Let cancel/UI events run; encoding speed and tab visibility never change media timestamps.
      if ((i + 1) % 8 === 0) await yieldControl();
    }
    checkCancelled();
    source.close();
    await output.finalize(); // Flush all delayed encoder frames before inspecting/saving the file.
    checkCancelled();
    const blob = new Blob([target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' });
    if (!blob.size) throw new Error('编码没有生成视频');
    const validation = await validateVideo(m, blob, plan, checkCancelled);
    return { blob, extension: mp4 ? '.mp4' : '.webm', ...validation };
  } finally {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
  }
}

async function validateVideo(m, blob, plan, checkCancelled) {
  const input = new m.Input({ formats: m.ALL_FORMATS, source: new m.BlobSource(blob) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('导出文件缺少视频轨道');
    let count = 0;
    // WebM stores timestamps in milliseconds; MP4 retains the finer video timebase.
    const seen = new Set(), tolerance = blob.type === 'video/webm' ? 0.00101 : 0.00001;
    for await (const packet of new m.EncodedPacketSink(track).packets(undefined, undefined, { metadataOnly: true })) {
      checkCancelled();
      const index = Math.round(packet.timestamp * plan.rate), timestamp = index / plan.rate;
      if (index < 0 || index >= plan.count || seen.has(index) || Math.abs(packet.timestamp - timestamp) > tolerance) {
        throw new Error('导出视频的帧时间戳异常');
      }
      seen.add(index); count++;
    }
    // WebM SimpleBlocks omit per-packet durations; the muxer's Segment duration includes
    // the final frame (including a shortened tail). MP4 stores that duration in its sample table.
    const duration = blob.type === 'video/webm' ? await input.getDurationFromMetadata() : await track.computeDuration();
    if (!Number.isFinite(duration)) throw new Error('导出文件缺少视频时长');
    if (count !== plan.count || Math.abs(duration - plan.seconds) > tolerance) {
      throw new Error('导出视频校验失败：实际 ' + count + ' 帧 / ' + duration.toFixed(6) + ' 秒，预期 ' + plan.count + ' 帧 / ' + plan.seconds.toFixed(6) + ' 秒');
    }
    checkCancelled();
    return { duration, frameCount: count };
  } finally { input.dispose(); }
}
