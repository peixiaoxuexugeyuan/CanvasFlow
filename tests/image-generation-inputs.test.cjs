const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const acorn=require('../tools/release/node_modules/acorn');
const source=fs.readFileSync('app.js','utf8'),functions={};
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration')functions[n.id.name]=source.slice(n.start,n.end);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}
walk(acorn.parse(source,{ecmaVersion:'latest'}));
function node(id,type='image'){return {dataset:{nodeId:id,node:type},style:{},matches:()=>true,querySelector:()=>null};}
function fixture(){
 const target=node('target'),up=node('up'),down=node('down'),other=node('other');
 const edges=[{source:'up',target:'target'},{source:'target',target:'down'}],calls=[],toasts=[];
 const scope={state:{projectId:'project-a',groups:[],activeNodeId:'other',references:[],linkedRefs:[{data:'data:image/png;base64,STALE'}],imageGenerationSettings:{mode:'text-to-image',count:2,resolution:'2731x4096',quality:'max',modelOptions:{style:'natural'}},t2iModels:[{id:'model',name:'GPT'}]},
 window:{CanvasFlowConnections:{getEdges:()=>edges}},$$:()=>[target,up,down,other],$:()=>null,
 nodeImageHandles:n=>({previewMedia:n.dataset.previewMedia}),nodeHasUsableImage:()=>true,resolveNodeImageData:async n=>'data:image/png;base64,'+n.dataset.nodeId,
 fetchMediaUrlAsDataUrl:async url=>'data:image/png;base64,'+url,
 IMAGE_PROMPT_PLACEHOLDER:'描述想生成的图片',promptInput:{value:''},collectImagePrompt:()=> '完整提示词'.repeat(500),
 enforceImageModelSettings(){},showToast:(...args)=>toasts.push(args),loadI2tModels:async()=>{},normalizeImageGenerationSettings:x=>x,
 IMAGE_MODE_OPTIONS:[{id:'text-to-image',name:'文生图'},{id:'image-to-image',name:'图生图'}],t2iModelId:()=> 'model',
 runImageGenerationJob:async p=>{calls.push(p);return {image:'data:image/png;base64,RESULT'};},
 applyGeneratedImage(){},appendNode:()=>node('extra'),scheduleSave(){},saveProject(){},workspaceHeader:()=>({}),
 document:{contains:()=>true},nodeLabelEl:()=>null,GROUP_COLORS:['blue'],clearNodeSelection(){},renderGroups(){},syncNodeOverlays(){},revealBounds(){},updateNodeCount(){}};
 vm.createContext(scope);vm.runInContext(['generationContext','generationContextActive','collectImageReferenceImages','generateImage'].map(n=>functions[n]).join('\n'),scope);
 return {scope,target,up,edges,calls,toasts};
}
test('default text-to-image still submits upstream reference, full prompt, quality, size and requested count',async()=>{
 const f=fixture();await f.scope.generateImage(f.target);
 assert.equal(f.calls.length,2);
 for(const p of f.calls){assert.deepEqual(Array.from(p.referenceImages),['data:image/png;base64,up']);assert.equal(p.size,'2731x4096');assert.equal(p.quality,'max');assert.equal(p.modelId,'model');assert.equal(p.prompt,'完整提示词'.repeat(500));assert.equal(p.modelOptions.style,'natural');}
});
test('target-scoped manual images, local media and multiple upstream images; exclude text, video, downstream and other-node refs',async()=>{
 const f=fixture();f.edges.push({source:'other',target:'target'},{source:'up',target:'target'});
 f.scope.state.references=[{ownerNodeId:'target',data:'/media/test.png'},{ownerNodeId:'target',text:true,data:'text'}, {ownerNodeId:'target',video:true,data:'https://example/video.mp4'},{ownerNodeId:'other',data:'data:image/png;base64,WRONG'}];
 const refs=await f.scope.collectImageReferenceImages(f.target);
 assert.deepEqual(Array.from(refs),['data:image/png;base64,up','data:image/png;base64,other','/media/test.png']);
});
test('reference override is isolated from graph and selected-node refs',async()=>{
 const f=fixture();const refs=await f.scope.collectImageReferenceImages(f.target,'data:image/png;base64,OVERRIDE');assert.deepEqual(Array.from(refs),['data:image/png;base64,OVERRIDE']);
});
test('failed restoration aborts generation instead of silently falling back to text-to-image',async()=>{
 const f=fixture();f.scope.resolveNodeImageData=async()=>'';await f.scope.generateImage(f.target);assert.equal(f.calls.length,0);assert.match(f.toasts.at(-1)[0],/参考图片读取失败/);
});
test('text-to-image with no image references stays text-only',async()=>{
 const f=fixture();f.edges.length=0;await f.scope.generateImage(f.target);assert.equal(f.calls.length,2);assert.equal(f.calls[0].referenceImages.length,0);
});

