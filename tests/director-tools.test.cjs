const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {scenePlan,watchJob}=require('../director-tools.js');
test('AI scene validates object types, clamps transforms and ignores executable fields',()=>{
 const plan=scenePlan('```json\n'+JSON.stringify({objects:[{kind:'character',name:'演员',bodyType:'female',pose:'思考',position:[-1000,2,Infinity],scale:[-1,100,1],color:'#abcdef',execute:'deleteEverything()'}]})+'\n```');
 assert.deepEqual(plan.objects[0].position,[-100,2,0]);assert.deepEqual(plan.objects[0].scale,[.05,20,1]);assert.equal(plan.objects[0].pose,'思考');assert.equal(plan.objects[0].execute,undefined);
 assert.throws(()=>scenePlan({objects:[{kind:'script'}]}));assert.throws(()=>scenePlan({objects:Array(31).fill({kind:'geometry'})}));
});
test('image job survives transient read errors and returns the server result, with no fabricated progress',async()=>{
 let n=0;const progress=[];
 const result=await watchJob('job',async()=>{n++;if(n===2)throw Error('offline');return n<4?{status:'running',progress:null}:{status:'completed',imageUrl:'/media/result.png'};},{delay:async()=>{},onProgress:j=>progress.push(j.progress)});
 assert.equal(result.imageUrl,'/media/result.png');assert.deepEqual(progress,[null,null,undefined]);
});
test('failed and malformed completed jobs expose errors instead of creating placeholder images',async()=>{
 await assert.rejects(watchJob('j',async()=>({status:'failed',error:'供应商拒绝请求'})),/供应商拒绝请求/);
 await assert.rejects(watchJob('j',async()=>({status:'completed'})),/没有返回图片/);
});
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function adapter(name,extra={}){
 const calls=[],output={dataset:{nodeId:'result'},querySelector:()=>({classList:{add(){},remove(){}}})},state={projectId:'origin'};
 const context={window:{},state,addNode:()=>{calls.push('node');return output;},applyNodeAspectSizing:()=>{},api:async(url,options)=>{calls.push({url,payload:JSON.parse(options.body)});return {jobId:'job',job:{status:'queued'}};},scheduleSave:()=>calls.push('save'),...extra};
 context.specRowsFor=()=>[{key:'aspectRatio',options:[{value:'2:1'}]}];context.specRowOf=(rows,key)=>rows.find(row=>row.key===key);context.specRowValues=row=>(row?.options||[]).map(o=>o.value);
 vm.createContext(context);vm.runInContext(source.match(/function panoramaModelSize\(model\)\{[\s\S]*?\n    \}/)[0],context);vm.runInContext(source.match(new RegExp('window\\.'+name+' = async [\\s\\S]*?\\n    \\};'))[0],context);
 return {context,calls,output,state,run:context.window[name]};
}
test('panorama adapter submits a real durable job with origin canvas, output node and reference',async()=>{
 const a=adapter('CanvasFlowDirectorSubmitPanorama');const result=await a.run({referenceImage:'data:image/png;base64,x',model:{id:'model',projectId:'origin'},node:{dataset:{nodeId:'director'},style:{}}});
 const request=a.calls.find(x=>x.url);assert.equal(request.url,'/api/ai/image-generate');assert.equal(request.payload.presetScene,'720_panoramic');assert.equal(request.payload.asyncTask,true);assert.equal(request.payload.projectId,'origin');assert.equal(request.payload.outputId,'result');assert.equal(request.payload.referenceImage,'data:image/png;base64,x');assert.equal(result.jobId,'job');assert.equal(a.output.dataset.jobId,'job');assert.equal(a.calls.at(-1),'save');
});
test('panorama cannot submit to a different canvas or without a reference',async()=>{
 const a=adapter('CanvasFlowDirectorSubmitPanorama');await assert.rejects(a.run({referenceImage:'x',model:{projectId:'other'}}),/画布已切换/);await assert.rejects(a.run({referenceImage:'',model:{projectId:'origin'}}),/先上传/);assert.deepEqual(a.calls,[]);
});
test('submission failure persists a failed result node and permits a retry',async()=>{
 const a=adapter('CanvasFlowDirectorSubmitPanorama',{api:async()=>{throw Error('配额不足');}});await assert.rejects(a.run({referenceImage:'x',model:{projectId:'origin'},node:{style:{}}}),/配额不足/);assert.equal(a.output.dataset.jobStatus,'failed');assert.equal(a.calls.at(-1),'save');
});
test('panorama pricing comes from the selected model and token billing is not presented as free',async()=>{
 const a=adapter('CanvasFlowDirectorPanoramaModel',{loadI2tModels:async()=>{},t2iModelId:()=> 'paid'});
 a.state.t2iModels=[{id:'paid',name:'模型',billing:'per-call',pricing:{perCall:3.2}}];assert.equal((await a.run()).cost,3.2);
 a.state.t2iModels[0].billing='per-token';assert.equal((await a.run()).cost,'按用量');
 a.state.t2iModels=[];await assert.rejects(a.run(),/配置并启用/);
});
test('panorama model lookup cannot return configuration from a newly selected canvas',async()=>{
 let a;a=adapter('CanvasFlowDirectorPanoramaModel',{loadI2tModels:async()=>{a.state.projectId='other';},t2iModelId:()=> 'paid'});await assert.rejects(a.run(),/画布已切换/);
});

