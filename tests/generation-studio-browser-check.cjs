// Exercise the real app navigation and adapters. Generation POSTs never reach a provider.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { chromium } = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const root = path.resolve(__dirname, '..');
const tempData = fs.mkdtempSync(path.join(os.tmpdir(), 'canvasflow-studio-'));
const server = spawn(path.join(root, '.runtime/python/python.exe'), ['-u', '-c', [
  'from server import Handler, ThreadingHTTPServer, ACCOUNT_STORAGE',
  "httpd = ThreadingHTTPServer(('127.0.0.1', 0), Handler)",
  'ACCOUNT_STORAGE.sync(force=True)',
  "print('STUDIO_PORT', httpd.server_address[1], flush=True)",
  'httpd.serve_forever()'
].join('\n')], {cwd: root, windowsHide: true, env: {...process.env, CANVASFLOW_DATA_DIR: tempData, LOCALAPPDATA: tempData}, stdio: ['ignore','pipe','inherit']});

async function serverOrigin() {
  for await (const line of readline.createInterface({input: server.stdout})) {
    const match = line.match(/^STUDIO_PORT (\d+)$/);
    if (match) return 'http://127.0.0.1:' + match[1];
  }
  throw Error('隔离服务未启动');
}
const row = (key, label, values) => ({
  key, label, field: key, default: values[0], options: values.map(value => ({value, label: String(value)}))
});
const imageModel = {id:'img-model', model:'test-image', name:'图片测试模型', imageReferences:{min:0, max:3}};
const videoModel = {id:'vid-model', model:'test-video', name:'视频测试模型', mediaGenerate:true};
const referenceModel = {id:'vid-ref-model', model:'test-reference', name:'普通参考图测试模型', mediaGenerate:true};
const catalog = {models:{t2i:[imageModel],video:[videoModel,referenceModel],text:[],i2t:[],audio:[]}};
const specs = {image:{'test-image':[row('aspectRatio','画面比例',['1:1','16:9']), row('resolution','分辨率',['1K','2K']), row('count','生成张数',[1,3])]},
  video:{'test-video':[row('duration','时长',['5','10']), row('aspectRatio','画面比例',['16:9','9:16'])]}};
const contracts = {'vid-model':{
  providerContract:{max_image:2,max_audio:1,max_video:1,apiReferenceModes:['text2video','singleImage2video','frames2video','mixed2video']},
  params:[
    {name:'mode',type:'select',options:['wensheng','shouweizhen','cankaosheng'].map(value=>({value}))},
    {name:'images',type:'upload',label:'首尾帧'}, {name:'reference_video',type:'upload'}, {name:'audio',type:'upload'}
  ]
}, 'vid-ref-model':{
  providerContract:{max_image:2, apiReferenceModes:['text2video','image2video']},
  params:[{name:'images',type:'upload',label:'参考图片'}]
}};
const assets = [
  {id:'start',name:'第一帧',kind:'image',url:'/media/start.png'},
  {id:'end',name:'最后一帧',kind:'image',url:'/media/end.png'},
  {id:'sound',name:'配乐',kind:'audio',url:'/media/sound.wav'},
  {id:'clip',name:'运镜素材',kind:'video',url:'https://assets.example.test/clip.mp4'}
];

