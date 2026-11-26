const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const acorn = require('../tools/release/node_modules/acorn');

const source = fs.readFileSync('app.js', 'utf8');
const definitions = [];
const wanted = new Set(['roleImageModels', 'roleGenerationReference', 'storeRoleImage', 'generateRoleImage','finishRoleEditorSave',
  'createStudioImageAdapter', 'pollGenerationJob', 'jobElapsedSeconds', 'aspectToResolution', 'resolutionMatchesAspect',
  'currentModelContract', 'specRowValues', 'contractControlOptions']);
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && wanted.has(node.id.name)) definitions.push(source.slice(node.start, node.end));
  if (node.type === 'AssignmentExpression' && node.left.property?.name === 'CanvasFlowRoleGeneration') {
    definitions.push(source.slice(node.start, node.end) + ';');
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else visit(value);
  }
}
visit(acorn.parse(source, {ecmaVersion:'latest'}));

function fixture() {
  const origin = 'http://127.0.0.1:5199';
  const image = 'data:image/png;base64,YQ==';
  const model = {id:'test-image', name:'测试图片模型', imageReferences:{min:0, max:4}};
  const polls = [{status:'running', progress:26}, {status:'completed', imageUrl:'/media/generated.png'}];
  const requests = [], reads = [], uploads = [];
  const ctx = vm.createContext({
    window:{}, document:{baseURI:origin + '/index.html'}, location:new URL(origin), URL, navigationEpoch:2,
    workspaceHeader:() => ({'X-Workspace-Id':'role-fixture'}), currentUser:() => ({id:'local-test'}),
    state:{}, loadModelSpecs:async () => true, t2iModelId:() => model.id,
    specRowsFor:() => null, defaultCameraControl:() => ({}), CAMERA_COLUMNS:[],
    isAutoAspect:value => value === 'auto', IMAGE_RES_LONG_SIDE:{'1K':1024}, IMAGE_JOB_STAGE_TEXT:{},
    async api(path, options) {
      requests.push({path, options, body:options?.body && JSON.parse(options.body)});
      if (path === '/api/ai/models') return {models:{t2i:[model]}};
      if (path === '/api/ai/image-generate') return {jobId:'j1', job:{status:'running'}};
      assert.equal(path, '/api/jobs/j1');
      assert.ok(polls.length);
      return {job:polls.shift()};
    },
    fetchMediaUrlAsDataUrl:async url => { reads.push(url); return image; },
    dataUrlToFile:(data, name) => ({data, name, type:'image/png'}),
    uploadMediaFile:async file => { uploads.push(file); return {url:'/media/uploaded.png'}; },
    setTimeout:callback => setImmediate(callback),
  });
  vm.runInContext(definitions.join('\n'), ctx);
  return {api:ctx.window.CanvasFlowRoleGeneration, ctx, model, requests, reads, uploads, polls, image, origin};
}

test('role image generation uses chosen model, uploaded clothing and official images, then returns durable result', async () => {
  const {api, model, origin, image, requests, reads, uploads} = fixture();
  const [registered] = await api.models();
  assert.equal(registered.id, model.id);
  assert.equal(registered.isDefault, true);
  assert.equal(registered.maxReferences, 4);
  const progress = [];
  const result = await api.generate({modelId:model.id, prompt:'蓝色衣服', slot:1, preview:'half',
    referenceImages:['/media/outfit.png', 'role-library/web/001-1.jpg', 'file:///C:/old/_libtv_roles/web/002-1.jpg', image],
    onProgress:job => progress.push(job.status)});
  assert.equal(result, '/media/generated.png');
  assert.deepEqual(progress, ['running', 'completed']);
  assert.deepEqual(reads, [origin + '/role-library/web/001-1.jpg', origin + '/_libtv_roles/web/002-1.jpg']);
  assert.equal(uploads.length, 0);
  const submits = requests.filter(r => r.options.method === 'POST');
  assert.equal(submits.length, 1);
  assert.equal(submits[0].body.asyncTask, true);
  assert.equal(submits[0].body.size, '768x1024');
  assert.equal(submits[0].body.modelId, model.id);
  assert.deepEqual(submits[0].body.referenceImages, ['/media/outfit.png', image, image, image]);
  assert.match(submits[0].body.prompt, /蓝色衣服[\s\S]+半身/);
  assert.ok(requests.every(r => r.options.headers['X-Workspace-Id'] === 'role-fixture'));
});

