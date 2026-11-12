'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const {MANIFEST_NAME, prepareInstaller, removalInclude} = require('../tools/desktop/installer-data.cjs');
const helper = path.resolve(__dirname, '../tools/desktop/preserve-upgrade-data.ps1');
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
function write(root, file, value = 'fixture') {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, value); return target;
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canvasflow-installer-test-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const stage = path.join(root,'package');
  write(stage,'CanvasFlow.exe'); write(stage,'resources/app.asar'); write(stage,'resources/runtime/program.dll');
  prepareInstaller(stage);
  return {root, stage, old:path.join(root,'old'), state:path.join(root,'state.json')};
}
function runHelper(f, mode, extra = []) {
  return spawnSync(powershell, ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,
    '-Mode',mode,'-StateFile',f.state,...extra], {encoding:'utf8', timeout:30000});
}
function prepare(f) { return runHelper(f,'Prepare',['-PackageManifest',path.join(f.stage,MANIFEST_NAME),'-PreviousDirectories',f.old]); }
function oldFiles(f) { write(f.old,'CanvasFlow.exe'); write(f.old,'resources/app.asar'); }
function ok(result) { assert.equal(result.status,0,result.stdout+'\n'+result.stderr); }

test('installer removes only immutable package entries, with non-recursive directory cleanup', () => {
  const include=removalInclude(['CanvasFlow.exe','resources/app.asar']);
  assert.doesNotMatch(include,/RMDir\s+\/r|Delete\s+[^\n]*\*/i);
  assert.match(include,/Call un\.CanvasFlowRemoveOwnedFile/);
  assert.match(include,/Call un\.CanvasFlowRemoveEmptyDirectory/);
  assert.doesNotMatch(include,/\bRMDir\b/,'directory cleanup must go through the same guarded path function');
  for (const name of ['../data','/absolute','C:/data','resources/../data','bad*name','bad\\name'])
    assert.throws(()=>removalInclude([name]), /Unsafe/);
});

test('production NSIS cannot enter legacy uninstall through the UAC branch that skips preservation', () => {
  const installerConfig=require('../tools/desktop/windows-installer-config.cjs');
  assert.equal(installerConfig.nsis.allowElevation,false);
  const builderRequire=require('node:module').createRequire(require.resolve('electron-builder',{paths:[path.resolve(__dirname,'../tools/desktop')]}));
  const templates=path.join(path.dirname(builderRequire.resolve('app-builder-lib/package.json')),'templates/nsis');
  const installer=fs.readFileSync(path.join(templates,'installer.nsi'),'utf8');
  const section=fs.readFileSync(path.join(templates,'installSection.nsh'),'utf8');
  const hooks=fs.readFileSync(path.resolve(__dirname,'../tools/desktop/installer.nsh'),'utf8');
  assert(installer.indexOf('!insertmacro customInit')<installer.indexOf('!include "installSection.nsh"'));
  assert.match(section,/\$\{ifNot\} \$\{UAC_IsInnerInstance\}\s+!insertmacro CHECK_APP_RUNNING\s+\$\{endif\}/);
  assert(section.indexOf('!insertmacro CHECK_APP_RUNNING')<section.indexOf('!insertmacro uninstallOldVersion'));
  const init=hooks.match(/!macro customInit\b([\s\S]*?)!macroend/)[1];
  assert.match(init,/\$\{If\} \$\{UAC_IsInnerInstance\}[\s\S]*?SetErrorLevel 2\s+Quit\s+\$\{EndIf\}/);
  const prepare=hooks.match(/!macro customCheckAppRunning\b([\s\S]*?)!macroend/)[1];
  assert.match(prepare,/-Mode Prepare\b/);
  assert.match(prepare,/\$\{If\} \$R0 != 0[\s\S]*?SetErrorLevel 2\s+Quit/);
});