let browser;
async function main() {
  const origin = await serverOrigin();
  browser = await chromium.launch({executablePath:path.join(root,'.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
  const page = await browser.newPage({viewport:{width:1092,height:871}, reducedMotion:'reduce'});
  const generated = {image:[],video:[]}, jobs = {image:[],video:[]}, errors = [];
  const uploads = [];
  const localPng = path.join(root, 'assets/agent-skills/cover-2.png');
  const uploadUrl = '/media/uploaded-cover.png';
  const batchPrompt = '切换页面后继续提交三张图片';
  let releaseFirst;
  const firstResponseGate = new Promise(resolve => { releaseFirst = resolve; });
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('canvasflow-startup-animation', JSON.stringify({enabled:false})));
  await page.route('**/*', async route=>{
    const req=route.request(), url=new URL(req.url()), endpoint=url.pathname;
    if(url.origin!==origin)return route.abort();
    if(endpoint==='/api/ai/models')return route.fulfill({json:catalog});
    if(endpoint==='/api/model-specs')return route.fulfill({json:{specs,contracts}});
    if(endpoint==='/api/workspace/materials')return route.fulfill({json:{materials:assets}});
    if(endpoint==='/api/agent/community-skills')return route.fulfill({json:{skills:[]}});
    if(req.method()==='POST' && endpoint==='/api/media'){
      uploads.push({type:req.headers()['content-type'], name:req.headers()['x-media-name'], bytes:req.postDataBuffer()});
      return route.fulfill({json:{media:{kind:'image',url:uploadUrl}}});
    }
    if(endpoint.startsWith('/media/') && endpoint.endsWith('.png'))return route.fulfill({contentType:'image/png',path:path.join(root,'assets/agent-skills/cover-1.png')});
    if(endpoint==='/media/sound.wav')return route.fulfill({contentType:'audio/wav',body:Buffer.from('RIFF0000WAVE')});
    if(endpoint==='/api/jobs'){
      const kind=url.searchParams.get('kind'), status=url.searchParams.get('status');
      const list=(jobs[kind]||[]).filter(j=>!status||j.status===status);
      return route.fulfill({json:{jobs:list,total:list.length,activeCount:0}});
    }
    if(req.method()==='POST' && ['/api/ai/image-generate','/api/generate'].includes(endpoint)){
      const kind=endpoint.endsWith('image-generate')?'image':'video', body=req.postDataJSON();
      generated[kind].push(body);
      const id=kind+'-'+generated[kind].length;
      if (body.prompt === batchPrompt && !jobs.image.some(job => job.prompt === batchPrompt)) {
        await firstResponseGate;
      }
      jobs[kind].unshift({id,kind,prompt:body.prompt,modelId:body.modelId,studioDraft:body.studioDraft,
        status:kind==='image'?'completed':'queued',imageUrl:kind==='image'?'/media/output.png':undefined});
      return route.fulfill({json:{jobId:id}});
    }
    if(req.method()==='POST' && endpoint.startsWith('/api/ai/'))return route.abort();
    return route.continue();
  });
  const studio=page.locator('.generation-studio'), prompt=studio.locator('[name=prompt]');
  const capture = async name => {
    if (!process.argv.includes('--screenshots')) return;
    const dir = path.join(root, 'build-private', 'generation-studio-check');
    fs.mkdirSync(dir, {recursive:true});
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#toast')).opacity === '0');
    await page.screenshot({path:path.join(dir, name+'.png')});
  };
  const open = async kind => {
    await page.locator('[data-view="'+kind+'-studio"]').click();
    await studio.locator('[name=model]:enabled').waitFor();
  };
  const choose = async (slot,name) => {
    await studio.locator('[data-slot="'+slot+'"]').getByRole('button',{name:'素材库',exact:true}).click();
    const picker=page.locator('.studio-material-picker[open]');
    await picker.getByRole('searchbox').fill(name);
    await picker.getByRole('button',{name,exact:true}).click();
    await studio.locator('[data-slot="'+slot+'"] .studio-ref-chip').filter({hasText:name}).waitFor();
  };
  const submit = async (kind,number) => {
    await studio.locator('button[type=submit]').click();
    await studio.locator('[data-job-id="'+kind+'-'+number+'"]').waitFor();
    assert.doesNotMatch(await page.locator('#toastText').textContent(), /模板还在加载中/);
    return generated[kind][number-1];
  };
  await page.goto(require('./local-browser-access.cjs')(root,tempData,origin).link);
  await page.waitForURL(origin+'/');
  await open('image');
  assert.equal(await page.locator('.main-area > .topbar').isHidden(), true);
  await studio.locator('.studio-hero-art').evaluate(img => img.decode());
  await prompt.fill('保留我的构图');
  const sample = studio.getByRole('button', {name:/琥珀香水静物.*使用提示词/});
  await sample.click();
  const withExample = await prompt.inputValue();
  assert.ok(withExample.startsWith('保留我的构图') && withExample.includes('玻璃'));
  await sample.click();
  assert.equal(await prompt.inputValue(),withExample);
  assert.equal(generated.image.length,0);
  await prompt.fill('雪山日出');
  await studio.locator('[name=aspectRatio]').selectOption('16:9');
  await choose('referenceImages','第一帧');
  const img=await submit('image',1);
  assert.equal(img.asyncTask,true);
  assert.equal(img.modelId,imageModel.id);
  assert.equal(img.prompt,'雪山日出');
  assert.deepEqual(img.referenceImages,['/media/start.png']);
  assert.deepEqual(img.studioDraft.refs.referenceImages.map(r=>r.url),img.referenceImages);
  assert.equal(img.studioDraft.settings.aspectRatio,'16:9');
  await studio.locator('[data-result] img').waitFor();
  const originalSize=img.size.split('x').map(Number);
  assert.ok(originalSize[0]>originalSize[1]);
  await prompt.fill('待修改');
  await studio.locator('[name=aspectRatio]').selectOption('1:1');
  await studio.getByRole('button',{name:'移除第一帧'}).click();
  await studio.getByRole('button',{name:'载入参数'}).click();
  assert.equal(await prompt.inputValue(),'雪山日出');
  assert.equal(await studio.locator('[name=aspectRatio]').inputValue(),'16:9');
  assert.equal(await studio.locator('.studio-ref-chip').count(),1);
  await capture('image-studio');

  await open('video');
  await studio.locator('.studio-hero-art').evaluate(img => img.decode());
  await prompt.fill('镜头从雪山移向城市');
  const mode=studio.locator('[name=referenceMode]');
  await studio.getByRole('button',{name:'首尾帧',exact:true}).click();
  assert.equal(await mode.inputValue(),'frames2video');
  await choose('firstFrame','第一帧');
  await studio.locator('button[type=submit]').click();
  await studio.locator('[data-submit-status]').filter({hasText:'尾帧'}).waitFor();
  assert.equal(generated.video.length,0);
  await choose('lastFrame','最后一帧');
  await studio.locator('[name=duration]').selectOption('10');
  await capture('video-frames');
  const frames=await submit('video',1);
  assert.equal(frames.modelId,videoModel.id);
  assert.equal(frames.generationSettings.referenceMode,'frames2video');
  assert.equal(frames.generationSettings.modelOptions.mode,'shouweizhen');
  assert.equal(String(frames.generationSettings.duration),'10');
  assert.deepEqual(frames.referenceImages,['/media/start.png','/media/end.png']);
  await studio.getByRole('button',{name:'全能参考',exact:true}).click();
  assert.equal(await mode.inputValue(),'mixed2video');
  await page.setViewportSize({width:390,height:844});
  const rightEdges = await studio.locator('.studio-mode-switch, .studio-form, [data-slot], .studio-submit, .studio-hero-settings')
    .evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().right));
  assert.ok(rightEdges.every(right => right <= 390),'Studio controls should fit the narrow viewport');
  assert.ok(await studio.locator('.studio-form').evaluate(el => el.clientWidth >= 270));
  await page.setViewportSize({width:1092,height:871});
  await choose('imageRefs','最后一帧');
  await choose('videoRefs','运镜素材');
  await choose('audioRefs','配乐');
  await capture('video-mixed');
  const mixed=await submit('video',2);
  assert.equal(mixed.generationSettings.referenceMode,'mixed2video');
  assert.equal(mixed.generationSettings.modelOptions.mode,'cankaosheng');
  assert.deepEqual(mixed.referenceImages,['/media/end.png']);
  assert.deepEqual(mixed.sourceVideos,['https://assets.example.test/clip.mp4']);
  assert.equal(mixed.sourceAudios[0],'/media/sound.wav');
  assert.equal(mixed.studioDraft.refs.audioRefs[0].url,'/media/sound.wav');
  await prompt.fill('继续调整分镜');
  await open('image');
  assert.equal(await prompt.inputValue(),'雪山日出');
  assert.equal(await studio.locator('.studio-ref-chip').count(),1);
  await open('video');
  assert.equal(await prompt.inputValue(),'继续调整分镜');
  assert.equal(await mode.inputValue(),'mixed2video');
  assert.equal(await studio.locator('.studio-ref-chip').count(),3);

  await open('image');
  const refs = studio.locator('[data-slot=referenceImages]');
  const fileChooser = page.waitForEvent('filechooser');
  await refs.getByRole('button', {name:'本机上传'}).click();
  await (await fileChooser).setFiles(localPng);
  const uploadChip = refs.locator('.studio-ref-chip').filter({hasText:'cover-2.png'});
  await uploadChip.waitFor();
  assert.equal(await uploadChip.locator('img').getAttribute('src'), uploadUrl);
  assert.equal(uploads.length,1);
  assert.equal(uploads[0].type,'image/png');
  assert.equal(uploads[0].name,'cover-2.png');
  assert.ok(uploads[0].bytes.equals(fs.readFileSync(localPng)));

  await prompt.fill(batchPrompt);
  await studio.locator('[name=count]').selectOption('3');
  const firstRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/ai/image-generate') && request.postDataJSON().prompt === batchPrompt);
  await studio.locator('button[type=submit]').click();
  await firstRequest;
  await open('video');
  assert.equal(jobs.image.filter(job=>job.prompt===batchPrompt).length,0);
  const completedBatch = page.waitForFunction(() => document.getElementById('toastText').textContent.includes('3 个图片任务已提交'));
  releaseFirst();
  await completedBatch;
  const submittedImages = generated.image.filter(body => body.prompt === batchPrompt);
  assert.equal(submittedImages.length,3);
  for (const body of submittedImages) {
    assert.equal(body.asyncTask,true);
    assert.equal(String(body.studioDraft.settings.count),'3');
    assert.deepEqual(body.referenceImages,['/media/start.png',uploadUrl]);
  }
  await open('image');
  await studio.locator('[data-job-id=image-4]').waitFor();

  await open('video');
  await mode.selectOption('text2video');
  await studio.getByRole('button',{name:'添加首帧',exact:true}).click();
  assert.equal(await mode.inputValue(),'singleImage2video');
  const picker = page.getByRole('dialog',{name:'选择首帧'});
  await picker.getByRole('button',{name:'第一帧',exact:true}).click();
  await studio.locator('[data-slot=firstFrame] .studio-ref-chip').filter({hasText:'第一帧'}).waitFor();
  const single = await submit('video',3);
  assert.equal(single.modelId,videoModel.id);
  assert.equal(single.generationSettings.referenceMode,'singleImage2video');
  assert.deepEqual(single.referenceImages,['/media/start.png']);
  assert.equal(single.studioDraft.refs.firstFrame[0].url,single.referenceImages[0]);

  await studio.locator('[name=model]').selectOption(referenceModel.id);
  assert.equal(await mode.inputValue(),'text2video');
  assert.equal(await studio.getByRole('button',{name:'添加首帧',exact:true}).count(),0);
  await studio.getByRole('button',{name:'添加参考图',exact:true}).click();
  assert.equal(await mode.inputValue(),'image2video');
  const referencePicker = page.getByRole('dialog',{name:'选择参考图片'});
  const pickerFile = page.waitForEvent('filechooser');
  await referencePicker.getByRole('button',{name:'本机上传',exact:true}).click();
  await (await pickerFile).setFiles(localPng);
  await referencePicker.waitFor({state:'detached'});
  const refChip = studio.locator('[data-slot=imageRefs] .studio-ref-chip').filter({hasText:'cover-2.png'});
  await refChip.waitFor();
  assert.equal(await refChip.locator('img').getAttribute('src'),uploadUrl);
  assert.equal(uploads.length,2);
  assert.ok(uploads[1].bytes.equals(fs.readFileSync(localPng)));
  const reference = await submit('video',4);
  assert.equal(reference.modelId,referenceModel.id);
  assert.equal(reference.generationSettings.referenceMode,'image2video');
  assert.deepEqual(reference.referenceImages,[uploadUrl]);
  assert.equal(reference.studioDraft.refs.imageRefs[0].url,uploadUrl);
  assert.deepEqual(errors,[]);
  console.log('Studio app paths passed: image drafts and history, asset picker and binary upload, frame order, mixed reference requests, background image batches, first-frame and ordinary reference shortcuts with picker upload.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  await browser?.close();
  server.kill();
});
