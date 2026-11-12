'use strict';
// Per-user installer; uninstall/upgrade deliberately preserves local creative data.
const product = require('./app/product.cjs');
module.exports = {appId:product.appId, productName:product.name, executableName:product.name,
  artifactName:'CanvasFlow-${version}-${arch}-Setup.${ext}',
  win:{target:[{target:'nsis',arch:['x64']}],icon:require('node:path').join(__dirname,'app/icon.ico'),signAndEditExecutable:false},
  nsis:{oneClick:false,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:true,
    shortcutName:product.shortcutName,createDesktopShortcut:true,createStartMenuShortcut:true,
    deleteAppDataOnUninstall:false,runAfterFinish:false,include:require('node:path').join(__dirname,'installer.nsh')}};
