'use strict';
const path = require('node:path'), fs = require('node:fs');
const {build} = require('electron-builder');
const root=path.resolve(__dirname,'../..');
const version=require('./app/package.json').version;
process.env.ELECTRON_BUILDER_CACHE ||= path.join(root,'build-private/electron-builder-cache');
const input=path.resolve(process.argv[2] || path.join(root,`dist-v${version}/CanvasFlow-win32-x64`));
const output=path.resolve(process.argv[3] || path.join(root,`release-v${version}`));
if (!input.startsWith(root+path.sep) || !output.startsWith(root+path.sep)) throw Error('Release paths must be inside workspace');
if (fs.existsSync(path.join(input,'desktop-config.json'))) throw Error('Developer configuration cannot be distributed');
if (fs.existsSync(output) && fs.readdirSync(output).some(file=>/\.(?:exe|zip|7z)$/.test(file))) throw Error('Choose a fresh release output directory; an old NSIS archive must never be reused');
if (!fs.existsSync(path.join(input,'resources/app.asar'))) throw Error('Packaged desktop application is missing');
const stage=path.join(root,'build-private','package-stage-'+require('node:crypto').randomUUID());
fs.cpSync(input,stage,{recursive:true,filter:file=>!file.split(path.sep).includes('__pycache__') && !/\.(?:log|pyc)$/.test(file)});
const installerConfig=require('./windows-installer-config.cjs');
const safeInclude=require('./installer-data.cjs').prepareInstaller(stage);
build({prepackaged:stage,projectDir:path.join(__dirname,'app'),config:{...installerConfig,
  nsis:{...installerConfig.nsis,include:safeInclude},
  electronVersion:require('electron/package.json').version,directories:{output},publish:null}})
  .then(async files=>{
    const installer = path.join(output, `CanvasFlow-${version}-x64-Setup.exe`);
    const updateManifest = await require('./update-manifest.cjs').writeUpdateManifest(installer, version, output);
    console.log(JSON.stringify({version, files, updateManifest}));
  })
  .catch(error=>{console.error(error);process.exitCode=1;});