test('legacy upgrade preserves all custom files, internal userdata and metadata-name collisions', {skip:process.platform!=='win32'}, t => {
  const f=fixture(t); oldFiles(f);
  const custom = ['desktop-config.json','userdata/data/projects/a.json','resources/runtime/custom/upload.png','CanvasFlow-recovery.json'];
  for (const file of custom) write(f.old,file,file==='desktop-config.json'?' {"dataDirectory":"userdata/data"}':file);
  ok(prepare(f));
  const state=JSON.parse(fs.readFileSync(f.state));
  assert.equal(state.installations.length,1);
  assert.deepEqual(state.installations[0].files.map(f=>f.path.replaceAll('\\','/')).sort(),custom.sort());
  // A legacy uninstaller deletes its whole app tree. Only the isolated fixture is removed.
  fs.rmSync(f.old,{recursive:true}); fs.cpSync(f.stage,f.old,{recursive:true});
  ok(runHelper(f,'Restore',['-InstallDirectory',f.old]));
  for (const file of custom) assert(fs.existsSync(path.join(f.old,file)),file);
  assert(fs.existsSync(path.join(state.installations[0].backup,'CanvasFlow-recovery.json')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.old,'desktop-config.json'))).dataDirectory,'userdata/data');
});

test('changed install location follows internal absolute data paths but preserves external paths', {skip:process.platform!=='win32'}, t => {
  const f=fixture(t); oldFiles(f);
  write(f.old,'desktop-config.json',JSON.stringify({dataDirectory:path.join(f.old,'custom/data'),backendDirectory:path.join(f.root,'external')}));
  write(f.old,'custom/data/database.db','user data'); ok(prepare(f));
  const next=path.join(f.root,'new'); fs.cpSync(f.stage,next,{recursive:true});
  ok(runHelper(f,'Restore',['-InstallDirectory',next]));
  const config=JSON.parse(fs.readFileSync(path.join(next,'desktop-config.json')));
  assert.equal(config.dataDirectory,path.join(next,'custom/data'));
  assert.equal(config.backendDirectory,path.join(f.root,'external'));
  assert.equal(fs.readFileSync(path.join(f.old,'custom/data/database.db'),'utf8'),'user data');
});

test('preservation fails closed for junctions and unsafe inventory paths', {skip:process.platform!=='win32'}, t => {
  const f=fixture(t); oldFiles(f); const outside=path.join(f.root,'external'); write(outside,'data.json','keep');
  fs.symlinkSync(outside,path.join(f.old,'linked'),'junction');
  assert.notEqual(prepare(f).status,0); assert(!fs.existsSync(f.state));
  assert.equal(fs.readFileSync(path.join(outside,'data.json'),'utf8'),'keep');
  fs.unlinkSync(path.join(f.old,'linked'));
  write(f.stage,MANIFEST_NAME,JSON.stringify({version:1,files:['../external/data.json']}));
  assert.notEqual(prepare(f).status,0); assert(fs.existsSync(path.join(f.old,'CanvasFlow.exe')));
});

test('restore conflicts fail without overwriting either file and keep recovery data', {skip:process.platform!=='win32'}, t => {
  const f=fixture(t); oldFiles(f); write(f.old,'custom/data.json','old data'); ok(prepare(f));
  const next=path.join(f.root,'new'); fs.cpSync(f.stage,next,{recursive:true}); write(next,'custom/data.json','new data');
  assert.notEqual(runHelper(f,'Restore',['-InstallDirectory',next]).status,0);
  assert.equal(fs.readFileSync(path.join(next,'custom/data.json'),'utf8'),'new data');
  const state=JSON.parse(fs.readFileSync(f.state));
  assert.equal(fs.readFileSync(path.join(state.installations[0].backup,'files/custom/data.json'),'utf8'),'old data');
});
test('configured internal data and desktop config override an old package ownership manifest', {skip:process.platform!=='win32'}, t => {
  const f=fixture(t); oldFiles(f);
  write(f.old,'desktop-config.json',JSON.stringify({dataDirectory:'resources/runtime'}));
  write(f.old,'resources/runtime/program.dll','user-created data with a package filename');
  write(f.old,MANIFEST_NAME,JSON.stringify({version:1,files:['CanvasFlow.exe','resources/app.asar','desktop-config.json','resources/runtime/program.dll',MANIFEST_NAME]}));
  ok(prepare(f));
  const files=JSON.parse(fs.readFileSync(f.state)).installations[0].files.map(file=>file.path.replaceAll('\\','/'));
  assert(files.includes('desktop-config.json'));
  assert(files.includes('resources/runtime/program.dll'));
  const protection=runHelper({...f,state:path.join(f.root,'protected.ini')},'PrepareRemoval',['-InstallDirectory',f.old]);
  ok(protection);
  const ini=fs.readFileSync(path.join(f.root,'protected.ini'),'utf16le');
  assert.match(ini,/count=2\r?\n/);
  assert.match(ini,/path\d=resources\\runtime/);
});
