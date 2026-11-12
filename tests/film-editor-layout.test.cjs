const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bootstrap = fs.readFileSync(path.join(__dirname, '../tools/openfilm/editor-bootstrap.js'), 'utf8');
const key = 'openfilm.workspace.current.v2';
function boot(values = new Map()) {
  vm.runInNewContext(bootstrap, {localStorage: {
    getItem: name => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
  }});
  return values;
}
test('native panel tree includes every editor panel once and keeps timeline below both library and viewer', () => {
  const layout = JSON.parse(boot().get(key));
  const panels = [];
  const visit = tree => tree.panel ? panels.push(tree.panel) : (visit(tree.first), visit(tree.second));
  visit(layout.edit.tree);
  assert.deepEqual(panels.sort(), ['chat','inspector','layers','library','timeline','viewer']);
  const body = layout.edit.tree.second;
  assert.equal(body.axis, 'y');
  assert.equal(body.second.panel, 'timeline');
  assert.equal(body.first.first.panel, 'library');
  assert.equal(layout.edit.assets, true);
  assert.equal(layout.edit.inspector, false);
  assert.equal(layout.canvas.mode, 'canvas');
});
test('initial migration keeps old layout and never overrides later manual layout choices or language', () => {
  const values = boot(new Map([[key, '{"old":true}'], ['openfilm.language', 'en']]));
  assert.equal(values.get('canvasflow.editor.previousLayout'), '{"old":true}');
  values.set(key, '{"custom":true}');
  boot(values);
  assert.equal(values.get(key), '{"custom":true}');
  assert.equal(values.get('openfilm.language'), 'en');
});
test('restricted browser storage does not prevent opening the editor', () => {
  assert.doesNotThrow(() => vm.runInNewContext(bootstrap, {localStorage: {
    getItem() { throw new Error('storage denied'); },
  }}));
});
test('embedded editor reports project changes without exposing session query parameters', () => {
  const messages=[];
  const location={pathname:'/projects/first',search:'?key=private'};
  let tick;
  const window={parent:{postMessage:data=>messages.push(JSON.parse(JSON.stringify(data)))}};
  vm.runInNewContext(bootstrap,{
    window,location,
    setInterval:fn=>{tick=fn;},localStorage:{getItem:()=> 'already-set'},
  });
  assert.deepEqual(messages[0],{type:'canvasflow-film-project',projectId:'first',clip:null,layout:null});
  window.openfilmHost.onSelection({projectId:'first',refs:[{kind:'clip',id:'clip-1',label:'Shot'}]});
  assert.equal(messages.at(-1).clip.id,'clip-1');
  location.pathname='/projects/second'; tick();
  assert.equal(messages.at(-1).projectId,'second');
  assert.equal(messages.at(-1).clip,null);
  window.openfilmHost.onSelection({projectId:'first',refs:[{kind:'clip',id:'late-old-clip'}]});
  tick();
  assert.equal(messages.length,3); // a late callback cannot leak the previous film's selection
  assert.equal(JSON.stringify(messages).includes('private'),false);
});

test('native selection and layout changes sync once without idle or playback message churn', () => {
  const messages=[], values=new Map([[key,'{"version":2}']]);
  const window={parent:{postMessage:data=>messages.push(JSON.parse(JSON.stringify(data)))}};
  let tick;
  vm.runInNewContext(bootstrap, {window,location:{pathname:'/projects/film'},
    setInterval:fn=>{tick=fn;},localStorage:{getItem:name=>name===key?values.get(key):'set'}});
  assert.deepEqual(messages[0].layout,{version:2});
  for(let i=0;i<20;i++)tick();
  assert.equal(messages.length,1);
  const select=(refs,time=0)=>window.openfilmHost.onSelection({projectId:'film',refs,time});
  select([{kind:'clip',id:'clip-1'}]);
  for(let i=0;i<20;i++)select([{kind:'clip',id:'clip-1'}],i);
  assert.equal(messages.length,2);
  select([]); // native keyboard deselection/deletion: clear immediately
  assert.equal(messages.at(-1).clip,null);
  select([{kind:'clip',id:'clip-1'}]); // undo can restore the selection
  assert.equal(messages.at(-1).clip.id,'clip-1');
  values.set(key,'{"version":2,"custom":true}');tick();tick();
  assert.equal(messages.length,5);
  assert.deepEqual(messages.at(-1).layout,{version:2,custom:true});
});

test('native host forwards clip references and skill requests with the current project identity', () => {
  const messages=[],window={parent:{postMessage:data=>messages.push(JSON.parse(JSON.stringify(data)))}};
  vm.runInNewContext(bootstrap,{window,location:{pathname:'/projects/host-fixture'},document:{addEventListener(){}},setInterval(){},localStorage:{getItem:()=> 'set'}});
  window.openfilmHost.refer({kind:'clip',id:'fixture',label:'Shot'});
  window.openfilmHost.useSkill({uid:'edit'});
  assert.equal(window.openfilmHost.name,'CanvasFlow');
  assert.deepEqual(messages[1],{type:'canvasflow-film-host',event:'reference',projectId:'host-fixture',ref:{kind:'clip',id:'fixture',label:'Shot'}});
  assert.equal(messages[2].event,'skill');
  assert.equal(messages[2].skill.uid,'edit');
});