test('a role job belongs to its current canvas even if that canvas has not been saved yet', async()=>{
  const f=fixture(), draft=f.ctx.state;
  draft.projectId='project-draft';draft.projectIsDraft=true;
  f.ctx.saveProject=async()=>false;
  const input={modelId:f.model.id,prompt:'角色全身图'};
  await assert.rejects(f.api.generate(input),/保存角色任务所属画布/);
  assert.equal(f.requests.some(r=>r.body),false);
  f.ctx.saveProject=async()=>{draft.projectIsDraft=false;return true;};
  await f.api.generate(input);
  assert.equal(f.requests.find(r=>r.body).body.projectId,draft.projectId);
});

test('a public borrowed reference is copied once privately before queuing, while existing owned references are reused',async()=>{
  const f=fixture(), ctx=f.ctx;
  const shared='/media/media-'+ 'a'.repeat(32)+'.png',owned='/media/mine.png';
  const operation={id:'role',record:{id:'role'},derivatives:{id:'batch',items:[{slot:1,payload:{referenceImages:[owned,shared],referenceImage:shared}}]}};
  const writes=[];let receipt;
  Object.assign(ctx,{roleMediaImage:/^\/media\/media-[a-f0-9]{32}\.png$/,roleBatchContext:()=> 'workspace',
    structuredClone,characterStorage:{get:()=>[]},writeRoleRecord:async(_scope,op)=>{
      writes.push(op);
      if(writes.length===1)throw Object.assign(Error('copy'),{payload:{error:'copy_shared_role_references',references:[shared]}});
    }});
  await ctx.finishRoleEditorSave('mine',operation,op=>{receipt=op;});
  assert.deepEqual(writes[1].derivatives.items[0].payload,{referenceImages:[owned,'/media/uploaded.png'],referenceImage:'/media/uploaded.png'});
  assert.equal(writes[1],receipt);
  assert.equal(writes[0].derivatives.items[0].payload.referenceImage,shared);
  assert.equal(f.uploads.length,1);
});

test('each role asset uses its own composition and the existing setting sheet preset', async () => {
  for (const [slot, framing] of [[0,/正面全身/], [1,/面部特写/], [2,/表情九宫格/], [3,/设定呈现板/]]) {
    const f = fixture();
    await f.api.generate({modelId:f.model.id, prompt:'黑发', slot});
    const payload = f.requests.find(r => r.body).body;
    assert.match(payload.prompt, framing);
    assert.equal(payload.presetScene, slot === 3 ? 'character_setting_sheet' : undefined);
  }
});

test('role generation rejects incompatible model reference count before preparing images or submitting', async () => {
  const f = fixture();
  f.model.imageReferences.max = 0;
  await assert.rejects(f.api.generate({modelId:f.model.id, prompt:'肖像', referenceImages:['role-library/web/001-1.jpg']}), /最多支持 0/);
  assert.equal(f.reads.length, 0);
  assert.equal(f.requests.filter(r => r.body).length, 0);
});

test('closed editor and failed supplier jobs never apply or automatically resubmit an image', async () => {
  const f = fixture();
  let open = true;
  await assert.rejects(f.api.generate({modelId:f.model.id, prompt:'古装', isActive:() => open,
    onProgress() { open = false; }}), /编辑已结束/);
  assert.equal(f.requests.filter(r => r.body).length, 1);
  assert.equal(f.polls.length, 1);
  f.polls.splice(0, f.polls.length, {status:'failed', error:'提供商失败'});
  await assert.rejects(f.api.generate({modelId:f.model.id, prompt:'古装'}), /提供商失败/);
  assert.equal(f.requests.filter(r => r.body).length, 2);
});

test('large inputs and legacy inline results are persisted using binary media', async () => {
  const f = fixture();
  f.polls.splice(0, f.polls.length, {status:'completed', imageData:f.image});
  const huge = 'data:image/png;base64,' + 'YQ=='.repeat(1_750_000);
  const result = await f.api.generate({modelId:f.model.id, prompt:'礼服', referenceImages:[huge]});
  assert.equal(result, '/media/uploaded.png');
  assert.equal(f.uploads.length, 2);
  assert.deepEqual(f.requests.find(r => r.body).body.referenceImages, ['/media/uploaded.png']);
});

