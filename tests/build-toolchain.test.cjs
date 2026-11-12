'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const desktop = createRequire(path.join(root, 'tools/desktop/package.json'));
const packager = createRequire(desktop.resolve('@electron/packager'));
const asar = packager('@electron/asar');
const asarDeps = createRequire(packager.resolve('@electron/asar'));

test('updated packaging dependencies preserve ASAR files, Unicode paths and binary data', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'canvasflow-toolchain-'));
  try {
    const input = path.join(temporary, 'source');
    await fs.mkdir(path.join(input, '嵌套目录'), {recursive: true});
    await fs.writeFile(path.join(input, 'package.json'), '{"name":"fixture","main":"main.cjs"}');
    await fs.writeFile(path.join(input, 'main.cjs'), 'module.exports = 42;');
    const bytes = Buffer.from([0, 1, 127, 128, 255]);
    await fs.writeFile(path.join(input, '嵌套目录', '素材.bin'), bytes);
    const archive = path.join(temporary, 'app.asar');
    await asar.createPackage(input, archive);
    assert.equal(asar.extractFile(archive, 'main.cjs').toString(), 'module.exports = 42;');
    assert.deepEqual(asar.extractFile(archive, '嵌套目录/素材.bin'), bytes);
    assert.equal(asar.listPackage(archive).filter(file => /素材\.bin$/.test(file)).length, 1);
  } finally {
    const resolved = path.resolve(temporary);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert(path.basename(resolved).startsWith('canvasflow-toolchain-'));
    await fs.rm(resolved, {recursive: true, force: true});
  }
});

test('packaging glob and minimatch retain the filtering API used by the packager', () => {
  const {minimatch, Minimatch} = asarDeps('minimatch');
  assert(minimatch('assets/界面/main.js', '**/*.js'));
  assert(!minimatch('server-data/projects.json', '**/*.js'));
  assert(new Minimatch('**/*.{cjs,json}').match('nested/main.cjs'));
  assert.equal(typeof asarDeps('glob').glob, 'function');
});

test('protected scripts preserve public globals after the build dependency security update', () => {
  const protect = require('../tools/release/protection.cjs');
  const source = 'window.CanvasFlowFixture = {name: "画布", sum: (a,b) => a+b};';
  const output = protect(source);
  const context = {window: {}};
  vm.runInNewContext(output, context, {timeout: 5000});
  assert.equal(context.window.CanvasFlowFixture.name, '画布');
  assert.equal(context.window.CanvasFlowFixture.sum(3, 7), 10);
  assert(!output.includes('sourceMappingURL'));
});
