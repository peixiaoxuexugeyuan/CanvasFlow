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
test('equal versions compare monotonic build numbers while older versions never upgrade',()=>{
  assert.equal(isNewer('1.0.0','1.0.0',2026111602,2026111601),true);
  assert.equal(isNewer('1.0.0','1.0.0',2026111601,2026111601),false);
  assert.equal(isNewer('1.0.0','1.0.0',2026111501,2026111601),false);
  assert.equal(isNewer('0.9.9','1.0.0',2026111609,2026111601),false);
  assert.equal(isNewer('1.0.1','1.0.0',0,2026111601),true);
  for(const buildNumber of [-1,1.5,'2026111602',Number.MAX_SAFE_INTEGER+1,null])assert.throws(()=>validateManifest({...manifest,buildNumber}));
});
test('same-version build update downloads once and stops offering after installation',async t=>{
  const h=await harness(t);const next={...manifest,version:'1.0.0',buildNumber:2026111602,url:manifest.url.replace('1.0.1','1.0.0')};
  const options={version:'1.0.0',buildNumber:2026111601,directory:h.directory,fetchImpl:async url=>new Response(url===FEED_URL?JSON.stringify(next):bytes)};
  const current=createUpdater(options);await current.check();assert.equal(current.getState().status,'available');
  assert.match(current.getState().message,/2026111602/);assert.ok(await current.download());assert.ok(await current.verifyInstaller());
  const installed=createUpdater({...options,buildNumber:2026111602});await installed.check();assert.equal(installed.getState().status,'up-to-date');
  const legacyFeed=createUpdater({...options,fetchImpl:async()=>new Response(JSON.stringify({...next,buildNumber:undefined}))});
  await legacyFeed.check();assert.equal(legacyFeed.getState().status,'up-to-date');
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
test('postponed installers are verified and reused after restart or a second check',async t=>{
  const h=await harness(t);
  await h.manager.check();
  const file=await h.manager.download();
  await h.manager.check();
  assert.equal(await h.manager.download(),file);
  let downloads=0;
  const restarted=createUpdater({version:'1.0.0',directory:h.directory,fetchImpl:async url=>{
    if(url===FEED_URL)return new Response(JSON.stringify(manifest));
    downloads++;return new Response(bytes);
  }});
  await restarted.check();
  assert.equal(await restarted.download(),file);
  assert.equal(await restarted.verifyInstaller(),file);
  assert.equal(downloads,0);
  await fs.promises.writeFile(file, Buffer.alloc(bytes.length));
  await restarted.check();
  assert.notEqual(await restarted.download(),file);
  assert.equal(downloads,1);
  await restarted.verifyInstaller();
});
test('a successful upgrade reclaims only owned cache files for installed builds',async t=>{
  const h=await harness(t);await h.manager.check();const file=await h.manager.download();
  await h.manager.cleanInstalledDownloads();assert.equal(fs.existsSync(file),true);
  const installed=createUpdater({version:manifest.version,directory:h.directory});
  const unknown=await fs.promises.mkdtemp(path.join(h.directory,'update-'));
  await fs.promises.writeFile(path.join(unknown,'CanvasFlow-Setup.exe'),bytes);
  await installed.cleanInstalledDownloads();
  assert.equal(fs.existsSync(path.dirname(file)),false);
  assert.equal(fs.existsSync(unknown),true,'unmarked legacy files need a known hash from the official feed');
  await installed.cleanInstalledDownloads({...validateManifest(manifest),sha256:'0'.repeat(64)});
  assert.equal(fs.existsSync(unknown),true);
  const userFile=path.join(unknown,'notes.txt');await fs.promises.writeFile(userFile,'keep');
  await installed.cleanInstalledDownloads(validateManifest(manifest));assert.equal(fs.existsSync(userFile),true);
  await fs.promises.unlink(userFile);
  await installed.cleanInstalledDownloads(validateManifest(manifest));assert.equal(fs.existsSync(unknown),false);
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
test('packaging records the actual desktop build in the update manifest',async t=>{
  const h=await harness(t),installer=path.join(h.directory,'CanvasFlow-1.0.1-x64-Setup.exe');await fs.promises.writeFile(installer,bytes);
  const target=await writeUpdateManifest(installer,'1.0.1',h.directory,2026111601);
  const actual=validateManifest(JSON.parse(await fs.promises.readFile(target,'utf8')));
  assert.equal(actual.buildNumber,2026111601);
  assert.equal(new URL(actual.url).searchParams.get('build'),'2026111601');
});