function rendererFixture(savedRole, officialAdditions = []) {
  const {ctx, model, requests} = fixture();
  const role = savedRole || {name:'林遥', value:'记者', images:['/media/original-body.png', '/media/original-face.png']};
  const calls = [], progress = [];
  let failAt = 0;
  const original = ctx.api;
  ctx.api = async (path, options) => {
    if (path === '/api/ai/image-generate') {
      calls.push(JSON.parse(options.body));
      return {jobId:'role-' + calls.length, job:{status:'running'}};
    }
    if (path.startsWith('/api/jobs/role-')) {
      const index = Number(path.split('-').at(-1));
      return {job:index === failAt ? {status:'failed', error:'fixture paused'} :
        {status:'completed', imageUrl:'/media/rendered-' + index + '.png'}};
    }
    return original(path, options);
  };
  ctx.window.CanvasFlowOfficialRoleAdditions = officialAdditions;
  vm.runInContext(fs.readFileSync('role-studio-preview.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('role-studio-render.js', 'utf8'), ctx);
  ctx.window.CanvasFlowRoleModes = [{id:'hair',tabs:[{id:'style',fields:[{id:'category',filterOnly:true}]}]}];
  const renderer = ctx.window.createRoleStudioRenderer({role, isActive:() => true, onProgress:info => progress.push(info)});
  const input = {modelId:model.id, controls:{'hair.color':'blue'}, prompt:'蓝发', outfitUrl:'/media/outfit.jpg'};
  return {renderer, calls, requests, progress, input, model, role, setFailure:index => { failAt = index; }};
}

test('half view uses the original paired close-up and respects confirmed frames', async () => {
  const full = 'role-library/web/024-1.jpg', portrait = '/_libtv_roles/web/024-2.jpg?v=2';
  const {renderer, input} = rendererFixture({images:[full, portrait]});
  const view = slot => renderer.viewFrame(slot, input.controls, input.outfitUrl);
  assert.deepEqual({...view(0)}, {url:full, crop:false, rendered:false});
  assert.deepEqual({...view(1)}, {url:portrait, crop:false, rendered:false});
  assert.deepEqual(Array.from(renderer.framingSources()), [full, portrait]);
  const generated = await renderer.generateView({...input, slot:0});
  assert.deepEqual({...view(1)}, {url:generated, crop:true, rendered:true});
  const half = await renderer.generateView({...input, slot:1});
  assert.deepEqual({...view(1)}, {url:half, crop:false, rendered:true});
  assert.equal(renderer.viewFrame(1, input.controls, input.outfitUrl, true).url, portrait);
  assert.equal(renderer.savedImages(input.controls, input.outfitUrl)[1], portrait);
});

test('missing, replaced, unrelated and off-site portraits keep the full-image crop', () => {
  const full = 'role-library/web/024-1.jpg', portrait = 'role-library/web/024-2.jpg';
  for (const role of [
    {images:[full]},
    {images:[full, 'role-library/web/003-2.jpg']},
    {images:[full, 'https://example.invalid/role-library/web/024-2.jpg']},
    {images:[full, '/uploads/role-library/web/024-2.jpg']},
    {images:['/media/full.png', portrait]},
    {images:[full, '/media/new.png'], styling:{sourceImages:[full, portrait]}},
  ]) {
    const {renderer} = rendererFixture(role);
    assert.deepEqual({...renderer.viewFrame(1, {}, [])}, {url:role.images[0], crop:true, rendered:false});
  }
});

test('an imported half-body preview stays separate from missing role assets', () => {
  const full = 'role-library/web/025-1.jpg';
  const half = 'assets/role-studio/subjects/025-half.webp';
  const images = [full, '', '', ''];
  const {renderer} = rendererFixture({images}, [{number:'025', images, halfPreview:half}]);
  assert.deepEqual({...renderer.viewFrame(1, {}, [])}, {url:half, crop:false, rendered:false});
  assert.deepEqual(Array.from(renderer.savedImages({}, [])), images);
  const replaced = rendererFixture({images:[full, '/media/new.png'], styling:{sourceImages:images}},
    [{number:'025', images, halfPreview:half}]).renderer;
  assert.equal(replaced.viewFrame(1, {}, []).crop,true);
});

test('saving consecutive manual styling steps reuses the finished full frame as the source of the derivative package', async () => {
  const {renderer, input, calls} = rendererFixture();
  const steps = ['hair','wardrobe'].map(key=>({key:'outfit.'+key,value:key,prompt:'apply '+key,image:'/media/'+key+'.png',label:key}));
  const controls=Object.fromEntries(steps.map(s=>[s.key,s.value]));
  const accepted=[];
  const packageItems=await renderer.preparePrimary({...input,controls,stylingSteps:steps,visualReferences:[],
    stylingBase:'keep new eye size',
    onStylingStep:(key,value)=>accepted.push([key,value])});
  assert.deepEqual(accepted, Object.entries(controls));
  assert.equal(calls.length,2);
  assert.match(calls[0].prompt,/keep new eye size/);
  assert.ok(calls[0].referenceImages.includes(input.outfitUrl));
  assert.ok(!calls[1].referenceImages.includes(input.outfitUrl));
  assert.equal(calls[1].referenceImages[0],'/media/rendered-1.png');
  assert.equal(renderer.savedImages(controls,input.outfitUrl)[0],'/media/rendered-2.png');
  assert.deepEqual(Array.from(packageItems,item=>item.slot),[1,2,3]);
  for(const item of packageItems) assert.ok(item.payload.referenceImages.includes('/media/rendered-2.png'));
});

test('renderer cache follows visual settings plus outfit and restores generated views after undo', async () => {
  const {renderer, input, calls} = rendererFixture();
  assert.equal(renderer.images(input.controls, input.outfitUrl)[1], '/media/original-face.png');
  const render = () => renderer.generateView({...input, slot:1});
  const [first, duplicate] = await Promise.all([render(), render()]);
  assert.equal(first, duplicate);
  assert.equal(calls.length, 1);
  assert.equal(renderer.images({'voice.pitch':25,...input.controls}, input.outfitUrl)[1], first);
  assert.equal(renderer.isRendered(1, input.controls, '/media/new-outfit.jpg'), false);
  const edited = {...input, controls:{'hair.color':'brown'}, prompt:'棕发'};
  assert.equal(renderer.images(edited.controls, input.outfitUrl)[1], '/media/original-face.png');
  const brown = await renderer.generateView({...edited, slot:1});
  assert.notEqual(brown, first);
  assert.equal(renderer.images(input.controls, input.outfitUrl)[1], first);
  assert.equal(renderer.images(edited.controls, input.outfitUrl)[1], brown);
});

test('role prompt changes invalidate matching frames and keep undo, recovery and default templates compatible', async () => {
  const {ctx} = fixture();
  ctx.fetch = async () => ({ok:true,json:async () => JSON.parse(fs.readFileSync('role-studio-prompts.json','utf8'))});
  ctx.Event = Event;
  ctx.window.dispatchEvent = () => {};
  for (const file of ['role-studio-controls.js','role-studio-prompts.js','role-studio-preview.js','role-studio-render.js'])
    vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
  const prompts = ctx.window.CanvasFlowRolePrompts;
  await prompts.ready;
  const model = ctx.window.createRoleStudioRenderer({role:{images:['/media/baseline.png']}});
  const controls = {'face.skin.smooth':30};
  const key = model.basisKey(controls,[]);
  const olderSnapshot = {assets:['/media/approved.png','','',''], generated:[0]};
  model.restore(controls,[],olderSnapshot);
  const override = text => ({custom:true,prompt:text});
  prompts.setOverrides({'field.body.figure.waist':override('waist {value}')});
  assert.equal(model.basisKey(controls,[]),key);
  assert.equal(model.isRendered(0,controls,[]),true);
  prompts.setOverrides({'field.face.skin.smooth':override('retouch {value}')});
  assert.notEqual(model.basisKey(controls,[]),key);
  model.restore(controls,[],olderSnapshot);
  assert.equal(model.isRendered(0,controls,[]),false);
  assert.equal(model.persistence(controls,[]).renderBasisKey,key,'retained picture keeps its original recipe');
  const blank = JSON.stringify(model.capture(controls,[]));
  model.restore(controls,[],JSON.parse(blank));
  assert.equal(JSON.stringify(model.capture(controls,[])),blank,'blank frames round-trip with the active recipe');
  prompts.setOverrides({});
  assert.equal(model.isRendered(0,controls,[]),true);
  assert.equal(model.basisKey(controls,[]),key);
});

test('full asset generation resumes following failure using current identity and wardrobe references', async () => {
  const {renderer, calls, input, setFailure, progress} = rendererFixture();
  const full = await renderer.generateView({...input, slot:0});
  setFailure(3);
  await assert.rejects(renderer.generateAssets(input), /fixture paused/);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].referenceImages, [full, '/media/original-face.png', input.outfitUrl]);
  assert.deepEqual(calls[2].referenceImages, ['/media/rendered-2.png', full, input.outfitUrl]);
  assert.match(calls[2].prompt, /记者[\s\S]*蓝发[\s\S]*参考图 3 仅用于服装/);
  setFailure(0);
  const assets = Array.from(await renderer.generateAssets(input));
  assert.deepEqual(assets, [full,'/media/rendered-2.png','/media/rendered-4.png','/media/rendered-5.png']);
  assert.deepEqual(calls[4].referenceImages, [full,assets[1],input.outfitUrl]);
  assert.deepEqual(Array.from(await renderer.generateAssets(input)), assets);
  assert.equal(calls.length, 5);
  assert.ok(progress.some(p => p.total === 2 && p.completed === 2));
});

