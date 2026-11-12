const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function fixture(models=[{id:'scene',enabled:true,supportsScene:true}]){
 const calls=[],state={projectId:'canvas'},context={state,window:{CanvasFlowDirectorModels:async()=>models},textModelId:()=> 'global-text',api:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return url.includes('image-to-text')?{description:'an actor'}:{text:'{"objects":[]}'};}};
 vm.createContext(context);vm.runInContext(source.match(/window\.CanvasFlowDirectorBuildScene = async [\s\S]*?\n    \};/)[0],context);
 return {calls,state,context,run:context.window.CanvasFlowDirectorBuildScene};
}
test('previs reasoning and reference analysis use the selected model without changing global text selection',async()=>{
 const f=fixture();await f.run({prompt:'move actor',scene:[],referenceImage:'test-image',modelId:'scene',previs:true});
 assert.equal(f.calls.length,2);assert.equal(f.calls[0].body.modelId,'scene');assert.equal(f.calls[1].body.modelId,'scene');assert.match(f.calls[1].body.prompt,/an actor/);
 assert.match(f.calls[0].body.instruction,/箭头/);assert.match(f.calls[0].body.instruction,/不要把它当作场景中的实体/);assert.equal(f.calls[0].body.image,'test-image');
});
test('unchecked, disabled and nontext models are rejected before any paid request',async()=>{
 for(const models of [[],[{id:'scene',enabled:false,supportsScene:true}],[{id:'scene',enabled:true,supportsScene:false}]]){
  const f=fixture(models);await assert.rejects(f.run({prompt:'test',scene:[],modelId:'scene',previs:true}));assert.equal(f.calls.length,0);
 }
});
test('canvas changes during model lookup cannot submit reference or generation requests',async()=>{
 const f=fixture();f.context.window.CanvasFlowDirectorModels=async()=>{f.state.projectId='other';return [{id:'scene',enabled:true,supportsScene:true}];};
 await assert.rejects(f.run({prompt:'test',scene:[],referenceImage:'image',modelId:'scene',previs:true}),/画布已切换/);assert.equal(f.calls.length,0);
});
