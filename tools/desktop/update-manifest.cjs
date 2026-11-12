'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {UPDATE_ORIGIN, validateManifest} = require('./app/updater.cjs');

async function writeUpdateManifest(installer, version, output) {
  const name = `CanvasFlow-${version}-x64-Setup.exe`;
  if (path.basename(installer) !== name) throw Error('更新清单必须对应当前版本的正式安装包');
  const stat = await fs.promises.stat(installer);
  const hash = crypto.createHash('sha256');
  for await (const bytes of fs.createReadStream(installer)) hash.update(bytes);
  const manifest = {schemaVersion:1, version, platform:'win32', arch:'x64',
    url:`${UPDATE_ORIGIN}/downloads/${name}`, size:stat.size, sha256:hash.digest('hex'), publishedAt:new Date().toISOString()};
  validateManifest(manifest);
  const target = path.join(output, 'latest.json');
  await fs.promises.writeFile(target, JSON.stringify(manifest, null, 2) + '\n', {flag:'wx'});
  return target;
}
module.exports = {writeUpdateManifest};