test('zero-reference models require a text-only character and cannot discard image identity or wardrobe', async () => {
  const {renderer, calls, input, model} = rendererFixture();
  model.imageReferences.max = 0;
  await assert.rejects(renderer.generateView({...input, slot:1}), /服装参考图/);
  assert.equal(calls.length, 0);
  await assert.rejects(renderer.generateView({...input, slot:1, outfitUrl:''}),/身份参考图/);
  assert.equal(calls.length,0);
  const empty=rendererFixture({name:'林遥',value:'记者',images:[]});
  empty.model.imageReferences.max=0;
  await empty.renderer.generateView({...empty.input,slot:1,outfitUrl:''});
  assert.deepEqual(empty.calls[0].referenceImages, []);
  assert.match(empty.calls[0].prompt, /记者[\s\S]*蓝发/);
});

test('slot-specific edited portraits survive view switches and partial failures without repeating completed assets', async()=>{
  const {renderer,input,calls,setFailure}=rendererFixture();
  const previewFor=slot=>Promise.resolve({url:'/media/edit-'+([0,3].includes(slot)?'full':'half')+'.jpg',label:'已定位妆效与贴图'});
  await renderer.generateView({...input,slot:0,previewFor});
  assert.equal(renderer.remaining(input.controls,input.outfitUrl),3);
  setFailure(3);
  await assert.rejects(renderer.generateAssets({...input,slot:1,previewFor}),/fixture paused/);
  assert.equal(renderer.remaining(input.controls,input.outfitUrl),2);
  setFailure(0);
  await renderer.generateAssets({...input,slot:0,previewFor});
  assert.equal(calls.length,5);
  assert.deepEqual(calls.map(c=>c.referenceImages.find(s=>s.startsWith('/media/edit'))),['/media/edit-full.jpg','/media/edit-half.jpg','/media/edit-half.jpg','/media/edit-half.jpg','/media/edit-full.jpg']);
  renderer.selectModel('a-different-model');
  assert.equal(renderer.remaining(input.controls,input.outfitUrl),0);
  assert.equal(renderer.isRendered(0,input.controls,input.outfitUrl),true);
  renderer.selectModel(input.modelId);
  assert.equal(renderer.remaining(input.controls,input.outfitUrl),0);
  assert.equal(renderer.persistence(input.controls,input.outfitUrl).renderModelId,input.modelId);
});

