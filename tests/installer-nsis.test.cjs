'use strict';
// Opt-in Windows integration test. CANVASFLOW_NSIS_TEST_DIR points to electron-builder's
// downloaded nsis-3.0.4.1 directory. No application install registry key is touched.
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {spawnSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {prepareInstaller}=require('../tools/desktop/installer-data.cjs');
const nsis=process.env.CANVASFLOW_NSIS_TEST_DIR;
const run=(exe,args,env)=>spawnSync(exe,args,{encoding:'utf8',timeout:30000,env:env||process.env,windowsHide:true});
function runFixture(exe,args) {
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const argumentsText=args.join(' ');
  const command=`$ErrorActionPreference='Stop'; try { $info=[Diagnostics.ProcessStartInfo]::new(${quote(exe)},${quote(argumentsText)}); $info.UseShellExecute=$false; $info.CreateNoWindow=$true; $p=[Diagnostics.Process]::Start($info); if (-not $p.WaitForExit(25000)) { $p.Kill(); throw 'Fixture timed out' }; exit $p.ExitCode } catch { Write-Output $_.Exception.ToString(); exit 99 }`;
  return run(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')]);
}
function ok(result) { assert.equal(result.status,0,result.error?JSON.stringify(result.error):result.stdout+'\n'+result.stderr); }
function write(root,file,text='fixture') { const p=path.join(root,file); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,text); return p; }
const q=value=>String(value).replaceAll('$','$$').replaceAll('"','$\\"');

test('real NSIS legacy upgrade, safe uninstall, and pre-uninstall failure keep fixture user data', {skip:process.platform!=='win32'||!nsis}, async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'canvasflow-nsis-test-'));
  const key='Software\\CanvasFlowInstallerTest-'+randomUUID();
  t.after(()=>{
    // This unique key and directory are created by this test only.
    run('reg.exe',['delete','HKCU\\'+key,'/f']);
    fs.rmSync(root,{recursive:true,force:true});
  });
  const stage=path.join(root,'package'), installed=path.join(root,'installed');
  write(stage,'CanvasFlow.exe','new app'); write(stage,'resources/app.asar','new asar');
  write(stage,'resources/runtime/program.dll','new dll');
  const wrapper=prepareInstaller(stage), old=path.join(root,'old.exe'), next=path.join(root,'new.exe');
  const dummy=write(root,'old.bin','old app');
  const moduleBase=path.resolve(__dirname,'../tools/desktop/node_modules/.pnpm');
  const builder=fs.readdirSync(moduleBase).find(n=>n.startsWith('app-builder-lib@'));
  const includes=path.join(moduleBase,builder,'node_modules/app-builder-lib/templates/nsis/include');
  const installerInclude=path.resolve(__dirname,'../tools/desktop/installer.nsh');
  const compile=(name,body)=>{
    const script=write(root,name,body);
    ok(run(path.join(nsis,'Bin/makensis.exe'),['/INPUTCHARSET','UTF8','/V2',script],{...process.env,NSISDIR:nsis}));
  };
  compile('old.nsi',`Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "${q(old)}"
InstallDir "${q(installed)}"
Section
 SetOutPath "$INSTDIR"
 File /oname=CanvasFlow.exe "${q(dummy)}"
 SetOutPath "$INSTDIR\\resources"
 File /oname=app.asar "${q(dummy)}"
 WriteUninstaller "$INSTDIR\\Uninstall CanvasFlow.exe"
 WriteRegStr HKCU "${key}" InstallLocation "$INSTDIR"
SectionEnd
Section Uninstall
 SetOutPath "$TEMP"
 RMDir /r "$INSTDIR"
 DeleteRegKey HKCU "${key}"
SectionEnd
`);
  compile('new.nsi',`Unicode true
RequestExecutionLevel user
SilentInstall silent
!include "LogicLib.nsh"
!addincludedir "${q(includes)}"
!define INSTALL_REGISTRY_KEY "${key}"
!define UNINSTALL_REGISTRY_KEY "${key}"
!define UAC_IsInnerInstance '0 = 1'
Var PowerShellPath
!macro IS_POWERSHELL_AVAILABLE
 StrCpy $PowerShellPath "$SYSDIR\\WindowsPowerShell\\v1.0\\powershell.exe"
!macroend
!macro _CHECK_APP_RUNNING
!macroend
!include "${q(wrapper)}"
!define BUILD_UNINSTALLER
!include "${q(installerInclude)}"
!undef BUILD_UNINSTALLER
Function .onInit
 !insertmacro customInit
FunctionEnd
OutFile "${q(next)}"
InstallDir "${q(installed)}"
Section
 !insertmacro customCheckAppRunning
 CopyFiles /SILENT "$INSTDIR\\Uninstall CanvasFlow.exe" "${q(path.join(root,'run-old.exe'))}"
 ExecWait '"${q(path.join(root,'run-old.exe'))}" /S _?=$INSTDIR' $0
 SetOutPath "$INSTDIR"
 File /r "${q(stage)}\\*.*"
 WriteUninstaller "$INSTDIR\\Uninstall CanvasFlow.exe"
 !insertmacro customInstall
SectionEnd
Section Uninstall
 !insertmacro customRemoveFiles
SectionEnd
`);
  if (process.env.CANVASFLOW_NSIS_COMPILE_ONLY) {
    t.diagnostic('Both isolated NSIS fixture scripts compiled successfully. Native execution was not attempted.');
    t.skip('Compile-only run; full Windows installer execution still requires acceptance.');
    return;
  }
  // Give Windows time to finish scanning newly written fixture executables.
  await new Promise(resolve=>setTimeout(resolve,2000));
  ok(runFixture(old,['/S']));
  write(installed,'desktop-config.json','{"dataDirectory":"userdata/data"}');
  write(installed,'userdata/data/project.json','saved project');
  write(installed,'resources/runtime/custom.png','saved image');
  ok(runFixture(next,['/S']));
  assert.equal(fs.readFileSync(path.join(installed,'CanvasFlow.exe'),'utf8'),'new app');
  assert.equal(fs.readFileSync(path.join(installed,'userdata/data/project.json'),'utf8'),'saved project');
  assert.equal(fs.readFileSync(path.join(installed,'resources/runtime/custom.png'),'utf8'),'saved image');
  assert(fs.readdirSync(root).some(n=>n.includes('.CanvasFlow-upgrade-backup-')));
  write(installed,'desktop-config.json','{"dataDirectory":"resources/runtime"}');
  const uninstaller=path.join(root,'run-new.exe');
  fs.copyFileSync(path.join(installed,'Uninstall CanvasFlow.exe'),uninstaller);
  ok(runFixture(uninstaller,['/S',`_?=${installed}`]));
  assert(!fs.existsSync(path.join(installed,'CanvasFlow.exe')),'owned program is removed');
  assert(fs.existsSync(path.join(installed,'userdata/data/project.json')),'userdata is retained');
  assert(fs.existsSync(path.join(installed,'resources/runtime/custom.png')),'custom data under a program directory is retained');
  assert(fs.existsSync(path.join(installed,'resources/runtime/program.dll')),'configured internal data takes precedence over a package filename');
  // Prepare must fail BEFORE the legacy uninstaller can erase anything.
  ok(runFixture(old,['/S']));
  const outside=path.join(root,'outside'); write(outside,'important.txt','keep');
  fs.symlinkSync(outside,path.join(installed,'link'),'junction');
  assert.equal(runFixture(next,['/S']).status,2);
  assert.equal(fs.readFileSync(path.join(installed,'CanvasFlow.exe'),'utf8'),'old app');
  assert.equal(fs.readFileSync(path.join(installed,'userdata/data/project.json'),'utf8'),'saved project');
  assert.equal(fs.readFileSync(path.join(outside,'important.txt'),'utf8'),'keep');
});
