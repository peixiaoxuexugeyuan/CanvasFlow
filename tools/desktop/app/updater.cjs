'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const UPDATE_ORIGIN = 'https://video.zzzapi.xyz';
const FEED_URL = UPDATE_ORIGIN + '/updates/latest.json';
const MAX_INSTALLER_SIZE = 8 * 1024 ** 3;
const INSTALLER_NAME = 'CanvasFlow-Setup.exe';
const PART_NAME = 'installer.part';
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

function createUpdater({version, buildNumber = 0, directory, fetchImpl = fetch, downloadIdleMs = 120000, onChange = () => {}}) {
  versionParts(version);
  validBuild(buildNumber);
  let state = {status:'idle', currentVersion:version, currentBuildNumber:buildNumber, version:'', buildNumber:0, progress:0, message:''};
  let release = null, downloaded = null, operation = null, controller = null;
  const getState = () => ({...state});
  function setStatus(status, patch = {}) {
    state = {...state, status, ...patch};
    try { onChange(getState()); } catch { /* renderer may be navigating */ }
  }
  async function request(url, signal, offset = 0) {
    const original = new URL(url);
    for (let redirect = 0; redirect <= 3; redirect++) {
      const headers = {'Accept-Encoding':'identity'};
      if (offset) headers.Range = 'bytes=' + offset + '-';
      const response = await fetchImpl(url, {redirect:'manual', signal, cache:'no-store', headers});
      if (response.status >= 300 && response.status < 400) {
        const target = new URL(response.headers.get('location') || '', url);
        await response.body?.cancel();
        if (!response.headers.get('location') || target.origin !== UPDATE_ORIGIN || target.username || target.password || target.pathname !== original.pathname || target.hash) throw Error('更新地址发生了不受支持的跳转');
        url = target.href;
        continue;
      }
      if (offset && response.status === 416) {
        await response.body?.cancel();
        return request(original.href, signal);
      }
      if (response.status !== 200 && !(offset && response.status === 206)) {
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
    let signature = Buffer.alloc(0);
    for await (const bytes of fs.createReadStream(file, {signal})) {
      if (signature.length < 2) {
        signature = Buffer.concat([signature, bytes.subarray(0, 2 - signature.length)]);
        if (signature.length === 2 && !signature.equals(Buffer.from('MZ'))) return false;
      }
      hash.update(bytes);
    }
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
        if (members.some(member => !member.isFile() || ![INSTALLER_NAME, CACHE_RECEIPT, PART_NAME].includes(member.name))) continue;
        if (!members.length) continue;
        const receiptPath = path.join(folder, CACHE_RECEIPT);
        let target = null;
        if (members.some(member => member.name === CACHE_RECEIPT)) {
          if ((await fs.promises.lstat(receiptPath)).size > 65536) continue;
          target = validateManifest(JSON.parse(await fs.promises.readFile(receiptPath, 'utf8')));
        }
        const hasFile = members.some(member => member.name === INSTALLER_NAME);
        const part = members.some(member => member.name === PART_NAME) ? path.join(folder, PART_NAME) : null;
        yield {folder, part, file:hasFile ? path.join(folder, INSTALLER_NAME) : null, receiptPath, target};
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
        if (cache.part && cache.target) await fs.promises.unlink(cache.part);
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
      let partial;
      for await (const cache of cachedInstallers()) {
        signal.throwIfAborted();
        if (cache.target?.version !== release.version || cache.target.buildNumber !== release.buildNumber ||
            cache.target.size !== release.size || cache.target.sha256 !== release.sha256) continue;
        if (!cache.file) {
          if (cache.part) partial = cache;
          continue;
        }
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
      await fs.promises.mkdir(directory, {recursive:true});
      const folder = partial?.folder || await fs.promises.mkdtemp(path.join(directory, 'update-'));
      const file = path.join(folder, INSTALLER_NAME);
      const part = path.join(folder, PART_NAME);
      const receipt = path.join(folder, CACHE_RECEIPT);
      let handle, received = 0, discard = false, idleTimer;
      const idle = new AbortController();
      const transfer = AbortSignal.any([signal, idle.signal]);
      function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => idle.abort(Error('安装包下载长时间没有进展，可重试续传')), downloadIdleMs);
      }
      try {
        if (!partial) {
          await fs.promises.writeFile(receipt, JSON.stringify({schemaVersion:1, platform:'win32', arch:'x64', ...release}), {flag:'wx', mode:0o600});
        }
        handle = await fs.promises.open(part, partial ? 'r+' : 'wx', 0o600);
        received = (await handle.stat()).size;
        if (received > release.size) {await handle.truncate(0); received = 0;}
        if (received < release.size) {
          resetIdleTimer();
          const response = await request(release.url, transfer, received);
          if (response.status === 206) {
            const expected = 'bytes ' + received + '-' + (release.size - 1) + '/' + release.size;
            if (response.headers.get('content-range') !== expected) {
              discard = true; await response.body.cancel(); throw Error('更新服务返回的续传位置无效，请重新下载');
            }
          } else if (received) {
            await handle.truncate(0);
            received = 0;
          }
          const contentLength = response.headers.get('content-length');
          if (contentLength !== null && Number(contentLength) !== release.size - received) {
            await response.body.cancel(); throw Error('安装包大小与官网清单不一致');
          }
          let lastProgress = -1;
          for await (const bytes of response.body) {
            transfer.throwIfAborted();
            if (!bytes.length) continue;
            resetIdleTimer();
            if (received + bytes.length > release.size) {
              discard = true; throw Error('安装包大小超过官网清单');
            }
            let offset = 0;
            while (offset < bytes.length) {
              const {bytesWritten} = await handle.write(bytes, offset, bytes.length - offset, received);
              if (!bytesWritten) throw Error('无法写入安装包');
              received += bytesWritten; offset += bytesWritten;
            }
            const progress = Math.floor(received / release.size * 100);
            if (progress !== lastProgress) {lastProgress = progress; setStatus('downloading', {progress});}
          }
          transfer.throwIfAborted();
          if (received < release.size) throw Error('安装包下载中断，可重试续传');
        }
        clearTimeout(idleTimer);
        await handle.close(); handle = null;
        setStatus('verifying', {progress:100});
        if (!await validInstaller(part, release, signal)) {
          discard = true; throw Error('安装包校验失败，请重新下载');
        }
        await fs.promises.rename(part, file);
        downloaded = {folder, file};
        setStatus('ready', {progress:100, message:'安装包已就绪'});
        return file;
      } catch (error) {
        if (idle.signal.aborted) throw idle.signal.reason;
        throw error;
      } finally {
        clearTimeout(idleTimer);
        await handle?.close();
        if (discard || !received) {
          await fs.promises.unlink(part).catch(()=>{});
          await fs.promises.unlink(receipt).catch(()=>{});
          await fs.promises.rmdir(folder).catch(()=>{});
        }
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
