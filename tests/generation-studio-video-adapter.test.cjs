const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('../tools/release/node_modules/acorn');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root,'upstream-model-contracts.json'),'utf8'));
const wanted = new Set(['createStudioVideoAdapter', 'modelDefaultSettings', 'currentModelContract', 'specRowValues',
  'parseDurationStepsParam','contractControlOptions','VIDEO_GEN_MODES','VIDEO_INPUT_SOURCE_KEYS','CAMERA_MOTION_PRESETS',
  'VIDEO_DURATION_MIN','VIDEO_DURATION_MAX','isKnownReferenceMode','normalizeReferenceMode','VIDEO_GEN_MODE_BY_KEY',
  'FRAMES_MODE_SHORT_LABEL','DEFAULT_VIDEO_GEN_MODE','nodeGenerationProfile','findSourceGenerationModel',
  'sourceVideoMode','sourceGenerationPlan']);
const blocks = [];
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && wanted.has(node.id.name)) blocks.push(source.slice(node.start,node.end));
  if (node.type === 'VariableDeclarator' && wanted.has(node.id.name)) blocks.push('const '+source.slice(node.start,node.end)+';');
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
}
visit(acorn.parse(source,{ecmaVersion:'latest'}));
function adapter(name, overrides = {}, provider = {}, customRows = []) {
  const doc = catalog[name] || {};
  const semantic = {aspect_ratio:'aspectRatio', n:'count', generate_audio:'generateAudio'};
  const rows = (doc.params || []).filter(p => p.name !== 'prompt' && p.type !== 'upload').map(p => ({
    key:semantic[p.name] || p.name, field:p.name, label:p.label, options:p.options || [], default:p.options?.[0]?.value
  }));
  rows.push(...customRows);
  const model = {id:name,model:name,mediaGenerate:!!doc.params, ...overrides};
  const state = {modelContracts:{[name]:{...doc,providerContract:provider}}};
  const context = vm.createContext({state,specRowsFor:()=>rows,readCameraCustom:()=>[],
    resolvePromptTokens:text=>text.replace('[[运镜:镜头前推]]','镜头向前推进')});
  vm.runInContext(blocks.join('\n'),context);
  return context.createStudioVideoAdapter(model);
}
function json(value) {return JSON.parse(JSON.stringify(value));}
const item = (kind,url) => ({kind,url});
const frameRefs = {firstFrame:[item('image','/media/open.png')],lastFrame:[item('image','/media/end.png')]};

