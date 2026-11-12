import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname, basename, resolve} from 'node:path';
import {prepareEditor, patchMediaImport, patchHostCanvas} from '../tools/openfilm/editor-adapter.mjs';

test('prepared editor uses a separate content-hashed media entry and leaves upstream intact', async () => {
  const upstream = new URL('../tools/openfilm/node_modules/openfilm/studio/ui/dist/', import.meta.url);
  const page = await readFile(new URL('index.html', upstream), 'utf8');
  const entry = page.match(/<script type="module"[^>]*src="\/assets\/([^"/]+\.js)"/)[1];
  const original = await readFile(new URL(`assets/${entry}`, upstream), 'utf8');
  const home = await mkdtemp(join(tmpdir(), 'canvasflow-import-test-'));
  try {
    const dir = await prepareEditor(home);
    const preparedPage = await readFile(join(dir, 'index.html'), 'utf8');
    const output = preparedPage.match(/<script type="module"[^>]*src="\/assets\/([^" ]+\.js)"/)[1];
    const code = await readFile(join(dir, 'assets', output), 'utf8');
    assert.notEqual(output, entry); // immutable caches cannot retain the broken entry
    assert.match(output, new RegExp(`^canvasflow-[a-f0-9]{16}/${entry}$`));
    assert.equal(code.replace(/assets\/canvasflow-[a-f0-9]{16}\//g,'assets/'), patchHostCanvas(patchMediaImport(original)));
    assert.equal(await readFile(new URL(`assets/${entry}`, upstream), 'utf8'), original);
    // Lazy imports must resolve to the same entry/React instance, and preload
    // URLs must point into the same immutable asset graph.
    const namespace = output.split('/')[0];
    const lazyName = original.match(/\.\/(CanvasView-[\w-]+\.js)/)[1];
    const lazy = await readFile(join(dir,'assets',namespace,lazyName),'utf8');
    assert.ok(lazy.includes(`./${entry}`));
    assert.ok(code.includes(`assets/${namespace}/${lazyName}`));

    // Exercise the actual adapted bringFrom prefix, including its early-return
    // boundary: a copy must open the browser chooser before any awaited picker.
    const prefix = code.match(/et=async\(de,Pe,zt=re\)=>\{(.*?)Ft\(null\);const At=await T/)[1];
    let clicks = 0, native = 0;
    const run = new Function('pt', 'T', 'E', 're', `return async(de,Pe,zt=re)=>{${prefix}return T();}`)(
      {current:{click(){clicks++;}}}, () => {native++;return [];}, () => {}, 'assets');
    const pending = run('copy', false);
    assert.equal(clicks, 1);
    assert.equal(native, 0);
    await pending;
    await run('link', false);
    await run('link', true);
    assert.equal(clicks, 1);
    assert.equal(native, 2); // linking is not redirected to a browser upload
  } finally {
    assert.equal(dirname(resolve(home)), resolve(tmpdir()));
    assert.match(basename(home), /^canvasflow-import-test-/);
    await rm(home, {recursive:true, force:true});
  }
});

test('an upstream bundle change fails explicitly instead of silently shipping a broken import', () => {
  assert.throws(() => patchMediaImport('upgraded bundle'), /媒体导入适配不匹配/);
  assert.throws(() => patchHostCanvas('upgraded bundle'), /画布适配不匹配/);
});

test('native canvas entry pauses playback and calls the host instead of creating a second canvas', async () => {
  const root=new URL('../tools/openfilm/node_modules/openfilm/studio/ui/dist/',import.meta.url); const page=await readFile(new URL('index.html',root),'utf8'); const entry=page.match(/src="\/assets\/([^"]+\.js)"/)[1]; const source=await readFile(new URL('assets/'+entry,root),'utf8');
  const code = patchHostCanvas(source);
  const body = code.match(/const Et=M.useCallback\(k=>\{(.*?)\},\[e\]\);/)[1];
  const calls=[];
  const run=new Function('window','Fe','Wt','Ft','localStorage','h_','e',`return k=>{${body}}`)(
    {openfilmHost:{openCanvas(){calls.push('host');}}},{current:false},
    {current(){calls.push('pause');}},v=>calls.push(['native',v]),{setItem(){calls.push('storage');}},'key','p');
  run(true);
  assert.deepEqual(calls,['pause','host']);
  assert.ok(code.includes('if(window.openfilmHost?.openCanvas||!We||Xe)return'));
});
