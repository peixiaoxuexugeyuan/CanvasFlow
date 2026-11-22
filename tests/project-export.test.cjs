const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('app.js','utf8');
function readFunction(name) {
  const start = app.indexOf('    function '+name+'(');
  assert.notEqual(start,-1);
  return app.slice(start,app.indexOf('\n    }',start)+6);
}
test('the exported JSON preserves editable project data and omits account metadata',async()=>{
  const graph = {nodes:[{id:'node1'}],edges:[{id:'edge1'}],groups:[{id:'group1'}]};
  const state = {projectId:'p',projectName:'导出测试',projectDescription:'描述',zoom:.7,panX:12,panY:-10,
    advancedSettings:{seed:42},generationSettings:{duration:5},imageGenerationSettings:{ratio:'3:2'},
    modelPrompt:'详细描述',references:[{name:'r',assetId:'a1'}],jobBindings:[{jobId:'job1'}],projectOwnerId:'private-user-id'};
  let output, clicked = false;
  const context = {state,graphSnapshot:()=>graph,Blob,JSON,requireCurrentProject:()=>true,
    URL:{createObjectURL(blob){output=blob;return 'blob:test';}},document:{createElement:()=>({click(){clicked=true;}})},setTimeout(){},showToast(){}};
  vm.runInNewContext(readFunction('projectSnapshot')+'\n'+readFunction('exportProject')+'\nexportProject()',context);
  assert.equal(clicked,true);
  assert.deepEqual(JSON.parse(await output.text()),{
    projectId:'p',projectName:'导出测试',description:'描述',nodeCount:1,zoom:.7,panX:12,panY:-10,
    advancedSettings:state.advancedSettings,generationSettings:state.generationSettings,imageGenerationSettings:state.imageGenerationSettings,
    modelPrompt:state.modelPrompt,references:state.references,jobBindings:state.jobBindings,...graph});
});