test('Seedance frame order, motion expansion and required inputs agree with the video node',()=>{
  const a=adapter('seedance-2.5-guanfang');
  const settings=a.normalize({referenceMode:'frames2video',cameraMove:'镜头前推'});
  assert.deepEqual(json(a.references(settings).map(s=>s.key)),['firstFrame','lastFrame']);
  assert.match(a.validate(settings,{firstFrame:frameRefs.firstFrame},'推近'), /尾帧/);
  assert.equal(a.validate(settings,frameRefs,'推近'),'');
  const body=a.payload(settings,{...frameRefs,videoRefs:[item('video','https://example.com/old.mp4')]},'拍摄');
  assert.deepEqual(json(body.referenceImages),['/media/open.png','/media/end.png']);
  assert.deepEqual(json(body.sourceVideos),[]);
  assert.equal(body.generationSettings.modelOptions.mode,'shouweizhen');
  assert.equal(body.prompt,'拍摄 镜头向前推进');
});
test('imported video settings retain local model identity, duration, audio, and first-frame-only slots', () => {
  const local = {id:'local-video', name:'2.0'};
  const sound = {key:'generateAudio', field:'generate_audio', label:'生成音频', options:[], default:true};
  const studio = adapter('seedance-2.0-guanfang', {id:'seedance-2.0-guanfang'}, {}, [sound]);
  const ctx = vm.createContext({state:{videoModels:[{id:'other',name:'2.5'},local]},
    videoReferenceInputs:() => ({images:1}), createStudioVideoAdapter:() => studio});
  vm.runInContext(blocks.join('\n'),ctx);
  ctx.createStudioVideoAdapter = () => studio;
  const profile = {model:'2.0', mode:'首尾帧', specs:['16:9','720P','5s','1个'], audio:false, firstFrameOnly:true};
  const node = {dataset:{generationProfile:JSON.stringify(profile)}};
  const plan = ctx.sourceGenerationPlan(node,false);
  assert.equal(plan.error,undefined);
  assert.equal(plan.model.id,'local-video');
  const body = plan.adapter.payload(plan.settings,{firstFrame:[item('image','/media/first.png')]},'原文');
  assert.equal(body.generationSettings.referenceMode,'singleImage2video');
  assert.equal(body.generationSettings.duration,'5');
  assert.equal(body.generationSettings.generateAudio,false);
  assert.deepEqual(Array.from(body.referenceImages),['/media/first.png']);
  assert.equal(body.generationSettings.resolution.toLowerCase(),'720p');
  node.dataset.generationProfile=JSON.stringify({...profile,specs:['16:9','720P','98s','1个']});
  assert.match(ctx.sourceGenerationPlan(node,false).error,/不支持原/);
  node.dataset.generationProfile=JSON.stringify({...profile,useWorkspace:true});
  assert.equal(ctx.sourceGenerationPlan(node,false),null);
});
test('mixed mode supports all three media types and preserves local audio handles',async()=>{
  const a=adapter('seedance-2.5-guanfang');
  const settings=a.normalize({referenceMode:'mixed2video'});
  const refs={imageRefs:[item('image','/media/a.png'),item('image','/media/b.png')],
    videoRefs:[item('video','https://example.com/ref.mp4')],audioRefs:[item('audio','/media/a.wav')]};
  assert.equal(a.validate(settings,refs,'舞蹈'),'');
  const body=a.payload(settings,refs,'舞蹈');
  assert.equal(body.generationSettings.modelOptions.mode,'cankaosheng');
  assert.equal(body.referenceImages.length,2);
  assert.equal(body.sourceVideos[0],'https://example.com/ref.mp4');
  assert.equal(body.sourceAudios[0],'/media/a.wav');
  assert.match(a.validate(settings,{...refs,videoRefs:[item('video','/media/private.mp4')]},'舞蹈'),/直链/);
  assert.match(a.validate(settings,{...refs,audioRefs:Array(11).fill(refs.audioRefs[0])},'舞蹈'),/最多/);
});
test('avatar and video enhancement expose required media roles and their actual options',()=>{
  const avatar=adapter('kling-avatar-image2video'), settings=avatar.normalize({'option.mode':'pro'});
  assert.equal(settings.referenceMode,'mixed2video');
  assert.match(avatar.validate(settings,{imageRefs:[item('image','/media/a.png')]},'说话'),/音频/);
  assert.equal(avatar.payload(settings,{}).generationSettings.modelOptions.mode,'pro');
  assert.equal(settings.duration,undefined);
  const enhance=adapter('video-enhance'), defaults=enhance.normalize({});
  assert.equal(enhance.references(defaults)[0].kinds[0],'video');
  assert.equal(defaults.duration,undefined);
  assert.ok(!enhance.fields[0].options.some(option=>option.value==='text2video'));
});
test('Wan mixed references accept all declared slots without relaxing first/last frames', () => {
  const a = adapter('wan3.0');
  const settings = a.normalize({referenceMode:'mixed2video'});
  const refs = {};
  for (const [kind, count] of [['image',10], ['video',5], ['audio',5]]) {
    refs[kind+'Refs'] = Array.from({length:count}, (_,i)=>item(kind,'https://example.org/'+kind+i));
  }
  assert.equal(a.validate(settings, refs, '镜头'), '');
  const body = a.payload(settings, refs, '镜头');
  assert.deepEqual([body.referenceImages.length, body.sourceVideos.length, body.sourceAudios.length], [10,5,5]);
  assert.match(a.validate(settings, {...refs,imageRefs:[...refs.imageRefs,refs.imageRefs[0]]}, '镜头'), /10/);
  assert.deepEqual(json(a.references({...settings, referenceMode:'frames2video'}).map(x=>x.max)), [1,1]);
  const tool = adapter('video-enhance'), opts = tool.normalize({});
  assert.equal(tool.validate(opts, {videoRefs:[item('video','https://example.org/in.mp4')]}, ''), '');
  assert.match(tool.validate(opts, {}, ''), /视频/);
});

test('workflow provider resolution, duration limits and allowed reference modes drive the form',()=>{
  const a=adapter('workflow',{videoProfile:'sanyuan-video'},{apiReferenceModes:['text2video','image2video','mixed2video','audio2video'],
    max_image:2,max_audio:1,max_video:0,durationOptions:[5,10,15],maxByResolution:{'1080P横':10},
    resolutions:['720P横','1080P横'],defaultResolution:'720P横'});
  const s=a.normalize({resolution:'1080P横',duration:'15',referenceMode:'frames2video'});
  assert.equal(s.referenceMode,'text2video');
  assert.ok(+s.duration<=10);
  assert.deepEqual(json(a.fieldsFor(s).find(f=>f.key==='duration').options.map(o=>o.value)),['5','10']);
  assert.deepEqual(json(a.references({...s,referenceMode:'mixed2video'}).map(slot=>slot.kinds[0])),['image','audio']);
});
test('legacy protocols offer first/last frames only when the adapter sends both to the upstream',()=>{
  for(const [protocol,model,frames] of [['openai-video','basic',false],['kling','basic',true],
    ['dashscope','wan-kf2v-model',true],['dashscope','wan-i2v-model',false]]){
    const a=adapter(model,{videoProtocol:protocol});
    assert.equal(a.fields[0].options.some(o=>o.value==='frames2video'),frames);
  }
});

