'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const settings = fs.readFileSync(path.join(__dirname, '../settings.js'), 'utf8');
const source = settings.slice(settings.indexOf('  function releaseNotesMarkup('), settings.indexOf('  async function renderAboutPane('));

function harness({pending = true, desktop = true, animation = true, failOpen = false} = {}) {
  const counts = {info:0, shown:0, marked:0, removed:0}, listeners = new Map();
  let changed, dialogClose;
  const dialog = {
    open:false, querySelectorAll:()=>[],
    addEventListener(name, fn) {if(name === 'close') dialogClose = fn;},
    showModal() {if(failOpen) throw Error('cannot open'); this.open = true; counts.shown++;},
    close() {this.open = false; dialogClose?.();}
  };
  const host = {querySelector:()=>dialog, remove(){counts.removed++;}};
  const root = {dataset:{}, classList:{contains:()=>false}};
  const document = {documentElement:root, visibilityState:'visible', body:{append(){}},
    createElement:()=>host, addEventListener:(n,fn)=>listeners.set(n,fn), removeEventListener:n=>listeners.delete(n)};
  const window = {CanvasFlowStartup:{isPlaying:()=>animation},
    addEventListener:(n,fn)=>listeners.set(n,fn), removeEventListener:n=>listeners.delete(n)};
  if(desktop) window.CanvasFlowDesktop = {
    getInfo:async()=>{counts.info++; return {version:'1.0.0', releaseNotesPending:pending};},
    markReleaseNotesShown:async version=>{assert.equal(version, '1.0.0'); assert.equal(dialog.open, true); counts.marked++;}
  };
  const context = vm.createContext({window, document, esc:value=>String(value),
    console:{warn(){}}, MutationObserver:class {constructor(fn){changed=fn;} observe(){} disconnect(){}}});
  vm.runInContext(source + '\nglobalThis.schedule = scheduleReleaseNotes;', context);
  return {counts, dialog, host, document, listeners, schedule:context.schedule,
    ready(){root.dataset.canvasflowReady='true';changed?.();},
    finishAnimation(){animation=false;changed?.();}};
}
const tick = () => new Promise(resolve=>setImmediate(resolve));

test('startup notice waits for canvas readiness and animation, then opens and records once', async()=>{
  const h = harness(); h.schedule(); h.ready(); await tick();
  assert.equal(h.counts.shown, 0);
  h.finishAnimation(); await tick();
  assert.equal(h.counts.shown, 1); assert.equal(h.counts.marked, 1);
  h.schedule(); h.ready(); await tick();
  assert.equal(h.counts.shown, 1);
  assert.match(h.host.innerHTML, /v1\.0\.0/);
  let intercepted = false;
  h.listeners.get('keydown')({key:'Escape', preventDefault(){}, stopImmediatePropagation(){intercepted=true;}});
  assert.equal(intercepted, true); assert.equal(h.counts.removed, 1);
  assert.equal(h.listeners.has('keydown'), false);
});

test('seen version, ordinary browser, and failed opening do not acknowledge a new display', async()=>{
  for (const options of [{pending:false}, {desktop:false}, {failOpen:true}]) {
    const h = harness({...options, animation:false}); h.schedule(); h.ready(); await tick();
    assert.equal(h.counts.shown, 0); assert.equal(h.counts.marked, 0);
    if(options.failOpen) assert.equal(h.counts.removed, 1);
  }
});

test('hidden application defers notice until its window is visible', async()=>{
  const h = harness({animation:false}); h.document.visibilityState='hidden';
  h.schedule(); h.ready(); await tick(); assert.equal(h.counts.shown, 0);
  h.document.visibilityState='visible'; h.listeners.get('visibilitychange')(); await tick();
  assert.equal(h.counts.shown, 1); assert.equal(h.counts.marked, 1);
});
