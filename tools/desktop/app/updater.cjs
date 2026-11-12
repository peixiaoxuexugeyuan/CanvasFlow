'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const UPDATE_ORIGIN = 'https://video.zzzapi.xyz';
const FEED_URL = UPDATE_ORIGIN + '/updates/latest.json';
const MAX_INSTALLER_SIZE = 8 * 1024 ** 3;

function versionParts(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value)) throw Error('更新版本号无效');
  return value.split('.').map(Number);
}
function isNewer(next, current) {
  const a = versionParts(next), b = versionParts(current);
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
function validateManifest(value) {
  if (!value || value.schemaVersion !== 1 || value.platform !== 'win32' || value.arch !== 'x64') throw Error('官网更新清单格式不匹配');
  versionParts(value.version);
  const expected = `/downloads/CanvasFlow-${value.version}-x64-Setup.exe`;
  let url; try { url = new URL(value.url); } catch { throw Error('安装包地址无效'); }
  if (url.origin !== UPDATE_ORIGIN || url.username || url.password || url.pathname !== expected || url.hash) throw Error('安装包必须来自 CanvasFlow 官方下载地址');
  if (!/^[a-f0-9]{64}$/i.test(value.sha256 || '') || !Number.isSafeInteger(value.size) || value.size < 2 || value.size > MAX_INSTALLER_SIZE) throw Error('安装包校验信息无效');
  return {version:value.version, url:url.href, sha256:value.sha256.toLowerCase(), size:value.size};
}

function createUpdater({version, directory, fetchImpl = fetch, onChange = () => {}}) {
  versionParts(version);
  let state = {status:'idle', currentVersion:version, version:'', progress:0, message:''};
  let release = null, downloaded = null, operation = null, controller = null;
  const getState = () => ({...state});
  function setStatus(status, patch = {}) {
    state = {...state, status, ...patch};
    try { onChange(getState()); } catch { /* renderer may be navigating */ }
  }
  async function request(url, signal) {
    const original = new URL(url);
    for (let redirect = 0; redirect <= 3; redirect++) {
      const response = await fetchImpl(url, {redirect:'manual', signal, cache:'no-store', headers:{'Accept-Encoding':'identity'}});
      if (response.status >= 300 && response.status < 400) {
        const target = new URL(response.headers.get('location') || '', url);
        await response.body?.cancel();
        if (!response.headers.get('location') || target.origin !== UPDATE_ORIGIN || target.username || target.password || target.pathname !== original.pathname || target.hash) throw Error('更新地址发生了不受支持的跳转');
        url = target.href;
        continue;
      }
      if (response.status !== 200) {
        await response.body?.cancel();
        throw Error(response.status === 404 && original.href === FEED_URL ? '官网尚未发布更新清单，请稍后重试' : `更新服务返回 HTTP ${response.status}`);
      }
      if (!response.body) throw Error('更新服务返回了空内容');
      return response;
    }
    throw Error('更新地址跳转次数过多');
  }
  async function discardDownload() {
    if (!downloaded) return;
    const owned = downloaded; downloaded = null;
    await fs.promises.unlink(owned.file).catch(error => {if (error.code !== 'ENOENT') throw error;});
    await fs.promises.rmdir(owned.folder);
  }
  function run(status, task) {
    if (operation) return operation;
    controller = new AbortController();
    const signal = controller.signal;
    setStatus(status, {message:'', progress:0});
    operation = (async () => {
      try { return await task(signal); }
      catch (error) {
        setStatus('error', {message: signal.aborted ? '更新已取消，可重新尝试' : error.message});
        return null;
      } finally { operation = null; controller = null; }
    })();
    return operation;
  }
  function check() {
    if (operation || state.status === 'installing') return Promise.resolve(getState());
    return run('checking', async signal => {
      const response = await request(FEED_URL, AbortSignal.any([signal, AbortSignal.timeout(20000)]));
      const chunks = []; let size = 0;
      for await (const bytes of response.body) {
        size += bytes.length;
        if (size > 65536) throw Error('官网更新清单过大');
        chunks.push(Buffer.from(bytes));
      }
      let value; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Error('官网更新清单无法解析'); }
      const next = validateManifest(value);
      await discardDownload();
      release = isNewer(next.version, version) ? next : null;
      setStatus(release ? 'available' : 'up-to-date', {version:next.version, message:release ? `发现新版本 v${next.version}` : '当前已是最新版本'});
      return getState();
    });
  }
  function download() {
    if (operation || state.status === 'installing') return Promise.resolve(null);
    if (!release) return Promise.resolve(null);
    return run('downloading', async signal => {
      if (downloaded) { setStatus('ready', {progress:100}); return downloaded.file; }
      const response = await request(release.url, AbortSignal.any([signal, AbortSignal.timeout(30 * 60 * 1000)]));
      const contentLength = response.headers.get('content-length');
      if (contentLength !== null && Number(contentLength) !== release.size) {await response.body.cancel(); throw Error('安装包大小与官网清单不一致');}
      await fs.promises.mkdir(directory, {recursive:true});
      const folder = await fs.promises.mkdtemp(path.join(directory, 'update-'));
      const file = path.join(folder, 'CanvasFlow-Setup.exe');
      let handle, complete = false;
      try {
        handle = await fs.promises.open(file, 'wx', 0o600);
        const hash = crypto.createHash('sha256'); let received = 0, magic = Buffer.alloc(0), lastProgress = -1;
        for await (const bytes of response.body) {
          if (signal.aborted) throw Error('更新已取消');
          const chunk = Buffer.from(bytes); received += chunk.length;
          if (received > release.size) throw Error('安装包大小超过官网清单');
          if (magic.length < 2) magic = Buffer.concat([magic, chunk]).subarray(0, 2);
          hash.update(chunk);
          let offset = 0;
          while (offset < chunk.length) { const {bytesWritten} = await handle.write(chunk, offset); if (!bytesWritten) throw Error('无法写入安装包'); offset += bytesWritten; }
          const progress = Math.floor(received / release.size * 100);
          if (progress !== lastProgress) {lastProgress = progress; setStatus('downloading', {progress});}
        }
        setStatus('verifying', {progress:100});
        if (received !== release.size || hash.digest('hex') !== release.sha256 || magic.toString('ascii') !== 'MZ') throw Error('安装包校验失败，请重新下载');
        await handle.close(); handle = null;
        downloaded = {folder, file}; complete = true;
        setStatus('ready', {progress:100, message:'安装包已就绪'});
        return file;
      } finally {
        await handle?.close();
        if (!complete) {await fs.promises.unlink(file).catch(()=>{}); await fs.promises.rmdir(folder).catch(()=>{});}
      }
    });
  }
  async function verifyInstaller() {
    if (!downloaded || !release) throw Error('安装包尚未下载完成');
    const stat = await fs.promises.lstat(downloaded.file);
    if (!stat.isFile() || stat.size !== release.size) throw Error('安装包已改变，请重新检查更新');
    const hash = crypto.createHash('sha256');
    for await (const bytes of fs.createReadStream(downloaded.file)) hash.update(bytes);
    if (hash.digest('hex') !== release.sha256) throw Error('安装包校验失败，请重新检查更新');
    return downloaded.file;
  }
  async function cancel() { controller?.abort(); await operation; }
  return {getState, check, download, verifyInstaller, cancel,
    installing:()=>setStatus('installing', {message:'正在打开安装程序'}),
    ready:()=>setStatus('ready', {message:'安装包已就绪，点击继续安装'}),
    fail:message=>setStatus('error', {message})};
}
module.exports = {UPDATE_ORIGIN, FEED_URL, validateManifest, isNewer, createUpdater};
