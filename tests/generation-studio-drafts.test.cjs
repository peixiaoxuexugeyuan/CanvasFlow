const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const test = require('node:test'), assert = require('node:assert/strict');
const acorn = require('../tools/release/node_modules/acorn');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
let mount;
function visit(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'FunctionDeclaration' && n.id.name === 'mountGenerationStudio') mount = source.slice(n.start, n.end);
  for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v);
}
visit(acorn.parse(source, {ecmaVersion:'latest'}));
function fixture() {
  const element = () => ({value:'', hidden:false, events:{}, addEventListener(k, fn) {this.events[k] = fn;}});
  const c = {navigationEpoch:0, generationStudioDrafts:new Map(), workspace:'A',
    workspaceHeader:()=>({'X-Workspace-Id':c.workspace}), api:()=>new Promise(()=>{}), loadModelSpecs:()=>new Promise(()=>{}),
    window:{addEventListener(){}, removeEventListener(){}}, clearTimeout(){}};
  vm.createContext(c); vm.runInContext(mount,c);
  function open(kind, workspace=c.workspace) {
    c.unmountGenerationStudio?.(); c.navigationEpoch++; c.workspace=workspace;
    const prompt=element(), model=element(), reference=element(), field=element();
    reference.closest=()=>field;
    const form=element();form.elements={prompt,model,reference};form.querySelector=()=>element();
    const host={hidden:false, innerHTML:'',querySelector:s=>s==='.studio-form'?form:element()};
    c.mountGenerationStudio(host,kind);
    return {prompt, host, type(text){prompt.value=text;prompt.events.input();}};
  }
  return {c,open};
}
test('long prompts survive image/video navigation independently',()=>{
  const f=fixture(), a=f.open('image'), long='场景/动作'.repeat(2000);
  a.type(long);f.open('video').type('视频草稿');
  assert.equal(f.open('image').prompt.value,long);
  assert.equal(f.open('video').prompt.value,'视频草稿');
});
test('drafts are isolated per workspace, including empty edits and markup text',()=>{
  const f=fixture();f.open('image','A').type('<img src=x onerror=alert(1)>');
  assert.equal(f.open('image','B').prompt.value,'');f.open('image','B').type('B');
  const a=f.open('image','A');assert.equal(a.prompt.value,'<img src=x onerror=alert(1)>');
  assert.ok(!a.host.innerHTML.includes('onerror=alert'));a.type('');
  assert.equal(f.open('image','B').prompt.value,'B');assert.equal(f.open('image','A').prompt.value,'');
});
test('unmount also captures a pending input value without a delivered input event',()=>{
  const f=fixture();f.open('video').prompt.value='pending';
  f.open('image');assert.equal(f.open('video').prompt.value,'pending');
});
