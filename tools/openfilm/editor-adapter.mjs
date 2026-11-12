// Use Studio's supported editorDir option, leaving the upstream package untouched.
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

// OpenFilm 0.3.2 MediaPool.bringFrom (upstream MediaPool.tsx): use its existing
// browser input for copies. The server-side PowerShell picker can return an empty
// selection without displaying a usable dialog in an embedded/local app. Opening
// the input before any await also preserves the click's browser user activation.
// Link-file/folder actions still use the upstream native picker; uploading,
// progress, cancellation, current folder and duplicate naming stay upstream-owned.
export function patchMediaImport(source) {
  const before = 'et=async(de,Pe,zt=re)=>{if(!T||!E){pt.current?.click();return}';
  const after = 'et=async(de,Pe,zt=re)=>{if((de==="copy"&&!Pe)||!T||!E){pt.current?.click();return}';
  if (source.split(before).length !== 2) {
    throw new Error('OpenFilm 媒体导入适配不匹配，请检查编辑器版本（需要 0.3.2）');
  }
  return source.replace(before, after);
}

// Narrow seams against the pinned upstream build. Keep native playback/editing,
// but use the host's one live canvas for every canvas-entry path (including keys).
export function patchHostCanvas(source) {
  const changes = [
    ['N5=e=>{try{return localStorage.getItem(`${h_}:${e}`)==="1"}',
     'N5=e=>{if(window.openfilmHost?.openCanvas)return!1;try{return localStorage.getItem(`${h_}:${e}`)==="1"}'],
    ['const Et=M.useCallback(k=>{if(!Fe.current){k&&Wt.current(),Ft(k);',
     'const Et=M.useCallback(k=>{if(!Fe.current){if(k&&window.openfilmHost?.openCanvas){Wt.current();window.openfilmHost.openCanvas();return}k&&Wt.current(),Ft(k);'],
    ['if(!We||Xe)return;let k=!0,', 'if(window.openfilmHost?.openCanvas||!We||Xe)return;let k=!0,'],
  ];
  for (const [before, after] of changes) {
    if (source.split(before).length !== 2) throw Error('OpenFilm 画布适配不匹配，请检查编辑器版本（需要 0.3.2）');
    source = source.replace(before, after);
  }
  return source;
}

export async function prepareEditor(home) {
  const source = fileURLToPath(new URL('./node_modules/openfilm/studio/ui/dist/', import.meta.url));
  const bootstrap = await readFile(new URL('./editor-bootstrap.js', import.meta.url), 'utf8');
  let savedLayout=null;
  try{savedLayout=JSON.parse(await readFile(join(home,'editor-layout.json'),'utf8'));}catch{}
  const restore=savedLayout?`try{localStorage.setItem('openfilm.workspace.current.v2',${JSON.stringify(JSON.stringify(savedLayout)).replaceAll('<','\\u003c')});localStorage.setItem('canvasflow.editor.layout.v1','1');}catch{}\n`:'';
  let page = await readFile(join(source, 'index.html'), 'utf8');
  const entry = page.match(/<script type="module"[^>]*src="\/assets\/([^"/]+\.js)"/);
  if (!entry) throw new Error('OpenFilm 编辑器入口缺失');
  const mediaEntry = patchHostCanvas(patchMediaImport(await readFile(join(source, 'assets', entry[1]), 'utf8')));
  // Keep the whole module graph together. Lazy chunks import React from the entry:
  // renaming only that entry would load a second React and break their hooks.
  const assets = await Promise.all((await readdir(join(source, 'assets'))).map(async file => ({
    file, bytes: file === entry[1] ? Buffer.from(mediaEntry) : await readFile(join(source, 'assets', file)),
  })));
  const assetHash = createHash('sha256');
  for (const asset of assets) assetHash.update(asset.file).update(asset.bytes);
  const namespace = `canvasflow-${assetHash.digest('hex').slice(0, 16)}`;
  const relocate = text => text.replace(/assets\/([\w.-]+)/g, (match, file) =>
    assets.some(asset => asset.file === file) ? `assets/${namespace}/${file}` : match);
  page = relocate(page);
  // Hashed filename: Studio serves /assets with an immutable cache policy.
  const hash = createHash('sha256').update(restore+bootstrap).digest('hex').slice(0, 16);
  const name = `canvasflow-layout-${hash}.js`;
  const target = join(home, 'editor-cache');
  await mkdir(join(target, 'assets'), {recursive: true});
  await mkdir(join(target, 'assets', namespace), {recursive:true});
  for (const {file, bytes} of assets) {
    await writeFile(join(target, 'assets', namespace, file), /\.(js|css)$/.test(file) ? relocate(bytes.toString('utf8')) : bytes);
  }
  await writeFile(join(target, 'assets', name), restore+bootstrap);
  await writeFile(join(target, 'index.html'), page.replace('<head>', `<head>\n<script src="/assets/${name}"></script>`));
  return target;
}
