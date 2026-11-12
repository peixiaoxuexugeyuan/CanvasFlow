const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const start=source.indexOf('function agentCanvasPayload()');
const end=source.indexOf('function agentApplyEffects(',start);
test('an unsaved empty canvas does not send a nonexistent project ID to Agent; saved canvas keeps its ID',()=>{
  assert.ok(start>=0 && end>start);
  const state={projectIsDraft:true,projectId:'draft-not-on-server'};
  const context=vm.createContext({state,$$:()=>[],stage:{},window:{}});
  vm.runInContext(source.slice(start,end),context);
  assert.equal(vm.runInContext('agentCanvasPayload().projectId',context),'');
  state.projectIsDraft=false; state.projectId='saved-project';
  assert.equal(vm.runInContext('agentCanvasPayload().projectId',context),'saved-project');
});