test('one available reference carries original identity together with edited appearance',async()=>{
  const {renderer,input,model,calls}=rendererFixture();
  model.imageReferences.max=1;
  await renderer.generateView({...input,slot:1,outfitUrl:'',previewFor:()=>({url:'/media/face-with-edits.jpg',label:'脸部造型'})});
  assert.deepEqual(calls[0].referenceImages,['/media/face-with-edits.jpg']);
  assert.match(calls[0].prompt,/保持角色身份并还原脸部造型/);
});

test('a single-reference model cannot silently replace the original character with an outfit photo', async () => {
  const {renderer, calls, input, model} = rendererFixture();
  model.imageReferences.max = 1;
  await assert.rejects(renderer.generateAssets(input), /至少两张参考图/);
  assert.equal(calls.length, 0);
});

test('style card images respect identity and outfit priority and describe overflow by name', async () => {
  const {renderer, calls, input, model, progress} = rendererFixture();
  model.imageReferences.max = 3;
  const mark = {label:'定位后的雀斑', url:'/media/composited-mark.png'};
  const hair = {label:'卷发造型', url:'/media/curly-hair.jpg'};
  const result = await renderer.generateView({...input,slot:1,visualReferences:[mark,hair]});
  assert.deepEqual(calls[0].referenceImages,['/media/original-face.png',input.outfitUrl,mark.url]);
  assert.match(calls[0].prompt,/参考图 3 用于还原定位后的雀斑/);
  assert.match(calls[0].prompt,/按文字设定绘制：卷发造型/);
  assert.ok(progress.some(event=>event.omittedReferences?.includes(hair.label)));
  const assets = await renderer.generateAssets({...input,visualReferences:[hair]});
  assert.equal(assets.length,4);
  assert.notEqual(assets[1],result);
  assert.equal(calls.length,5);
  assert.deepEqual(calls[1].referenceImages,['/media/original-body.png',input.outfitUrl,hair.url]);
});

