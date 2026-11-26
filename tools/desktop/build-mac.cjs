'use strict';
// Produces an unpacked, self-contained macOS desktop app (CanvasFlow.app) plus a zip. Never includes user data.
// The Windows build (build.cjs) is left untouched; this script only runs on macOS.
//
//   node tools/desktop/build-mac.cjs [output-dir] [--x64] [--no-zip]
//
// Bundled Python: a relocatable CPython 3.10+ tree with bin/python3 (python-build-standalone layout).
//   CANVASFLOW_PYTHON_RUNTIME=/path/to/python  (default: .runtime/python-mac)
// Optional runtimes are copied when present and skipped with a notice otherwise:
//   .runtime/blender-mac            → bundled Blender
//   .runtime/{node,openfilm-*}      → OpenFilm editor runtimes (the film workbench needs macOS builds of these)
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {spawnSync} = require('node:child_process');
const {packager} = require('@electron/packager');
const product = require('./app/product.cjs');
const manifest = require('./app/package.json');
const version = manifest.version;
const root = path.resolve(__dirname, '../..');
const flags = process.argv.slice(2).filter(arg => arg.startsWith('--'));
const arch = flags.includes('--x64') ? 'x64' : flags.includes('--arm64') ? 'arm64' : process.arch;
const out = path.resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || path.join(root, `dist-v${version}-mac`));
const appDir = path.join(out, `CanvasFlow-darwin-${arch}`);
const runtimePython = process.env.CANVASFLOW_PYTHON_RUNTIME || path.join(root, '.runtime/python-mac');
const runtimeBlender = process.env.CANVASFLOW_BLENDER_RUNTIME || path.join(root, '.runtime/blender-mac');

if (process.platform !== 'darwin') throw Error('build-mac.cjs must run on macOS');
if (!['arm64', 'x64'].includes(arch)) throw Error('Unsupported architecture: ' + arch);
if (out === root || !out.startsWith(root + path.sep)) throw Error('Desktop output must be a new directory inside the workspace');
if (fs.existsSync(appDir)) throw Error('Output already exists; choose a new output directory rather than replacing a running app');
const pythonBinary = path.join(runtimePython, 'bin', 'python3');
if (!fs.existsSync(pythonBinary)) throw Error('Bundled Python runtime missing: expected ' + pythonBinary);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {stdio: 'inherit', ...options});
  if (result.status !== 0) throw Error(`${command} ${args.join(' ')} failed`);
}
function pythonReports(code) {
  const result = spawnSync(pythonBinary, ['-c', code], {encoding: 'utf8'});
  if (result.status !== 0) throw Error('Bundled Python does not run on this Mac: ' + (result.stderr || '').trim());
  return result.stdout.trim();
}
// Tests, IDLE, Tk and caches are not used by the backend (standard library only).
const SKIP_PYTHON = new Set(['__pycache__', 'test', 'tests', 'idlelib', 'tkinter', 'turtledemo', 'share', 'include']);
function copyRuntime(source, target, skip = new Set(['__pycache__'])) {
  // Only path parts below the runtime root are tested, so a parent folder named "share" or "test" cannot empty the copy.
  fs.cpSync(source, target, {recursive: true, verbatimSymlinks: true,
    filter: file => !path.relative(source, file).split(path.sep).some(part => skip.has(part) || /^(tcl|tk|itcl|thread)\d/.test(part) || part.startsWith('libtcl') || part.startsWith('libtk')) && !file.endsWith('.pyc')});
}
function makeIcon(target) {
  const iconset = fs.mkdtempSync(path.join(os.tmpdir(), 'canvasflow-icon-')) + '.iconset';
  fs.mkdirSync(iconset);
  const source = path.join(__dirname, 'app/icon.png');
  for (const size of [16, 32, 128, 256, 512]) {
    run('sips', ['-z', String(size), String(size), source, '--out', path.join(iconset, `icon_${size}x${size}.png`)], {stdio: 'ignore'});
    run('sips', ['-z', String(size * 2), String(size * 2), source, '--out', path.join(iconset, `icon_${size}x${size}@2x.png`)], {stdio: 'ignore'});
  }
  run('iconutil', ['-c', 'icns', iconset, '-o', target]);
  fs.rmSync(iconset, {recursive: true, force: true});
}