test('free duration supports fractions, while random seeds obey canvas integer bounds',()=>{
  const editor=adapter('vidu-jieshuoman'), settings=editor.normalize({duration:'16.75'});
  assert.equal(settings.duration,'16.75');
  assert.equal(editor.fieldsFor(settings).find(f=>f.key==='duration').step,.01);
  const legacy=adapter('basic',{videoProtocol:'kling'}), seed=legacy.normalize({seed:'1000000000'});
  assert.match(legacy.validate(seed,{},'拍摄'),/种子/);
  assert.equal(legacy.validate({...seed,seed:'0'}, {},'拍摄'),'');
});

test('each video request asks for exactly one result and respects the audio default',()=>{
  const a=adapter('registered',{}, {}, [
    {key:'count',label:'数量',field:'n',options:[{value:1},{value:4}],default:1},
    {key:'generateAudio',label:'生成音频',field:'generate_audio',options:[{value:'true'},{value:'false'}],default:'false'}
  ]);
  const settings=a.normalize({count:'4'});
  assert.equal(a.submissionCount(settings),4);
  assert.equal(a.payload(settings,{}).generationSettings.generateCount,1);
  assert.equal(a.payload(settings,{}).generationSettings.generateAudio,false);
});

test('legacy re-use recovers durations, declared model options, frame positions and advanced fields',()=>{
  const a=adapter('seedance-2.5-guanfang');
  const history=a.restoreLegacy({generationSettings:{referenceMode:'首尾帧',duration:'8 秒',modelOptions:{web_search:'true'}},
    referenceImages:['data:image/png;base64,xxx','/media/last.png']});
  assert.equal(history.settings.referenceMode,'frames2video');
  assert.equal(history.settings.duration,'8');
  assert.equal(history.settings['option.web_search'],'true');
  assert.deepEqual(json(history.refs.firstFrame),[]);
  assert.equal(history.refs.lastFrame[0].url,'/media/last.png');
  const legacy=adapter('classic',{videoProtocol:'kling'}, {}, [
    {key:'count',field:'n',options:[{value:1},{value:4}],default:1}
  ]).restoreLegacy({generationSettings:{videoMode:'image-to-video',generateCount:4},
    advancedSettings:{seed:0,negativePrompt:'模糊'}});
  assert.equal(legacy.settings.referenceMode,'singleImage2video');
  assert.equal(legacy.settings.count,'4');
  assert.equal(legacy.settings.seed,0);
  assert.equal(legacy.settings.negativePrompt,'模糊');
});

test('the provider with an upload endpoint accepts local reference videos and external links',()=>{
  const a=adapter('upload-capable',{videoProfile:'zhongheng-video'}, {max_image:2,max_video:1,max_audio:1});
  const settings=a.normalize({referenceMode:'mixed2video'});
  const slot=a.references(settings).find(s=>s.key==='videoRefs');
  assert.equal(slot.urlOnly,false);
  assert.equal(slot.allowLink,true);
  assert.equal(slot.maxBytes,25*1024*1024);
  assert.equal(a.validate(settings,{videoRefs:[item('video','/media/ref.webm')]},'舞蹈'),'');
  assert.equal(a.payload(settings,{videoRefs:[item('video','/media/ref.webm')]}).sourceVideos[0],'/media/ref.webm');
});

test('vo3.1 translates the selected canvas mode to its generation_type parameter',()=>{
  const a=adapter('vo3.1'), s=a.normalize({referenceMode:'frames2video'});
  assert.equal(s.referenceMode,'frames2video');
  assert.equal(a.payload(s,frameRefs).generationSettings.modelOptions.generation_type,'FIRST&LAST');
  assert.ok(!a.fieldsFor(s).some(f=>f.key==='option.generation_type'));
  assert.equal(a.payload(a.normalize({referenceMode:'text2video'}),{}).generationSettings.modelOptions.generation_type,'TEXT');
});
test('Seedance per-second frame defaults select an eligible channel and supported reference subtype',()=>{
  const a=adapter('seedance-2.5-guanfang-anmiao');
  const settings=a.normalize({referenceMode:'frames2video',resolution:'480p'});
  assert.equal(settings.resolution,'720p');
  assert.ok(a.fieldsFor(settings).find(f=>f.key==='resolution').options.every(o=>o.value!=='480p'));
  assert.ok(!a.fields[0].options.some(o=>o.value==='videoEdit2video'));
});
test('Vidu Q4 requires an image for audio-assisted reference generation; generic image references keep their role',()=>{
  const a=adapter('viduq4-preview');
  assert.ok(!a.fields[0].options.some(o=>['text2video','audio2video'].includes(o.value)));
  const settings=a.normalize({referenceMode:'mixed2video'});
  assert.match(a.validate(settings,{audioRefs:[item('audio','/media/ref.mp3')]},'演出'),/图片/);
  assert.equal(adapter('happyhorse-r2v').fields[0].default,'image2video');
});