test('a one-reference model keeps the source identity and preserves card labels as text', async () => {
  const {renderer, calls, input, model} = rendererFixture();
  model.imageReferences.max = 1;
  await renderer.generateView({...input,slot:1,outfitUrl:'',visualReferences:[{label:'妆色样图',url:'/media/makeup.jpg'}]});
  assert.deepEqual(calls[0].referenceImages,['/media/original-face.png']);
  assert.match(calls[0].prompt,/按文字设定绘制：妆色样图/);
});

test('reopening remembers generated slots, underlying identity, and half-preview status', async () => {
  const {renderer,input,role} = rendererFixture();
  await renderer.generateView({...input,slot:1});
  const metadata = renderer.persistence(input.controls,input.outfitUrl);
  assert.deepEqual(Array.from(metadata.renderedSlots),[]);
  assert.equal(metadata.halfPreviewOnly,false);
  const images=Array.from(renderer.savedImages(input.controls,input.outfitUrl));
  assert.equal(images[1],role.images[1]);
  const saved={...role,images,styling:{version:1,controls:input.controls,outfitUrl:input.outfitUrl,...metadata}};
  const {renderer:reopened,calls}=rendererFixture(saved);
  assert.equal(reopened.viewFrame(1,input.controls,input.outfitUrl).url,metadata.halfPreviewUrl);
  assert.equal(reopened.isRendered(1,input.controls,input.outfitUrl),true);
  assert.equal(reopened.images({'hair.color':'brown'},input.outfitUrl)[1],role.images[1]);
  await reopened.generateAssets(input);
  assert.equal(calls.length,4,'a half preview is not the finished closeup asset');
  const finished={...role,images:Array.from(reopened.images(input.controls,input.outfitUrl)),
    styling:{...saved.styling,...reopened.persistence(input.controls,input.outfitUrl)}};
  const next=rendererFixture(finished);
  assert.equal(next.renderer.viewFrame(1,input.controls,input.outfitUrl).url,metadata.halfPreviewUrl);
  assert.notEqual(finished.images[1],metadata.halfPreviewUrl);
  const legacyStyle={...saved.styling,halfPreviewOnly:true,renderedSlots:[1],halfPreviewUrl:undefined};
  const legacy=rendererFixture({...role,images:[images[0],metadata.halfPreviewUrl,'',''],styling:legacyStyle}).renderer;
  assert.equal(legacy.viewFrame(1,input.controls,input.outfitUrl).url,metadata.halfPreviewUrl);
  assert.equal(legacy.savedImages(input.controls,input.outfitUrl)[1],role.images[1]);
  assert.equal(legacy.persistence(input.controls,input.outfitUrl).halfPreviewOnly,false);
  await next.renderer.generateAssets({...input,controls:{...input.controls,'hair.style.category':'另一分组','voice.style':'温柔'}});
  assert.equal(next.calls.length,0,'same visible style reuses its four saved assets across reload');
});

test('generation undo and redo restore distinct frames at the same parameter values', async () => {
  const {renderer,input,role} = rendererFixture();
  const before=renderer.capture(input.controls,input.outfitUrl);
  await renderer.generateView({...input,slot:1});
  const first=renderer.capture(input.controls,input.outfitUrl);
  await renderer.generateView({...input,slot:1});
  const second=renderer.capture(input.controls,input.outfitUrl);
  assert.notEqual(first.half,second.half);
  for (const frame of [before,first,second]) {
    renderer.restore(input.controls,input.outfitUrl, JSON.parse(JSON.stringify(frame)));
    assert.equal(renderer.images(input.controls,input.outfitUrl)[1],frame.half || role.images[1]);
    assert.equal(renderer.isRendered(1,input.controls,input.outfitUrl),!!frame.half);
  }
});

test('unchanged legacy characters keep their main picture and generate only missing derivatives', async () => {
  const pictures=['/media/full','/media/face','/media/expressions','/media/sheet'];
  const complete=rendererFixture({name:'图库角色',images:pictures});
  const unchanged={...complete.input,controls:{'voice.name':'声音'},outfitUrl:''};
  assert.equal(complete.renderer.remaining(unchanged.controls,''),0);
  assert.deepEqual(Array.from(await complete.renderer.generateAssets({...unchanged,modelId:''})),pictures);
  assert.equal(complete.calls.length,0);
  const partial=rendererFixture({images:[pictures[0],'',pictures[2],pictures[3]]});
  assert.equal(partial.renderer.remaining({},''),1);
  const images=Array.from(await partial.renderer.generateAssets(unchanged));
  assert.equal(partial.calls.length,1);assert.equal(images[0],pictures[0]);
  assert.equal(images[2],pictures[2]);assert.equal(partial.calls[0].referenceImages[0],pictures[0]);
  const styling={controls:{},...partial.renderer.persistence({},'')};
  assert.deepEqual(Array.from(styling.renderReadySlots),[0,1,2,3]);
  assert.deepEqual(Array.from(styling.renderedSlots),[1]);
  assert.equal(rendererFixture({images,styling}).renderer.remaining({},''),0);
});

