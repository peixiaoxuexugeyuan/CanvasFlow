// U²-Net small uses a fixed 320 × 320 ImageNet-normalized input.
const size = 320;
const area = size * size;
let enginePromise;

async function engine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const ort = await import('./ort.wasm.min.mjs');
      ort.env.wasm.wasmPaths = new URL('./', import.meta.url).href;
      ort.env.wasm.numThreads = 1;
      const model = new URL('./u2netp.bin', import.meta.url).href;
      const session = await ort.InferenceSession.create(model, {executionProviders: ['wasm']});
      return {ort, session};
    })().catch(error => { enginePromise = null; throw error; });
  }
  return enginePromise;
}

function flood(mask, seeds) {
  const visited = new Uint8Array(area);
  const queue = new Int32Array(area);
  let read = 0, write = 0;
  const visit = p => {
    if (!visited[p] && mask[p]) { visited[p] = 1; queue[write++] = p; }
  };
  for (const p of seeds) visit(p);
  while (read < write) {
    const p = queue[read++], x = p % size;
    if (x) visit(p - 1);
    if (x + 1 < size) visit(p + 1);
    if (p >= size) visit(p - size);
    if (p + size < area) visit(p + size);
  }
  return visited;
}

const border = [];
for (let i = 0; i < size; i++) {
  border.push(i, area - size + i);
  if (i && i < size - 1) border.push(i * size, (i + 1) * size - 1);
}

function hasTransparentBackground(data) {
  // A PNG with a pinhole, transparent padding, or rounded corners can still
  // contain an entire opaque scene. Look for clear space extending inward
  // from the perimeter and away from just those corners.
  if (!border.some(p => data[p * 4 + 3] <= 48)) return false;
  const transparent = new Uint8Array(area);
  for (let p = 0; p < area; p++) transparent[p] = data[p * 4 + 3] <= 48;
  const exterior = flood(transparent, border);
  let clear = 0, inner = 0;
  for (let y = 10; y < size - 10; y++) {
    for (let x = 10; x < size - 10; x++) {
      if (!exterior[y * size + x]) continue;
      clear++;
      if ((x > size / 5 && x < size * 4 / 5) || (y > size / 5 && y < size * 4 / 5)) inner++;
    }
  }
  return clear > area * 0.015 && inner > area * 0.005;
}

function contentBounds(pixels, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  return right < left ? null : {left, top, width:right-left+1, height:bottom-top+1};
}

function recoverStudioDetails(source, mask) {
  // On an evenly lit studio background the semantic mask can miss animal
  // ears or unusual costume silhouettes. Expand only through contrasting
  // colors connected to the predicted subject, leaving detached props alone.
  const opaqueEdges = border.filter(p => source[p * 4 + 3] >= 240);
  if (opaqueEdges.length < border.length / 2) return;
  const color = [0, 1, 2].map(ch => {
    const channel = opaqueEdges.map(p => source[p * 4 + ch]).sort((a,b) => a-b);
    return channel[Math.floor(channel.length / 2)];
  });
  const distance = p => Math.max(
    Math.abs(color[0] - source[p * 4]), Math.abs(color[1] - source[p * 4 + 1]),
    Math.abs(color[2] - source[p * 4 + 2])
  );
  if (opaqueEdges.filter(p => distance(p) <= 20).length < opaqueEdges.length * 0.55) return;
  const contrast = new Uint8Array(area);
  const traversable = new Uint8Array(area);
  const seeds = [];
  let background = 0, nearBackdrop = 0;
  for (let p = 0; p < area; p++) {
    if (source[p * 4 + 3] < 200) continue;
    const d = distance(p);
    if (mask[p] < 20) { background++; if (d <= 28) nearBackdrop++; }
    contrast[p] = Math.min(255, Math.max(0, (d - 25) * 8));
    traversable[p] = contrast[p] > 0 || mask[p] >= 128;
    if (mask[p] >= 128) seeds.push(p);
  }
  if (background < area * 0.07 || nearBackdrop < background * 0.82) return;
  const connected = flood(traversable, seeds);
  for (let p = 0; p < area; p++) {
    if (connected[p]) mask[p] = Math.max(mask[p], contrast[p]);
  }
}

