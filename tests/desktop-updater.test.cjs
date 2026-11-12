'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {createUpdater, validateManifest, isNewer, FEED_URL} = require('../tools/desktop/app/updater.cjs');
const {writeUpdateManifest} = require('../tools/desktop/update-manifest.cjs');
const bytes = Buffer.from('MZ-canvasflow-installer-test-fixture');
const manifest = {schemaVersion:1, version:'1.0.1', platform:'win32', arch:'x64',
  url:'https://video.zzzapi.xyz/downloads/CanvasFlow-1.0.1-x64-Setup.exe', size:bytes.length,
  sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
async function harness(t, fetchImpl) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'canvasflow-updater-test-'));
  t.after(async()=>{
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.match(path.basename(directory), /^canvasflow-updater-test-/);
    await fs.promises.rm(directory, {recursive:true,force:true});
  });
  const statuses = [], calls = [];
  const manager = createUpdater({version:'1.0.0', directory, onChange:value=>statuses.push(value),
    fetchImpl:async(url, options)=>{
      calls.push(url);
      return fetchImpl ? fetchImpl(url, options) : new Response(url === FEED_URL ? JSON.stringify(manifest) : bytes);
    }});
  return {manager, directory, statuses, calls};
}

test('versions compare numerically and downgrade/equal releases are not updates',()=>{
  assert.equal(isNewer('1.10.0','1.9.9'), true);
  assert.equal(isNewer('1.0.0','1.0.0'), false);
  assert.equal(isNewer('1.0.0','2.0.0'), false);
  assert.throws(()=>isNewer('1.01.0','1.0.0'));
});
test('manifest permits only the official HTTPS versioned Windows installer',()=>{
  assert.equal(validateManifest(manifest).version,'1.0.1');
  for (const patch of [
    {url:'http://video.zzzapi.xyz/downloads/CanvasFlow-1.0.1-x64-Setup.exe'},
    {url:'https://evil.example/downloads/CanvasFlow-1.0.1-x64-Setup.exe'},
    {url:'https://user:secret@video.zzzapi.xyz/downloads/CanvasFlow-1.0.1-x64-Setup.exe'},
    {url:'https://video.zzzapi.xyz/downloads/other.exe'}, {sha256:'bad'}, {size:9*1024**3},
    {version:'../1.0.1'}, {platform:'darwin'}, {arch:'arm64'}
  ]) assert.throws(()=>validateManifest({...manifest,...patch}));
});
test('successful check and verified download report progress and avoid duplicate downloading',async t=>{
  const h = await harness(t);
  await h.manager.check(); assert.equal(h.manager.getState().status,'available');
  const file = await h.manager.download();
  assert.deepEqual(await fs.promises.readFile(file),bytes);
  assert.equal(await h.manager.verifyInstaller(),file);
  assert.equal(h.manager.getState().status,'ready');
  assert.ok(h.statuses.some(x=>x.status==='downloading' && x.progress===100));
  assert.equal(await h.manager.download(),file); assert.equal(h.calls.length,2);
});
test('hash mismatch and incomplete downloads never become installable and remove partial files',async t=>{
  for(const body of [Buffer.from('MZ-wrong'),Buffer.from(bytes.toString().replace('fixture','corrupt'))]){
    const h = await harness(t,url=>new Response(url===FEED_URL?JSON.stringify(manifest):body));
    await h.manager.check(); assert.equal(await h.manager.download(),null);
    assert.equal(h.manager.getState().status,'error');
    assert.deepEqual(await fs.promises.readdir(h.directory),[]);
    await assert.rejects(h.manager.verifyInstaller());
  }
});
test('changed downloaded installer is rejected before opening it',async t=>{
  const h = await harness(t); await h.manager.check(); const file=await h.manager.download();
  await fs.promises.writeFile(file,Buffer.alloc(bytes.length));
  await assert.rejects(h.manager.verifyInstaller(),/校验失败/);
});
test('unavailable or malformed feeds show errors rather than claiming up to date',async t=>{
  for(const response of [new Response('',{status:404}), new Response('<html>fallback</html>'),new Response(' '.repeat(65537))]){
    const h=await harness(t,()=>response); await h.manager.check();
    assert.equal(h.manager.getState().status,'error'); assert.equal(await h.manager.download(),null);
  }
});
test('cross-origin redirects are rejected without contacting the destination',async t=>{
  const h=await harness(t,()=>new Response(null,{status:302,headers:{location:'https://evil.example/latest.json'}}));
  await h.manager.check(); assert.equal(h.calls.length,1); assert.equal(h.manager.getState().status,'error');
});
test('equal release stays up to date and never starts an installer download',async t=>{
  const h=await harness(t,()=>new Response(JSON.stringify({...manifest,version:'1.0.0',url:manifest.url.replace('1.0.1','1.0.0')})));
  await h.manager.check(); assert.equal(h.manager.getState().status,'up-to-date');
  assert.equal(await h.manager.download(),null); assert.equal(h.calls.length,1);
});
test('concurrent checks are coalesced and cancellation ends the pending request',async t=>{
  let begin;
  const started=new Promise(resolve=>{begin=resolve;});
  const h=await harness(t,(_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});begin();
  }));
  const check=h.manager.check(); await started;
  await h.manager.check(); assert.equal(h.calls.length,1);
  await h.manager.cancel(); await check;
  assert.equal(h.manager.getState().status,'error');
});
test('packaging writes a real size and hash without overwriting an existing release manifest',async t=>{
  const h=await harness(t); const installer=path.join(h.directory,'CanvasFlow-1.0.1-x64-Setup.exe');
  await fs.promises.writeFile(installer,bytes);
  const target=await writeUpdateManifest(installer,'1.0.1',h.directory);
  const actual=JSON.parse(await fs.promises.readFile(target,'utf8'));
  assert.equal(actual.size,bytes.length); assert.equal(actual.sha256,manifest.sha256);
  assert.deepEqual(validateManifest(actual),validateManifest(manifest));
  await assert.rejects(writeUpdateManifest(installer,'1.0.1',h.directory),/EEXIST/);
});