test('parameter-only saves keep the confirmed images, their visual basis and supplier after a model is replaced', async () => {
  const f=rendererFixture();
  const a=Array.from(await f.renderer.generateAssets(f.input));
  const original=f.renderer.persistence(f.input.controls,f.input.outfitUrl);
  const saved={...f.role,images:a,styling:{controls:f.input.controls,outfitUrl:f.input.outfitUrl,...original}};
  const next=rendererFixture(saved);
  next.model.id='replacement-model'; await next.renderer.models(); next.renderer.selectModel(next.model.id);
  assert.deepEqual(Array.from(next.renderer.savedImages(f.input.controls,f.input.outfitUrl)),a);
  assert.equal(next.renderer.remaining(f.input.controls,f.input.outfitUrl),0);
  const edits={...f.input.controls,'body.figure.posture':63};
  const meta=next.renderer.persistence(edits,f.input.outfitUrl);
  assert.equal(meta.renderModelId,f.input.modelId);assert.equal(meta.renderBasisKey,original.renderBasisKey);
  assert.deepEqual(Array.from(meta.renderSlotModels),Array(4).fill(f.input.modelId));
  assert.deepEqual(Array.from(next.renderer.savedImages(edits,f.input.outfitUrl)),a);
  assert.equal(next.calls.length,0);
  const recovered=rendererFixture({...saved,styling:{...saved.styling,...meta,controls:edits}});
  assert.equal(recovered.renderer.remaining(edits,f.input.outfitUrl),4);
  assert.equal(recovered.renderer.remaining(f.input.controls,f.input.outfitUrl),0);
  assert.deepEqual(Array.from(recovered.renderer.savedImages(edits,f.input.outfitUrl)),a);
  const b=await next.renderer.generateView({...f.input,modelId:next.model.id,slot:1});
  assert.equal(next.calls[0].modelId,next.model.id);
  assert.equal(next.renderer.remaining(f.input.controls,f.input.outfitUrl),3);
  const mixed=next.renderer.persistence(f.input.controls,f.input.outfitUrl);
  assert.deepEqual(Array.from(mixed.renderSlotModels),Array(4).fill(f.input.modelId));
  assert.equal(mixed.halfPreviewModel,next.model.id);
  assert.deepEqual(Array.from(mixed.renderReadySlots),[0]);
  await next.renderer.generateAssets({...f.input,modelId:next.model.id});
  assert.equal(next.calls[1].referenceImages[0],b);assert.equal(next.calls[2].referenceImages[0],b);
  assert.equal(next.renderer.savedImages(f.input.controls,f.input.outfitUrl)[0],a[0]);
});

test('full image uses the original full body and downstream assets keep a newly confirmed half image under a one-reference limit', async () => {
  const f=rendererFixture();
  const input={...f.input,outfitUrl:'',controls:{'body.figure.posture':39}};
  assert.equal(f.renderer.plan(input.controls,'').primary,1);
  const full=await f.renderer.generateView({...input,slot:0});
  assert.equal(f.calls[0].referenceImages[0],f.role.images[0]);
  const half=await f.renderer.generateView({...input,slot:1});
  f.model.imageReferences.max=1;
  await f.renderer.models();
  const images=Array.from(await f.renderer.generateAssets({...input,previewFor:()=>({url:'/media/edited-original',label:'局部调整'})}));
  assert.equal(images[0],full);
  assert.deepEqual(f.calls[2].referenceImages,[half]);
  assert.deepEqual(f.calls[3].referenceImages,[half]);
  assert.deepEqual(f.calls[4].referenceImages,[full]);
});

test('ordered wardrobe references are included and changing a secondary outfit changes the visual cache', async () => {
  const f=rendererFixture();
  const outfits=['/media/shirt','/media/shoes'];
  const input={...f.input,outfitUrl:outfits[0],outfitUrls:outfits,slot:0};
  const url=await f.renderer.generateView(input);
  assert.deepEqual(f.calls[0].referenceImages,[...f.role.images,...outfits]);
  assert.equal(f.renderer.images(input.controls,outfits)[0],url);
  assert.equal(f.renderer.isRendered(0,input.controls,[outfits[0],'/media/hat']),false);
  assert.equal(f.renderer.isRendered(0,input.controls,outfits.toReversed()),false);
  assert.equal(f.renderer.persistence(input.controls,outfits).renderBasisKey.length,32);
  const limit=rendererFixture();
  limit.model.imageReferences.max=2;
  await assert.rejects(limit.renderer.generateView({...input,modelId:limit.model.id}),/减少服装参考图/);
  assert.equal(limit.calls.length,0);
});