(async () => {
  const pythonVersion = pythonReports('import sys,platform;assert sys.version_info>=(3,10);print(platform.python_version(), platform.machine())');
  const pythonArch = pythonVersion.split(' ')[1] === 'x86_64' ? 'x64' : 'arm64';
  if (pythonArch !== arch) throw Error(`Bundled Python is ${pythonArch} but the app is being built for ${arch}`);
  fs.mkdirSync(out, {recursive: true});
  const icon = path.join(out, 'CanvasFlow.icns');
  makeIcon(icon);
  const outputs = await packager({dir: path.join(__dirname, 'app'), out, platform: 'darwin', arch, name: product.name,
    electronVersion: require('electron/package.json').version,
    overwrite: false, prune: true, asar: true,
    appBundleId: 'xyz.canvasflow.desktop', appCategoryType: 'public.app-category.graphics-design',
    appCopyright: 'CanvasFlow', quiet: false});
  const target = outputs[0], bundle = path.join(target, `${product.name}.app`);
  const resources = path.join(bundle, 'Contents', 'Resources'), backend = path.join(resources, 'backend');
  // The packager keeps Electron's default icon file name; replace its contents with the CanvasFlow icon.
  fs.copyFileSync(icon, path.join(resources, 'electron.icns'));
  fs.rmSync(icon);
  fs.mkdirSync(backend);
  run(process.execPath, [path.join(root, 'tools/release/build.cjs'), backend], {cwd: root});
  console.log('Copying bundled Python…');
  copyRuntime(runtimePython, path.join(resources, 'python'), SKIP_PYTHON);
  const bundledPython = path.join(resources, 'python', 'bin', 'python3');
  if (spawnSync(bundledPython, ['-c', 'import ssl, sqlite3, json, http.server'], {stdio: 'ignore'}).status !== 0) throw Error('Bundled Python was copied but does not start: ' + bundledPython);
  const skipped = [];
  if (fs.existsSync(runtimeBlender)) { console.log('Copying bundled Blender…'); copyRuntime(runtimeBlender, path.join(backend, '.runtime/blender')); }
  else skipped.push('Blender (install Blender.app separately, or provide .runtime/blender-mac)');
  const filmRuntimes = ['node', 'openfilm-browser', 'openfilm-ffmpeg']; // system git is used on macOS
  if (filmRuntimes.every(folder => fs.existsSync(path.join(root, '.runtime', folder)))) {
    console.log('Copying OpenFilm editor, Agent adapters and rendering runtimes…');
    require('../openfilm/package-runtime.cjs').prepareRuntime(backend, {protect: false});
  } else skipped.push('OpenFilm film workbench runtimes (.runtime/' + filmRuntimes.join(', .runtime/') + ')');
  fs.writeFileSync(path.join(target, '使用说明.txt'), `CanvasFlow v${version}（macOS ${arch}）\n`
    + '把 CanvasFlow.app 拖进「应用程序」后双击启动。\n'
    + '第一次打开如果提示「无法验证开发者」：在 访达 里右键 CanvasFlow.app → 打开 → 再点「打开」。\n'
    + '项目、供应商配置和素材保存在 ~/Library/Application Support/CanvasFlow/data。\n'
    + '退出后可复制该数据文件夹进行备份。\n'
    + (skipped.length ? '\n这一版没有随包带上：\n- ' + skipped.join('\n- ') + '\n' : ''));
  fs.copyFileSync(path.join(__dirname, 'THIRD-PARTY-NOTICES.md'), path.join(target, 'THIRD-PARTY-NOTICES.md'));
  // Everything that lives inside the bundle must be written before signing; a later write breaks the seal.
  fs.writeFileSync(path.join(resources, 'canvasflow-build.json'), JSON.stringify({version, buildNumber: manifest.buildNumber, platform: 'darwin', arch}, null, 2));
  // Files were added after packaging, so the bundle must be re-signed. Ad-hoc signing is enough to run locally;
  // distribution without the Gatekeeper prompt needs a Developer ID certificate and notarization.
  console.log('Signing (ad-hoc)…');
  run('codesign', ['--force', '--deep', '--sign', '-', bundle]);
  run('codesign', ['--verify', '--deep', bundle]);
  let archive = null;
  if (!flags.includes('--no-zip')) {
    archive = path.join(out, `CanvasFlow-${version}-mac-${arch}.zip`);
    console.log('Zipping…');
    run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', bundle, archive]);
  }
  const report = {version, buildNumber: manifest.buildNumber, platform: 'darwin', arch, electron: require('electron/package.json').version,
    python: pythonVersion, app: bundle, archive, selfContainedRuntime: true, dataBundled: false, protectedBuild: false,
    signing: 'ad-hoc', skipped, builtAt: new Date().toISOString()};
  fs.writeFileSync(path.join(out, 'desktop-build-mac.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