test('local scene planning remains available without a platform balance, including image analysis',async()=>{
 const a=adapter('CanvasFlowDirectorSceneQuote',{textModelId:()=> 'local',getGenerationQuote:async()=>({local:true,amount:0,requiredBalance:0,balance:0,canAfford:true})});
 a.context.window.DirectorSceneAgent={request:()=> 'fixture instructions'};
 for(const referenceImage of ['', 'fixture']){const quote=await a.run({project:{},referenceImage});assert.equal(quote.canAfford,true);assert.equal(quote.requiredBalance,0);}
});
test('panorama choices include only the image-generation registry and never change the global choice',async()=>{
 let selected='image-a';const a=adapter('CanvasFlowDirectorPanoramaModel',{loadI2tModels:async()=>{},t2iModelId:()=>selected});
 a.state.t2iModels=[{id:'image-a',name:'A',billing:'per-call',pricing:{perCall:2}},{id:'image-b',name:'B',billing:'per-call',pricing:{perCall:7}}];a.state.videoModels=[{id:'video'}];a.state.audioModels=[{id:'audio'}];
 const result=await a.run();assert.deepEqual(Array.from(result.models,item=>item.id),['image-a','image-b']);assert.equal(result.id,'image-a');assert.equal(selected,'image-a');assert.equal(result.models[1].cost,7);
});
test('a completed image never overwrites a replacement job or a different canvas',async()=>{
 let applied=0;const node={dataset:{jobId:'new-job'}};
 const a=adapter('CanvasFlowDirectorFinishPanorama',{document:{querySelector:()=>node,contains:()=>true},CSS:{escape:x=>x},fetchMediaUrlAsDataUrl:async()=> 'data:image/png,x',applyGeneratedImage:()=>applied++});
 await a.run({projectId:'origin',outputId:'result',jobId:'old-job'},{imageUrl:'/media/result.png'});assert.equal(applied,0);
 node.dataset.jobId='old-job';a.state.projectId='other';await a.run({projectId:'origin',outputId:'result',jobId:'old-job'},{imageUrl:'/media/result.png'});assert.equal(applied,0);
});
test('server failure clears generation state only on its matching canvas result',async()=>{
 let removed=false;const badge={textContent:''},node={dataset:{jobId:'job'},querySelector:()=>({classList:{remove:()=>removed=true},querySelector:()=>badge})};
 const a=adapter('CanvasFlowDirectorFailPanorama',{document:{querySelector:()=>node},CSS:{escape:x=>x}});
 await a.run({projectId:'origin',outputId:'result',jobId:'job'},Error('生成失败原因'));assert.equal(removed,true);assert.equal(node.dataset.jobStatus,'failed');assert.equal(node.dataset.jobError,'生成失败原因');assert.equal(badge.textContent,'生成失败');
});