async function predict(source) {
  const {ort, session} = await engine();
  let peak = 1;
  for (let i = 0; i < source.length; i += 4) {
    peak = Math.max(peak, source[i], source[i + 1], source[i + 2]);
  }
  const planes = new Float32Array(3 * area);
  for (let p = 0; p < area; p++) {
    planes[p] = (source[p * 4] / peak - 0.485) / 0.229;
    planes[area + p] = (source[p * 4 + 1] / peak - 0.456) / 0.224;
    planes[2 * area + p] = (source[p * 4 + 2] / peak - 0.406) / 0.225;
  }
  const input = new ort.Tensor('float32', planes, [1, 3, size, size]);
  const name = session.outputNames[0];
  let output;
  try {
    output = (await session.run({[session.inputNames[0]]: input}, [name]))[name];
    const values = output.data;
    let min = Infinity, max = -Infinity;
    for (const v of values) { min = Math.min(min, v); max = Math.max(max, v); }
    if (!(max - min > 0.02)) throw new Error('未能识别图中的角色主体');
    const mask = new Uint8ClampedArray(area);
    for (let i = 0; i < area; i++) mask[i] = ((values[i] - min) / (max - min) - 0.015) * (255 / 0.97);
    return mask;
  } finally {
    output?.dispose();
    input.dispose();
  }
}

// Joint bilateral upsampling. At a silhouette, weight the nearby mask samples
// by the high-resolution source color so fine contours follow the actual image.
function applyMask(pixels, width, height, guide, mask) {
  const x0 = new Int32Array(width);
  const tx = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const pos = Math.max(0, Math.min(size - 1, (x + 0.5) * size / width - 0.5));
    x0[x] = Math.floor(pos);
    tx[x] = pos - x0[x];
  }
  const weights = new Float32Array(4), indices = new Int32Array(4);
  for (let y = 0; y < height; y++) {
    const pos = Math.max(0, Math.min(size - 1, (y + 0.5) * size / height - 0.5));
    const top = Math.floor(pos), fy = pos - top, bottom = Math.min(top + 1, size - 1);
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4, left = x0[x], right = Math.min(left + 1, size - 1);
      indices[0] = top * size + left; indices[1] = top * size + right;
      indices[2] = bottom * size + left; indices[3] = bottom * size + right;
      let alpha = mask[indices[0]];
      if (alpha !== mask[indices[1]] || alpha !== mask[indices[2]] || alpha !== mask[indices[3]]) {
        const fx = tx[x];
        weights[0] = (1 - fx) * (1 - fy); weights[1] = fx * (1 - fy);
        weights[2] = (1 - fx) * fy; weights[3] = fx * fy;
        let sum = 0, total = 0;
        for (let k = 0; k < 4; k++) {
          const sample = indices[k] * 4;
          const dr = pixels[at] - guide[sample], dg = pixels[at + 1] - guide[sample + 1], db = pixels[at + 2] - guide[sample + 2];
          const weight = weights[k] / (300 + dr * dr + dg * dg + db * db);
          sum += weight * mask[indices[k]];
          total += weight;
        }
        alpha = sum / total;
      }
      pixels[at + 3] = pixels[at + 3] * alpha / 255;
    }
  }
}

async function cutout(bitmap) {
  const {width, height} = bitmap;
  const output = new OffscreenCanvas(width, height);
  const context = output.getContext('2d', {willReadFrequently:true});
  context.drawImage(bitmap, 0, 0);
  const frame = context.getImageData(0, 0, width, height);
  const bounds = contentBounds(frame.data, width, height);
  if (!bounds) return output.convertToBlob({type:'image/png'});
  const thumb = new OffscreenCanvas(size, size);
  const small = thumb.getContext('2d', {willReadFrequently:true});
  small.imageSmoothingQuality = 'high';
  // A transparent outer frame tells us nothing about the backdrop inside it.
  small.drawImage(bitmap, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, size, size);
  const guide = small.getImageData(0, 0, size, size).data;
  if (!hasTransparentBackground(guide)) {
    const mask = await predict(guide);
    recoverStudioDetails(guide, mask);
    const region = bounds.width === width && bounds.height === height ? frame
      : context.getImageData(bounds.left, bounds.top, bounds.width, bounds.height);
    applyMask(region.data, bounds.width, bounds.height, guide, mask);
    context.putImageData(region, bounds.left, bounds.top);
  }
  return output.convertToBlob({type:'image/png'});
}

let tail = Promise.resolve();
const queued = new Map();
self.onmessage = ({data}) => {
  if (data.cancel !== undefined) {
    queued.get(data.cancel)?.close();
    queued.delete(data.cancel);
    return;
  }
  queued.set(data.id, data.bitmap);
  tail = tail.then(async () => {
    const bitmap = queued.get(data.id);
    if (!bitmap) return;
    queued.delete(data.id);
    try { self.postMessage({id: data.id, blob: await cutout(bitmap)}); }
    catch (error) { self.postMessage({id: data.id, error: error.message || '角色抠图失败'}); }
    finally { bitmap.close(); }
  });
};
