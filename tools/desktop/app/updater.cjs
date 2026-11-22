'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const UPDATE_ORIGIN = 'https://video.zzzapi.xyz';
const FEED_URL = UPDATE_ORIGIN + '/updates/latest.json';
const MAX_INSTALLER_SIZE = 8 * 1024 ** 3;
const INSTALLER_NAME = 'CanvasFlow-Setup.exe';
const CACHE_RECEIPT = 'release.json';

function versionParts(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value)) throw Error('更新版本号无效');
  return value.split('.').map(Number);
}
function validBuild(value = 0) {
  if (!Number.isSafeInteger(value) || value < 0) throw Error('更新构建号无效');
  return value;
}
function isNewer(next, current, nextBuild = 0, currentBuild = 0) {
  validBuild(nextBuild); validBuild(currentBuild);
  const a = versionParts(next), b = versionParts(current);
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return nextBuild > currentBuild;
}
function validateManifest(value) {
  if (!value || value.schemaVersion !== 1 || value.platform !== 'win32' || value.arch !== 'x64') throw Error('官网更新清单格式不匹配');
  versionParts(value.version);
  const expected = `/downloads/CanvasFlow-${value.version}-x64-Setup.exe`;
  let url; try { url = new URL(value.url); } catch { throw Error('安装包地址无效'); }
  if (url.origin !== UPDATE_ORIGIN || url.username || url.password || url.pathname !== expected || url.hash) throw Error('安装包必须来自 CanvasFlow 官方下载地址');
  if (!/^[a-f0-9]{64}$/i.test(value.sha256 || '') || !Number.isSafeInteger(value.size) || value.size < 2 || value.size > MAX_INSTALLER_SIZE) throw Error('安装包校验信息无效');
  return {version:value.version, buildNumber:validBuild(value.buildNumber), url:url.href, sha256:value.sha256.toLowerCase(), size:value.size};
}

function createUpdater({version, buildNumber = 0, directory, fetchImpl = fetch, onChange = () => {}}) {
  versionParts(version);
  validBuild(buildNumber);
  let state = {status:'idle', currentVersion:version, currentBuildNumber:buildNumber, version:'', buildNumber:0, progress:0, message:''};
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
  async function validInstaller(file, target, signal) {
    const stat = await fs.promises.lstat(file);
    if (!stat.isFile() || stat.size !== target.size) return false;
    const hash = crypto.createHash('sha256');
    for await (const bytes of fs.createReadStream(file, {signal})) hash.update(bytes);
    return hash.digest('hex') === target.sha256;
  }
  async function* cachedInstallers() {
    let entries;
    try {
      if (!(await fs.promises.lstat(directory)).isDirectory()) return;
      entries = await fs.promises.readdir(directory, {withFileTypes:true});
    } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^update-[a-zA-Z0-9]{6}$/.test(entry.name)) continue;
      const folder = path.join(directory, entry.name);
      try {
        const members = await fs.promises.readdir(folder, {withFileTypes:true});
        if (members.some(member => !member.isFile() || ![INSTALLER_NAME, CACHE_RECEIPT].includes(member.name))) continue;
        if (!members.length) continue;
        const receiptPath = path.join(folder, CACHE_RECEIPT);
        let target = null;
        if (members.some(member => member.name === CACHE_RECEIPT)) {
          if ((await fs.promises.lstat(receiptPath)).size > 65536) continue;
          target = validateManifest(JSON.parse(await fs.promises.readFile(receiptPath, 'utf8')));
        }
        const hasFile = members.some(member => member.name === INSTALLER_NAME);
        yield {folder, file:hasFile ? path.join(folder, INSTALLER_NAME) : null, receiptPath, target};
      } catch { /* Ignore incomplete or unreadable receipts. */ }
    }
  }
  async function cleanInstalledDownloads(legacyRelease) {
    for await (const cache of cachedInstallers()) {
      if (legacyRelease && cache.target) continue;
      const target = cache.target || legacyRelease;
      if (!target || isNewer(target.version, version, target.buildNumber, buildNumber)) continue;
      try {
        if (cache.file) {
          if (!await validInstaller(cache.file, target)) continue;
          await fs.promises.unlink(cache.file);
        }
        if (cache.target) await fs.promises.unlink(cache.receiptPath);
        await fs.promises.rmdir(cache.folder);
      } catch { /* A running installer can still hold its file open. Try next launch. */ }
    }
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
      downloaded = null;
      release = isNewer(next.version, version, next.buildNumber, buildNumber) ? next : null;
      if (!release) await cleanInstalledDownloads(next);
      setStatus(release ? 'available' : 'up-to-date', {version:next.version, buildNumber:next.buildNumber, message:release ? `发现更新 v${next.version}${next.buildNumber ? ` · 构建 ${next.buildNumber}` : ''}` : '当前已是最新版本'});
      return getState();
    });
  }
  function download() {
    if (operation || state.status === 'installing') return Promise.resolve(null);
    if (!release) return Promise.resolve(null);
    return run('downloading', async signal => {
      for await (const cache of cachedInstallers()) {
        signal.throwIfAborted();
        if (!cache.file || cache.target?.version !== release.version ||
            cache.target.buildNumber !== release.buildNumber || cache.target.sha256 !== release.sha256) continue;
        try {
          if (!await validInstaller(cache.file, release, signal)) continue;
        } catch {
          signal.throwIfAborted();
          continue;
        }
        downloaded = cache;
        setStatus('ready', {progress:100, message:'安装包已校验，可以继续安装'});
        return cache.file;
      }
      downloaded = null;
      const response = await request(release.url, AbortSignal.any([signal, AbortSignal.timeout(30 * 60 * 1000)]));
      const contentLength = response.headers.get('content-length');
      if (contentLength !== null && Number(contentLength) !== release.size) {await response.body.cancel(); throw Error('安装包大小与官网清单不一致');}
      await fs.promises.mkdir(directory, {recursive:true});
      const folder = await fs.promises.mkdtemp(path.join(directory, 'update-'));
      const file = path.join(folder, INSTALLER_NAME);
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
        await fs.promises.writeFile(path.join(folder, CACHE_RECEIPT), JSON.stringify({schemaVersion:1, platform:'win32', arch:'x64', ...release}), {flag:'wx', mode:0o600});
        downloaded = {folder, file}; complete = true;
        setStatus('ready', {progress:100, message:'安装包已就绪'});
        return file;
      } finally {
        await handle?.close();
        if (!complete) {await fs.promises.unlink(file).catch(()=>{}); await fs.promises.unlink(path.join(folder, CACHE_RECEIPT)).catch(()=>{}); await fs.promises.rmdir(folder).catch(()=>{});}
      }
    });
  }
  async function verifyInstaller() {
    if (!downloaded || !release) throw Error('安装包尚未下载完成');
    if (!await validInstaller(downloaded.file, release)) throw Error('安装包校验失败，请重新检查更新');
    return downloaded.file;
  }
  async function cancel() { controller?.abort(); await operation; }
  return {getState, check, download, verifyInstaller, cleanInstalledDownloads, cancel,
    installing:()=>setStatus('installing', {message:'正在打开安装程序'}),
    ready:()=>setStatus('ready', {message:'安装包已就绪，点击继续安装'}),
    fail:message=>setStatus('error', {message})};
}
module.exports = {UPDATE_ORIGIN, FEED_URL, validateManifest, isNewer, createUpdater};
