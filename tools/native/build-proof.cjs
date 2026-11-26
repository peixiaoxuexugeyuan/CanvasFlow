'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

function sourceDigest(root) {
  const inputs = fs.readdirSync(root).filter(name => name.endsWith('.py')).concat([
    'tools/native/backend_entry.py', 'tools/native/build.ps1', 'tools/native/build-proof.cjs',
    'tools/native/requirements.txt', 'tools/desktop/app/package.json', 'tools/desktop/app/icon.ico'
  ]).sort();
  const hash = createHash('sha256');
  for (const name of inputs) {
    const contents = fs.readFileSync(path.join(root, name));
    hash.update(name + '\0' + contents.length + '\0').update(contents);
  }
  return hash.digest('hex');
}

function executableDigest(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function verify(root, exe, proof) {
  if (!proof || proof.source !== sourceDigest(root) || proof.executable !== executableDigest(exe)) {
    throw Error('Native backend is stale or incomplete. Run tools/native/build.ps1 and rebuild the desktop app.');
  }
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const [expected, output] = process.argv.slice(2);
  const source = sourceDigest(root);
  if (!expected) console.log(source);
  else {
    if (expected !== source) throw Error('Native inputs changed during compilation. Run tools/native/build.ps1 again.');
    const executable = executableDigest(path.join(output, 'backend_entry.dist', 'CanvasFlowBackend.exe'));
    fs.writeFileSync(path.join(output, 'native-proof.json'), JSON.stringify({source, executable}), {flag:'wx'});
  }
}
module.exports = {sourceDigest, executableDigest, verify};
