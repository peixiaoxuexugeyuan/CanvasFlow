(() => {
  'use strict';

  const workerUrl = new URL('vendor/role-cutout/cutout-worker.mjs', document.currentScript.src);
  let worker;
  let idleTimer;
  let nextId = 0;
  const pending = new Map();

  function releaseWorker() {
    clearTimeout(idleTimer);
    worker?.terminate();
    worker = null;
  }

  function settle(id, blob, error) {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    job.signal?.removeEventListener('abort', job.abort);
    if (error) job.reject(error);
    else job.resolve(blob);
    if (!pending.size) idleTimer = setTimeout(releaseWorker, 30000);
  }

  function getWorker() {
    clearTimeout(idleTimer);
    if (worker) return worker;
    worker = new Worker(workerUrl, {type: 'module', name: 'role-cutout'});
    worker.onmessage = ({data}) => settle(data.id, data.blob, data.error && new Error(data.error));
    worker.onerror = () => {
      for (const id of pending.keys()) settle(id, null, new Error('本地主体分割组件加载失败'));
      releaseWorker();
    };
    return worker;
  }

  window.roleStudioCutout = async function roleStudioCutout(image, {signal} = {}) {
    signal?.throwIfAborted();
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error('角色图片尚未加载');
    const scale = Math.min(1, 2400 / Math.max(width, height));
    const resize = scale === 1 ? {} : {
      resizeWidth: Math.max(1, Math.round(width * scale)),
      resizeHeight: Math.max(1, Math.round(height * scale)),
      resizeQuality: 'high',
    };
    const bitmap = await createImageBitmap(image, resize);
    try {
      signal?.throwIfAborted();
      const engine = getWorker();
      return await new Promise((resolve, reject) => {
        const id = ++nextId;
        const abort = () => {
          settle(id, null, signal.reason || new DOMException('操作已取消', 'AbortError'));
          if (pending.size) engine.postMessage({cancel: id});
          else releaseWorker();
        };
        pending.set(id, {resolve, reject, signal, abort});
        signal?.addEventListener('abort', abort, {once:true});
        try { engine.postMessage({id, bitmap}, [bitmap]); }
        catch (error) { settle(id, null, error); }
      });
    } finally {
      bitmap.close();
    }
  };
})();