test('long upstream and dock prompts retain camera instructions at the end',()=>{
 const f=fixture(),upstream='上游文字'.repeat(600),own='本次提示'.repeat(600);
 Object.assign(f.scope,{collectUpstreamInputs:()=>({prompt:upstream}),resolvePromptTokens:x=>x,sanitizePromptSource:x=>x,cameraControlPromptText:()=> '35mm f/2.8',promptInput:{value:own}});
 vm.runInContext(['collectGenerationPrompt','collectImagePrompt'].map(n=>functions[n]).join('\n'),f.scope);
 assert.equal(f.scope.collectImagePrompt(f.target),upstream+' / '+own+'，35mm f/2.8');
});

test('registered image quality works even without a separate provider contract',()=>{
 const f=fixture();const rows=[{key:'quality',default:'auto',options:[{value:'auto',label:'自适应'},{value:'medium',label:'中'},{value:'max',label:'极致'}]}];
 Object.assign(f.scope,{currentT2iModelEntry:()=>({id:'model'}),specRowsFor:()=>rows,specRowOf:(r,k)=>r.find(x=>x.key===k),specRowValues:r=>(r?.options||[]).map(o=>o.value),IMAGE_RES_TIERS:[],imageResTier:()=> '4K',aspectToResolution:()=> '2731x4096',resolutionMatchesAspect:()=>true,IMAGE_QUALITY_OPTIONS:[],IMAGE_QUALITY_LABELS:{old:'旧'},IMAGE_COUNTS:[]});
 f.scope.state.imageGenerationSettings.quality='standard';
 vm.runInContext(functions.enforceImageModelSettings,f.scope);f.scope.enforceImageModelSettings();
 assert.equal(f.scope.state.imageGenerationSettings.quality,'auto');assert.equal(f.scope.IMAGE_QUALITY_LABELS.auto,'自适应');
 f.scope.state.imageGenerationSettings.quality='max';f.scope.enforceImageModelSettings();assert.equal(f.scope.state.imageGenerationSettings.quality,'max');
});

test('saved large references use compact local handles without fetching base64 into the browser request',async()=>{
 const f=fixture();f.up.dataset.previewMedia='/media/media-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png';
 f.scope.resolveNodeImageData=async()=>{throw Error('must not load base64');};
 await f.scope.generateImage(f.target);assert.equal(f.calls.length,2);
 assert.deepEqual(Array.from(f.calls[0].referenceImages),[f.up.dataset.previewMedia]);assert.ok(JSON.stringify(f.calls[0]).length<10000);
});


test('rapid clicks are locked before asynchronous model/reference loading',async()=>{
 const f=fixture();let release;f.scope.loadI2tModels=()=>new Promise(r=>release=r);
 const first=f.scope.generateImage(f.target,{single:true});
 await f.scope.generateImage(f.target,{single:true});
 release();await first;assert.equal(f.calls.length,1);assert.equal(f.target.dataset.imageSubmitting,undefined);
});

test('validation failure releases submission lock for a corrected retry',async()=>{
 const f=fixture();f.scope.resolveNodeImageData=async()=>'';await f.scope.generateImage(f.target);
 assert.equal(f.target.dataset.imageSubmitting,undefined);
 f.scope.resolveNodeImageData=async()=> 'data:image/png;base64,OK';await f.scope.generateImage(f.target,{single:true});assert.equal(f.calls.length,1);
});

test('switching project during an in-flight batch never appends/submits into the new project',async()=>{
 const f=fixture(),applied=[];let requests=0,appends=0;
 f.scope.runImageGenerationJob=async(p,o)=>{requests++;assert.equal(o.context.projectId,'project-a');f.scope.state.projectId='project-b';return {image:'data:image/png;base64,RESULT'};};
 f.scope.appendNode=()=>{appends++;return node('extra');};f.scope.applyGeneratedImage=(...x)=>applied.push(x);
 await f.scope.generateImage(f.target);assert.equal(requests,1);assert.equal(appends,0);assert.equal(applied.length,0);
});

test('batch tasks have separate output bindings and saved completion markers',async()=>{
 const f=fixture(),outputs=[],saved=[];f.scope.saveProject=()=>saved.push(true);
 f.scope.runImageGenerationJob=async(p,o)=>{outputs.push(o.node.dataset.nodeId);return {image:'image',jobId:'job-'+outputs.length};};
 await f.scope.generateImage(f.target);assert.deepEqual(outputs,['target','extra']);assert.equal(f.target.dataset.appliedGenerationJobId,'job-1');assert.ok(saved.length>=3);
});

test('switching workspace while loading references prevents a paid submission',async()=>{
 const f=fixture();let ws='a';f.scope.workspaceHeader=()=>({'X-Workspace-Id':ws});
 f.scope.resolveNodeImageData=async()=>{ws='b';return 'data:image/png;base64,OK';};
 await f.scope.generateImage(f.target);assert.equal(f.calls.length,0);
});
