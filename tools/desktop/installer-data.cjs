'use strict';
// The uninstaller owns only files shipped in its package, never an installation directory.
const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_NAME = '.canvasflow-install-files.json';
function collectInstalledFiles(root) {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('Installer packages cannot contain filesystem links');
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push(path.relative(root, full).split(path.sep).join('/'));
      else throw Error('Unsupported installer file: ' + full);
    }
  }
  visit(root);
  return [...new Set([...files, MANIFEST_NAME, 'Uninstall CanvasFlow.exe'])].sort();
}
function safeRelative(file) {
  return typeof file === 'string' && file && !/[\x00-\x1f:*?"<>|]/.test(file)
    && !file.startsWith('/') && !file.includes('\\')
    && file.split('/').every(part => part && part !== '.' && part !== '..');
}
function nsisQuoted(value) { return String(value).replaceAll('$', '$$').replaceAll('"', '$\\"'); }
function removalInclude(files) {
  if (!Array.isArray(files) || files.some(file => !safeRelative(file))) throw Error('Unsafe installation file list');
  const dirs = new Set();
  for (const file of files) {
    let parent = path.posix.dirname(file);
    while (parent !== '.') { dirs.add(parent); parent = path.posix.dirname(parent); }
  }
  // GetFileAttributes rejects links in every ancestor before touching program files.
  const lines = ['!macro customRemoveFiles', '  !insertmacro CANVASFLOW_PREPARE_REMOVAL', '  SetOutPath "$TEMP"'];
  for (const file of files) {
    lines.push('  Push "' + nsisQuoted(file.replaceAll('/', '\\')) + '"', '  Call un.CanvasFlowRemoveOwnedFile');
  }
  for (const dir of [...dirs].sort((a,b) => b.split('/').length - a.split('/').length || b.localeCompare(a))) {
    lines.push('  Push "' + nsisQuoted(dir.replaceAll('/', '\\')) + '"', '  Call un.CanvasFlowRemoveEmptyDirectory');
  }
  lines.push('  Push "."', '  Call un.CanvasFlowRemoveEmptyDirectory', '!macroend');
  return lines.join('\r\n') + '\r\n';
}
function prepareInstaller(stage) {
  const files = collectInstalledFiles(stage);
  fs.writeFileSync(path.join(stage, MANIFEST_NAME), JSON.stringify({version:1, files}, null, 2));
  // Build-only include files must stay outside the package being installed.
  const include = path.join(path.dirname(stage), path.basename(stage) + '-remove.nsh');
  const wrapper = path.join(path.dirname(stage), path.basename(stage) + '-installer.nsh');
  fs.writeFileSync(include, removalInclude(files));
  fs.writeFileSync(wrapper, [
    '!define CANVASFLOW_UPGRADE_HELPER "' + nsisQuoted(path.join(__dirname, 'preserve-upgrade-data.ps1')) + '"',
    '!define CANVASFLOW_PACKAGE_MANIFEST "' + nsisQuoted(path.join(stage, MANIFEST_NAME)) + '"',
    '!include "' + nsisQuoted(include) + '"',
    '!include "' + nsisQuoted(path.join(__dirname, 'installer.nsh')) + '"', ''
  ].join('\r\n'));
  return wrapper;
}
module.exports = {MANIFEST_NAME, collectInstalledFiles, safeRelative, removalInclude, prepareInstaller};
