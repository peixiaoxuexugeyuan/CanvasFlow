'use strict';
// Produces an unpacked, self-contained Windows desktop app. Never includes user data.
const fs = require('node:fs'), path = require('node:path');
const {spawnSync} = require('node:child_process');
const {packager} = require('@electron/packager');
const product = require('./app/product.cjs');
const version = require('./app/package.json').version;
const root = path.resolve(__dirname,'../..');
const out = path.resolve(process.argv[2] || path.join(root,`dist-v${version}`));
const appDir = path.join(out,'CanvasFlow-win32-x64');
const isDevelopment = process.argv.includes('--current-project');
const protectedBuild = process.argv.includes('--protect');
const nativeBackend = path.join(root,`build-private/native-v${version}/backend_entry.dist`);
const runtimePython = process.env.CANVASFLOW_PYTHON_RUNTIME || path.join(root,'.runtime/python');
const runtimeBlender = process.env.CANVASFLOW_BLENDER_RUNTIME || path.join(root,'.runtime/blender');
if (out === root || !out.startsWith(root + path.sep)) throw Error('Desktop output must be a new directory inside the workspace');
if (fs.existsSync(appDir)) throw Error('Output already exists; choose a new output directory rather than replacing a running app');
if (protectedBuild && !fs.existsSync(path.join(nativeBackend,'CanvasFlowBackend.exe'))) throw Error('Build the native backend first');
if (!protectedBuild && !fs.existsSync(path.join(runtimePython,'python.exe'))) throw Error('Bundled Python runtime missing');
if (!fs.existsSync(path.join(__dirname,'app/icon.ico'))) throw Error('Run make-icon.cjs first');
function copyRuntime(source, target) {
  fs.cpSync(source,target,{recursive:true,filter:file => !file.split(path.sep).includes('__pycache__') && !file.endsWith('.pyc')});
}
(async () => {
  fs.mkdirSync(out,{recursive:true});
  let appSource = path.join(__dirname,'app');
  if (protectedBuild) {
    appSource = path.join(out,'electron-stage');
    fs.cpSync(path.join(__dirname,'app'),appSource,{recursive:true});
    for (const file of fs.readdirSync(appSource).filter(x=>x.endsWith('.cjs'))) {
      const target = path.join(appSource,file);
      fs.writeFileSync(target,require('../release/protection.cjs')(fs.readFileSync(target,'utf8')));
    }
  }
  const outputs = await packager({dir:appSource,out,platform:'win32',arch:'x64',name:'CanvasFlow',
    electronVersion:require('electron/package.json').version,
    icon:path.join(__dirname,'app/icon.ico'),overwrite:false,prune:true,asar:true,
    appCopyright:'CanvasFlow',win32metadata:{CompanyName:'CanvasFlow',FileDescription:'CanvasFlow 本地创作工作台',ProductName:'CanvasFlow',InternalName:'CanvasFlow'},
    quiet:false});
  const target = outputs[0], resources = path.join(target,'resources'), backend = path.join(resources,'backend');
  fs.mkdirSync(backend);
  const build = spawnSync(process.execPath,[path.join(root,'tools/release/build.cjs'),backend,...(protectedBuild?['--protect']:[])],{cwd:root,stdio:'inherit'});
  if (build.status !== 0) throw Error('Backend release build failed');
  if (protectedBuild) {
    copyRuntime(nativeBackend,backend);
    // The Blender API adapter is kept as corresponding source; independent core is native.
    for (const file of fs.readdirSync(backend)) {
      if (file.endsWith('.py') && !['blender_worker.py','blender_protocol.py'].includes(file)) fs.unlinkSync(path.join(backend,file));
      if (['Start-CanvasFlow.cmd','README.md','LOCAL_APP.md','DESKTOP_APP.md','BLENDER_BRIDGE.md'].includes(file)) fs.unlinkSync(path.join(backend,file));
    }
    fs.copyFileSync(path.join(runtimePython,'LICENSE.txt'),path.join(backend,'PYTHON-LICENSE.txt'));
  } else {
    console.log('Copying bundled Python…');
    copyRuntime(runtimePython,path.join(resources,'python'));
  }
  console.log('Copying bundled Blender…');
  copyRuntime(runtimeBlender,path.join(backend,'.runtime/blender'));
  console.log('Copying OpenFilm editor, Agent adapters and rendering runtimes…');
  require('../openfilm/package-runtime.cjs').prepareRuntime(backend,{protect:protectedBuild});
  fs.writeFileSync(path.join(target,'使用说明.txt'),'CanvasFlow v'+require('./app/package.json').version+'\r\n双击 CanvasFlow.exe 启动。请保留整个应用目录。\r\n项目、供应商配置和素材保存在 %APPDATA%\\CanvasFlow\\data。\r\n退出后可复制该数据文件夹进行备份。\r\n');
  fs.copyFileSync(path.join(__dirname,'THIRD-PARTY-NOTICES.md'),path.join(target,'THIRD-PARTY-NOTICES.md'));
  if (isDevelopment) {
    fs.writeFileSync(path.join(target,'desktop-config.json'),JSON.stringify({backendDirectory:root,dataDirectory:path.join(root,'server-data'),port:5173,startupPath:'/'},null,2));
  }
  const report = {version:require('./app/package.json').version,electron:require('electron/package.json').version,shortcutName:product.shortcutName,
    executable:path.join(target,'CanvasFlow.exe'),selfContainedRuntime:true,developmentConfiguration:isDevelopment,
    dataBundled:false,protectedBuild,backendProtection:protectedBuild?'Nuitka native standalone':'source',builtAt:new Date().toISOString()};
  fs.writeFileSync(path.join(out,'desktop-build.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
})().catch(error => {console.error(error);process.exitCode=1;});
