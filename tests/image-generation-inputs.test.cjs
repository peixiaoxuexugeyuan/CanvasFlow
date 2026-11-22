const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const acorn=require('../tools/release/node_modules/acorn');
const source=fs.readFileSync('app.js','utf8'),functions={};
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration')functions[n.id.name]=source.slice(n.start,n.end);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}
walk(acorn.parse(source,{ecmaVersion:'latest'}));
function studioImage(rows, model = {}, contract = null) {
  const c = {state:{modelSpecs:{image:{fixture:rows}},modelContracts:{fixture:contract}},
    CAMERA_COLUMNS:[{key:'lens',title:'镜头'}],
    CAMERA_LIBRARY:{lens:[{key:'prime',name:'定焦',prompt:'定焦镜头'}]},
    specRowsFor:()=>rows, IMAGE_RES_LONG_SIDE:{'1K':1024,'2K':2048}};
  vm.createContext(c);
  vm.runInContext(['currentModelContract','contractControlOptions','specRowValues','isAutoAspect',
    'aspectToResolution','resolutionMatchesAspect','cameraLibraryItems','cameraItemOf','defaultCameraControl','normalizeCameraControl',
    'cameraControlPromptText','createStudioImageAdapter'].map(name=>functions[name]).join('\n'),c);
  return c.createStudioImageAdapter({id:'fixture',model:'fixture',...model});
}
const studioRow = (key, field, values) => ({key,field,default:values[0],options:values.map(value=>({value,label:value}))});
test('studio preserves concrete pixels and auto, sends ordered references, local batch count and optional camera prompt',()=>{
  const adapter=studioImage([studioRow('resolution','size',['auto','1024x1536']),
    studioRow('quality','quality',['auto','medium']),studioRow('count','n',['1','2','4'])],
    {imageReferences:{min:0,max:2}});
  const refs={referenceImages:[{url:'/media/a.png'},{url:'/media/b.png'}]};
  assert.equal(adapter.payload({},refs,'草地').size,'auto');
  assert.equal(adapter.fields.find(f=>f.key==='resolution').options[1].label,'1024x1536 · 2:3');
  const settings={resolution:'1024x1536',quality:'medium',count:'2',useCamera:'on',camera_lens:'prime'};
  const request=adapter.payload(settings,refs,'草地');
  assert.equal(request.size,'1024x1536');assert.equal(request.quality,'medium');
  assert.deepEqual(Array.from(request.referenceImages),['/media/a.png','/media/b.png']);
  assert.equal(request.prompt,'草地\n定焦镜头');
  assert.equal(adapter.submissionCount(settings),2);
  assert.equal(adapter.submissionCount({count:'9000'}),1);
  assert.ok(!('n' in request.modelOptions));
  assert.equal(adapter.validate(settings,refs),'');
  assert.match(adapter.validate(settings,{referenceImages:[{},{},{}]}),/最多支持 2 张/);
});
test('studio keeps independent media aspect, size and provider-specific options without canvas state',()=>{
  const adapter=studioImage([studioRow('aspectRatio','aspect_ratio',['auto','3:2']),
    studioRow('resolution','resolution',['auto','2K']),studioRow('background','background',['opaque','transparent'])],
    {mediaGenerate:true,imageReferences:{min:0,max:0}});
  const settings={aspectRatio:'auto',resolution:'2K',background:'transparent'};
  const req=adapter.payload(settings,{},'草地');
  assert.equal(adapter.references(settings).length,0);assert.equal(req.size,'auto');
  assert.equal(req.imageSpec.aspectRatio,'auto');assert.equal(req.imageSpec.resolution,'2K');
  assert.equal(req.modelOptions.background,'transparent');
  assert.ok(!('quality' in req));assert.ok(!('prompt' in req));
});
test('image studio validates required prompt, input dimensions and reference-dependent channel rules',()=>{
  const contract={params:[{name:'size',type:'input',label:'自定义尺寸'}, {name:'prompt',type:'textarea',required:true}],
    channel_constraints:[{capability_rules:[{effect:'reject',when:[{param:'images',op:'count_gt',value:2}]}]}]};
  const adapter=studioImage([studioRow('aspectRatio','aspect_ratio',['auto','1:1']),
    studioRow('resolution','resolution',['auto','2K'])], {mediaGenerate:true}, contract);
  const settings={sizeMode:'custom',customSize:'1536x864'};
  assert.match(adapter.validate(settings,{referenceImages:[{}]},''),/需要提示词/);
  assert.match(adapter.validate({...settings,customSize:'1000x1000'},{},'测试'),/16 的倍数/);
  assert.match(adapter.validate(settings,{referenceImages:[{},{},{}]},'测试'),/线路/);
  assert.equal(adapter.validate(settings,{},'测试'),'');
  const req=adapter.payload(settings,{},'测试');
  assert.equal(req.size,'1536x864');assert.equal(req.modelOptions.size,'1536x864');
  assert.equal(req.imageSpec,undefined);
  assert.equal(adapter.fields.find(f=>f.key==='aspectRatio').visible(settings),false);
});
test('old image jobs restore stored pixels, mapped quality and model-specific values without inventing references',()=>{
  const adapter=studioImage([studioRow('aspectRatio','aspect_ratio',['1:1','3:2']),
    studioRow('resolution','resolution',['1K','2K']),studioRow('quality','quality',['low','standard','high']),
    studioRow('styleChoice','style',['natural','vivid'])],{mediaGenerate:true});
  const result=adapter.restoreLegacy({size:'2048x1365',inputSummary:{quality:'medium',referenceCount:2,modelOptions:{style:'vivid'}}});
  assert.deepEqual({...result.settings},{aspectRatio:'3:2', resolution:'2K',quality:'standard',styleChoice:'vivid'});
  assert.deepEqual({...result.refs},{});
  const pixels=studioImage([studioRow('resolution','size',['auto','1024x1536'])],{mediaGenerate:true});
  assert.equal(pixels.restoreLegacy({inputSummary:{size:'1024x1536'}}).settings.resolution,'1024x1536');
  const custom=studioImage([studioRow('aspectRatio','aspect_ratio',['1:1','16:9']),
    studioRow('resolution','resolution',['1K','2K'])],{mediaGenerate:true},{params:[{name:'size',type:'input'}]});
  const restored=custom.restoreLegacy({size:'1536x864'}).settings;
  assert.equal(restored.sizeMode,'custom');assert.equal(restored.customSize,'1536x864');
});
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
