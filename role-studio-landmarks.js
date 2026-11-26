/* Classic worker: MediaPipe's local WebAssembly loader uses importScripts. */
const local = new URL('vendor/role-vision/', self.location.href);
const files = {
  wasmLoaderPath: new URL('wasm/vision_wasm_internal.js', local).href,
  wasmBinaryPath: new URL('wasm/vision_wasm_internal.wasm', local).href,
};
const detectors = {};
async function detect(kind, input) {
  const {FaceLandmarker, PoseLandmarker} = await import(new URL('vision_bundle.mjs', local).href);
  if (!detectors[kind]) {
    const facial = kind === 'face';
    const Task = facial ? FaceLandmarker : PoseLandmarker;
    detectors[kind] = await Task.createFromOptions(files, {
      baseOptions: {modelAssetPath: new URL(facial ? 'face.bin' : 'pose-lite.bin', local).href, delegate: 'CPU'},
      runningMode: 'IMAGE',
      ...(facial ? {numFaces: 2} : {numPoses: 2}),
    });
  }
  const result = detectors[kind].detect(input);
  return kind === 'face' ? result.faceLandmarks : result.landmarks;
}

// The short-range face detector also works on a close crop of a distant, single subject.
async function faceFromPose(image, pose) {
  const nose = pose[0], left = pose[11], right = pose[12];
  if ([nose, left, right].some(p => !p || p.visibility < .55)) return [];
  const {width, height} = image;
  const span = Math.hypot((left.x-right.x)*width, (left.y-right.y)*height);
  const earSpan = Math.hypot((pose[7].x-pose[8].x)*width, (pose[7].y-pose[8].y)*height);
  const size = Math.round(Math.max(span * 1.2, earSpan * 2.8));
  if (size < 26 || size > Math.max(width, height)) return [];
  const x = Math.round(nose.x*width - size/2), y = Math.round(nose.y*height - size*.5);
  const crop = new OffscreenCanvas(384, 384);
  crop.getContext('2d').drawImage(image, x, y, size, size, 0, 0, 384, 384);
  const result = await detect('face', crop);
  return result.map(face => face.map(p => ({x:(p.x*size+x)/width, y:(p.y*size+y)/height, z:p.z*size/width})));
}

let queue = Promise.resolve();
self.onmessage = ({data: {id, image, body}}) => {
  queue = queue.then(async () => {
    try {
      let faces = await detect('face', image);
      const poses = body || !faces.length ? await detect('body', image) : [];
      if (!faces.length && poses.length === 1) faces = await faceFromPose(image, poses[0]);
      self.postMessage({id, result: {faces, poses}});
    } catch (error) {
      self.postMessage({id, error: String(error?.message || error)});
    } finally {
      image.close();
    }
  });
};