test('recovering a draft with ungenerated changes keeps the last confirmed picture of an initially text-only role', async () => {
  const role={name:'新角色',value:'短发青年',images:[]};
  const f=rendererFixture(role), chosen={'hair.color':'blue'}, next={'hair.color':'green'};
  const image=await f.renderer.generateView({...f.input,slot:0,outfitUrl:'',controls:chosen});
  const snap=JSON.parse(JSON.stringify(f.renderer.capture(next,'')));
  const reopened=rendererFixture(role);
  reopened.renderer.restore(next,'',snap);
  assert.equal(reopened.renderer.savedImages(next,'')[0],image);
  assert.equal(reopened.renderer.previewSources()[0],image);
  assert.equal(reopened.renderer.remaining(chosen,''),3);
  assert.equal(reopened.renderer.remaining(next,''),4);
  reopened.model.imageReferences.max=0;
  await assert.rejects(reopened.renderer.generateView({...reopened.input,slot:0,outfitUrl:'',controls:next}),/身份参考图/);
  assert.equal(reopened.calls.length,0);
});

test('a receipt from a different visual state survives draft restore and reuses the submitted job without enabling the old model', async () => {
  const f=rendererFixture(), input={...f.input,outfitUrl:''};
  const changed={'body.figure.posture':61};
  const prior={assets:['','','',''],generated:[],job:{id:'role-7',slot:0,half:false,view:true,modelId:'retired-model'}};
  f.renderer.restore(input.controls,'',prior);
  assert.equal(f.renderer.plan(changed,'').pending,1);
  const snapshot=JSON.parse(JSON.stringify(f.renderer.capture(changed,'')));
  const next=rendererFixture();
  next.renderer.restore(changed,'',snapshot);
  assert.equal(next.renderer.plan(changed,'').pending,1);
  const url=await next.renderer.generateView({...input,modelId:'',controls:changed,slot:1});
  assert.equal(url,'/media/rendered-7.png');
  assert.equal(next.calls.length,0);
  assert.equal(next.renderer.plan(changed,'').pending,0);
  assert.equal(next.renderer.plan(changed,'').total,4);
  assert.equal(next.renderer.plan(input.controls,'').total,3);
  assert.equal(next.renderer.savedImages(changed,'')[0],url);
  assert.equal(next.renderer.persistence(changed,'').renderModelId,'retired-model');
});

test('failed resumed jobs clear their receipt and do not submit a replacement during the same action',async()=>{
  const f=rendererFixture(), input={...f.input,slot:1,outfitUrl:''};
  f.renderer.restore(input.controls,'',{generated:[],job:{id:'role-4',slot:1,half:true,view:true,modelId:input.modelId}});
  f.setFailure(4);
  await assert.rejects(f.renderer.generateView(input),/fixture paused/);
  assert.equal(f.calls.length,0);
  assert.equal(f.renderer.plan(input.controls,'').pending,0);
  await f.renderer.generateView(input);
  assert.equal(f.calls.length,1);
});

test('saving a newer half-only appearance retains the last approved full body without treating it as the new full-body asset',async()=>{
  const f=rendererFixture(),opts={...f.input,outfitUrl:''};
  const full=await f.renderer.generateView({...opts,slot:0});
  const edits={'body.figure.posture':61};
  const half=await f.renderer.generateView({...opts,controls:edits,slot:1});
  const images=Array.from(f.renderer.savedImages(edits,''));
  const meta=f.renderer.persistence(edits,'');
  assert.deepEqual(images.slice(0,2),[full,f.role.images[1]]);
  assert.equal(meta.halfPreviewUrl,half);
  assert.deepEqual(Array.from(meta.renderSlotModels).slice(0,2),[opts.modelId,'']);
  assert.deepEqual(Array.from(meta.renderReadySlots),[]);
  const reopened=rendererFixture({...f.role,images,styling:{controls:edits,...meta}});
  assert.deepEqual(Array.from(reopened.renderer.savedImages(edits,'')),images);
  assert.equal(reopened.renderer.plan(edits,'').total,4);
});
