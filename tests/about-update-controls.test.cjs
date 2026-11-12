'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../settings.js'), 'utf8');
const code = source.slice(source.indexOf('  function bindAboutUpdater('), source.indexOf('  async function renderAboutPane('));
const tick = () => new Promise(resolve=>setImmediate(resolve));
function harness(desktop = true) {
  const label={}, icon={}, hint={classList:{toggle(){}}}, button={classList:{toggle(){}},
    querySelector:selector=>selector==='[data-update-label]'?label:icon,
    addEventListener:(_name,fn)=>{button.click=fn;}};
  let publish, unsubscribed=false;
  const calls=[];
  const bridge={getUpdateState:async()=>({status:'idle'}),onUpdateStatus:fn=>{publish=fn;return()=>{unsubscribed=true;};},
    checkForUpdates:async()=>{calls.push('check');return {status:'available',version:'1.0.1'};},
    installUpdate:async()=>{calls.push('install');return {status:'ready',version:'1.0.1'};}};
  const pane={querySelector:selector=>selector==='[data-check-update]'?button:hint};
  const context=vm.createContext({window:{CanvasFlowDesktop:desktop?bridge:null}});
  vm.runInContext('let aboutUpdateCleanup=null;\n'+code+'\nglobalThis.bind=bindAboutUpdater;globalThis.dispose=()=>aboutUpdateCleanup();',context);
  context.bind(pane);
  return {button,label,hint,calls,bridge,publish:value=>publish(value),dispose:context.dispose,get unsubscribed(){return unsubscribed;}};
}
test('About update control checks then installs only the discovered version',async()=>{
  const h=harness();await tick();await h.button.click();
  assert.deepEqual(h.calls,['check']);assert.equal(h.label.textContent,'更新到 v1.0.1');
  await h.button.click();assert.deepEqual(h.calls,['check','install']);
});
test('progress, errors and disposal restore controls without leaking listeners',async()=>{
  const h=harness();await tick();
  h.publish({status:'downloading',progress:43});assert.equal(h.label.textContent,'更新中 43%');assert.equal(h.button.disabled,true);
  h.publish({status:'error',message:'连接失败'});assert.equal(h.button.disabled,false);assert.equal(h.hint.textContent,'连接失败');
  h.dispose();assert.equal(h.unsubscribed,true);
  h.publish({status:'installing'});assert.equal(h.label.textContent,'检查更新');
});
test('browser preview explains desktop-only installation instead of simulating an update',async()=>{
  const h=harness(false);await h.button.click();
  assert.match(h.hint.textContent,/Windows 安装版/);assert.equal(h.calls.length,0);
});
