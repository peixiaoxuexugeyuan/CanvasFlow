const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync, spawn} = require('node:child_process');
const {once} = require('node:events');
const readline = require('node:readline');
const {chromium} = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');
const browserAccess = require('./local-browser-access.cjs');
const root = path.resolve(__dirname, '..');

async function configureReverseDefaults(page) {
  const settings = page.locator('#settingsBackdrop');
  const tab = settings.locator('[data-settings-tab=reversePrompt]');
  const form = settings.getByRole('form', {name:'提示词反推模型配置'});
  const count = form.getByLabel('截取画面数');
  const frames = form.getByLabel('截取帧模型');
  const video = form.getByLabel('整段视频模型');
  async function open() {
    await page.locator('#inspectorToggle').click();
    await tab.click();
    await frames.locator('option[value="frames-preferred"]').waitFor({state:'attached'});
  }
  // This value was persisted with the previous 16-frame limit.
  await page.evaluate(() => localStorage.setItem('canvasflow-reverse-prompt-preferences-v1',
    JSON.stringify({frameCount:16, frameModelId:'', videoModelId:''})));
  await open();
  assert.ok(await settings.locator('[data-settings-tab=modelRegistry] + [data-settings-tab=reversePrompt] + [data-settings-tab=mediaKit]').isVisible());
  assert.equal(await count.inputValue(),'16');
  assert.equal(await frames.inputValue(),'');
  assert.equal(await video.inputValue(),'');
  assert.deepEqual(await count.locator('option').evaluateAll(options => options.map(option => option.value)),
    ['', ...Array.from({length:30}, (_, index) => String(index + 1))]);
  assert.deepEqual(await frames.locator('option').evaluateAll(options => options.map(option => option.value)),
    ['', 'frames','frames-preferred']);
  assert.deepEqual(await video.locator('option').evaluateAll(options => options.map(option => option.value)),
    ['', 'full','full-preferred']);
  await count.selectOption('30');
  await frames.selectOption('frames-preferred');
  await video.selectOption('full-preferred');
  await form.getByRole('button',{name:'保存配置'}).click();
  await form.getByText('配置已保存').waitFor();
  await settings.locator('#settingsClose').click();
  await page.reload();
  await open();
  assert.equal(await count.inputValue(),'30');
  assert.equal(await frames.inputValue(),'frames-preferred');
  assert.equal(await video.inputValue(),'full-preferred');
  await settings.locator('#settingsClose').click();
}

async function exerciseImage(page, origin, api, models, calls) {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jEOcAAAAASUVORK5CYII=', 'base64');
  const uploaded = await api('POST', '/api/media', {data:png, headers:{
    'Content-Type':'image/png','X-Media-Name':'photo.png','X-Media-Type':'image/png'
  }});
  const source = uploaded.media.url;
  const project = (await api('POST', '/api/projects', {data:{
    projectName:'图片反推测试',
    nodes:[{id:'photo',type:'image',left:330,top:170,title:'图片素材',previewMedia:source}],edges:[]
  }})).project;
  const start = calls.length;
  models.text = [{id:'plain',name:'纯文本模型'}];
  models.i2t = [];
  await page.goto(origin + '/?project=' + project.id);
  const photo = page.locator('[data-node-id=photo]');
  async function openImageTool() {
    await photo.locator('.media-preview').click();
    await page.locator('#nodeQuickToolbar [data-quick-tool=image-to-prompt]').click();
    const dialog = page.getByRole('dialog',{name:'提示词反推'});
    await dialog.waitFor();
    return dialog;
  }

  let dialog = await openImageTool();
  await dialog.getByText(/启用.*图片理解|支持图片理解的模型/).waitFor();
  assert.ok(await dialog.getByRole('button',{name:'确认反推'}).isDisabled());
  assert.equal(await dialog.locator('option[value="plain"]').count(),0);
  await dialog.getByRole('button',{name:'取消'}).click();
  models.i2t = [{id:'vision-a',name:'图像理解一'}, {id:'vision-b',name:'图像理解二'},
    {id:'frames-preferred',name:'视频截帧模型'}];
  dialog = await openImageTool();
  const model = dialog.getByRole('combobox');
  await model.locator('option[value="frames-preferred"]').waitFor({state:'attached'});
  assert.equal(await model.inputValue(),'vision-a','the video frame default must not change the single-image tool');
  await model.selectOption('vision-b');
  assert.equal(await dialog.getByRole('radio').count(),0);
  assert.equal(calls.length, start, 'selecting a model and opening the dialog must not call it');
  await dialog.getByRole('button',{name:'确认反推'}).click();
  await dialog.waitFor({state:'hidden'});
  assert.equal(calls.length,start + 1);
  const {path:route,body} = calls[start];
  assert.equal(route,'/api/ai/text-generate');
  assert.equal(body.modelId,'vision-b');
  assert.ok(!Object.hasOwn(body,'purpose'));
  assert.equal(body.projectId,project.id);
  assert.deepEqual(body.referenceImages,[source]);
  assert.ok(body.prompt.trim());
  const resultText = '测试镜头 ' + calls.length;
  await page.reload();
  await page.locator('.prompt-node .node-copy').filter({hasText:resultText}).waitFor();
  const saved = (await api('GET','/api/projects/'+project.id)).project;
  const result = saved.nodes.find(node=>node.type === 'prompt' && node.copy === resultText);
  assert.ok(result);
  assert.ok(saved.edges.some(edge=>edge.source === 'photo' && edge.target === result.id));
  assert.equal(calls.length,start + 1);

  let deliver;
  const received = new Promise(resolve => {
    page.route('**/api/ai/text-generate', async route => {
      await new Promise(release => { deliver = release; resolve(); });
      await route.fulfill({json:{text:'后台反推结果'}});
    });
  });
  dialog = await openImageTool();
  await dialog.getByRole('button',{name:'确认反推'}).click();
  await received;
  await dialog.getByRole('button',{name:'后台继续'}).click();
  await dialog.waitFor({state:'hidden'});
  const otherId = await page.evaluate(() => window.CanvasFlow.newProject({silent:true}));
  assert.ok(otherId && otherId !== project.id);
  const endpoint = '/api/projects/'+project.id;
  let legacyRead = true, failOnce = true;
  const revisions = [];
  await page.route('**'+endpoint, async route => {
    if (route.request().method() === 'GET' && legacyRead) {
      legacyRead = false;
      const {project:before} = await api('GET', endpoint);
      await api('PUT', endpoint, {data:{revision:before.revision,projectName:'后台保留改名',
        nodes:[...before.nodes,{id:'other-window',type:'prompt',copy:'并发编辑'}]}});
      delete before.revision;
      return route.fulfill({json:{project:before}});
    }
    if (route.request().method() === 'PUT') {
      revisions.push(route.request().postDataJSON().revision);
      if (revisions.length === 2 && failOnce) {
        failOnce = false;
        return route.fulfill({status:503,json:{message:'来源项目暂不可写'}});
      }
    }
    return route.continue();
  });
  deliver();
  await dialog.getByLabel('已生成的提示词').waitFor();
  assert.equal(await dialog.getByLabel('已生成的提示词').inputValue(),'后台反推结果');
  assert.equal(revisions[0],0,'legacy snapshots must still check the revision');
  await dialog.getByRole('button',{name:'重试保存结果'}).click();
  await dialog.waitFor({state:'hidden'});
  await page.waitForFunction(async id => {
    const {project} = await (await fetch('/api/projects/'+id)).json();
    const match = project.nodes.filter(n=>n.copy==='后台反推结果');
    return match.length===1 && project.projectName==='后台保留改名' && project.nodes.some(n=>n.id==='other-window') &&
      project.edges.some(e=>e.source==='photo' && e.target===match[0].id);
  }, project.id);
  assert.equal(await page.locator('.prompt-node .node-copy').filter({hasText:'后台反推结果'}).count(),0);
}

async function exercise(page, origin, access) {
  async function api(method, endpoint, options={}) {
    const response = await page.request.fetch(origin + endpoint, {method, ...options, headers:{...access.headers,...options.headers}});
    assert.ok(response.ok(), endpoint + ' ' + response.status());
    return response.json();
  }
  // High-detail source: full-resolution JPEGs exceed the frame request's 6 MB budget.
  const ffmpegRoot = path.join(root, '.runtime/openfilm-ffmpeg');
  const ffmpegBuild = fs.readdirSync(ffmpegRoot).find(name => name.startsWith('ffmpeg-'));
  const clip = execFileSync(path.join(ffmpegRoot, ffmpegBuild, 'bin/ffmpeg.exe'), [
    '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=768x768:rate=20,noise=alls=100:all_seed=42', '-t', '2',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', '-threads', '2',
    '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'
  ], {windowsHide:true, maxBuffer:12_000_000});
  const media = (await api('POST', '/api/media', {data:clip, headers:{...access.headers, 'Content-Type':'video/mp4',
    'X-Media-Name':'fixture.mp4','X-Media-Type':'video/mp4'}})).media.url;
  const project = (await api('POST','/api/projects',{data:{projectName:'视频工具测试',nodes:[
    {id:'clip',type:'model',left:330,top:150,title:'拍摄参考',videoUrl:media,jobStatus:'completed'}
  ],edges:[]}})).project;
  const models = {
    i2t:[{id:'frames',name:'图像理解'}, {id:'frames-preferred',name:'默认读图模型'}],
    videoUnderstanding:[{id:'full',name:'视频理解'}, {id:'full-preferred',name:'默认视频模型'}]
  };
  const calls = [], errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== origin) return route.abort();
    switch (url.pathname) {
      case '/api/ai/models': return route.fulfill({json:{models:{text:[],video:[],audio:[],t2i:[],...models}}});
      case '/api/agent/community-skills': return route.fulfill({json:{skills:[],count:0}});
      case '/api/ai/text-generate':
      case '/api/ai/video-to-prompt':
        calls.push({path:url.pathname,body:req.postDataJSON()});
        return route.fulfill({json:{text:'测试镜头 ' + calls.length}});
      case '/api/media-tools/depth': {
        const data = req.postDataJSON();
        calls.push({path:url.pathname,body:data});
        return route.fulfill({json:{job:{id:'depth-fixture',owner:'local',projectId:project.id,kind:'video',
          status:'completed',progress:100,providerProtocol:'mediakit-depth',videoUrl:media,outputId:data.nodeId}}});
      }
      case '/api/jobs/depth-fixture': return route.fulfill({json:{job:{id:'depth-fixture',status:'completed',
        kind:'video',providerProtocol:'mediakit-depth',videoUrl:media,progress:100}}});
      default: return route.continue();
    }
  });
  await page.addInitScript(() => localStorage.setItem('canvasflow-startup-animation', JSON.stringify({enabled:false})));
  await page.goto(access.link);
  await page.waitForURL(origin + '/');
  await page.goto(origin + '/?project=' + project.id);
  await configureReverseDefaults(page);
  async function open(tool) {
    const button = page.locator('#nodeQuickToolbar [data-quick-tool=' + tool + ']');
    if (!await button.isVisible()) await page.locator('[data-node-id=clip] .node-title').click();
    await button.click();
    const dialog = page.getByRole('dialog', {name:tool === 'video-depth' ? '深度动作捕捉' : '提示词反推'});
    await dialog.waitFor();
    return dialog;
  }
  let dialog = await open('video-to-prompt');
  assert.equal(calls.length,0);
  assert.equal(await dialog.locator('input:checked').count(), 0);
  assert.ok(await dialog.getByRole('button',{name:'确认反推'}).isDisabled());
  await dialog.getByLabel('截取帧',{exact:true}).check();
  await dialog.getByText(/30 帧.*不含音轨/).waitFor();
  await page.evaluate(() => {
    window.frameSizes = [];
    const encode = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const image = encode.apply(this, args);
      if (args[0] === 'image/jpeg') window.frameSizes.push({width:this.width, size:image.length});
      return image;
    };
  });
  await dialog.getByRole('button',{name:'确认反推'}).click();
  await dialog.waitFor({state:'hidden'});
  assert.equal(calls[0].path, '/api/ai/text-generate');
  assert.equal(calls[0].body.modelId,'frames-preferred');
  assert.equal(calls[0].body.purpose,'video_prompt_frames');
  assert.ok(calls[0].body.referenceImages.every(url => url.startsWith('data:image/jpeg;base64,')));
  assert.equal(calls[0].body.referenceImages.length,30);
  assert.equal([...calls[0].body.prompt.matchAll(/([\d.]+) 秒/g)].length,30);
  const fullSizeBytes = await page.evaluate(() =>
    window.frameSizes.filter(frame => frame.width === 768).reduce((sum, frame) => sum + frame.size, 0));
  assert.ok(fullSizeBytes > 6_000_000, 'original frames should exercise the oversized-clip path');
  const sentBytes = calls[0].body.referenceImages.reduce((sum, frame) => sum + frame.length, 0);
  assert.ok(sentBytes <= 6_000_000);
  console.log('30 JPEG frames: ' + fullSizeBytes + ' encoded bytes at full size, ' + sentBytes + ' bytes submitted.');
  assert.ok(new Set(calls[0].body.referenceImages).size > 1);
  assert.ok(!Object.hasOwn(calls[0].body,'videoUrl'));
  dialog = await open('video-to-prompt');
  assert.ok(await dialog.getByLabel('截取帧',{exact:true}).isChecked());
  await dialog.getByLabel('整段视频',{exact:true}).check();
  await dialog.getByText(/含原有音轨/).waitFor();
  await dialog.getByRole('button',{name:'确认反推'}).click();
  await dialog.waitFor({state:'hidden'});
  assert.deepEqual(calls[1],{path:'/api/ai/video-to-prompt',body:{mode:'video',modelId:'full-preferred',videoUrl:media,projectId:project.id}});
  models.videoUnderstanding = [{id:'full',name:'视频理解'}];
  dialog = await open('video-to-prompt');
  await dialog.getByText(/默认.*不可用/).waitFor();
  assert.ok(await dialog.getByLabel('整段视频',{exact:true}).isChecked());
  assert.ok(await dialog.getByRole('button',{name:'确认反推'}).isDisabled());
  assert.equal(await dialog.getByRole('combobox').inputValue(),'');
  await dialog.getByRole('combobox').selectOption('full');
  assert.ok(await dialog.getByRole('button',{name:'确认反推'}).isEnabled());
  assert.equal(calls.length,2);
  await dialog.getByRole('button',{name:'取消'}).click();
  dialog = await open('video-depth');
  const configure = dialog.getByRole('button',{name:'前往偏好设置'});
  await configure.waitFor();
  assert.ok(await dialog.getByRole('button',{name:'确认提取'}).isDisabled());
  assert.equal(await dialog.locator('input[type=password]').count(),0);
  await configure.click();
  const settings = page.locator('#settingsBackdrop');
  assert.ok(await settings.locator('[data-settings-tab=reversePrompt] + [data-settings-tab=mediaKit].is-active').isVisible());
  const mediaKit = settings.getByRole('form',{name:'MediaKit 凭据'});
  await mediaKit.getByText('尚未配置 MediaKit 凭据').waitFor();
  const key = mediaKit.getByLabel('MediaKit API Key');
  await key.fill('offline-mediakit-test');
  await key.press('Enter');
  await mediaKit.getByText('已配置 MediaKit 凭据').waitFor();
  assert.equal(await key.inputValue(),'');
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('offline-mediakit-test')),false);
  await settings.locator('#settingsClose').click();
  await dialog.waitFor();
  assert.equal(calls.length,2,'saving credentials does not submit a task');
  await dialog.getByRole('button',{name:'确认提取'}).click();
  await dialog.waitFor({state:'hidden'});
  assert.equal(calls[2].body.sourceUrl,media);
  await page.waitForFunction(() => document.querySelector('[data-video-tool=depth]')?.dataset.videoUrl);
  await page.waitForFunction(async id => {
    const data = await (await fetch('/api/projects/' + id)).json();
    return data.project?.nodes.some(n=>n.videoTool === 'depth' && n.videoUrl)
      && data.project.edges.filter(e=>e.source === 'clip').length === 3;
  },project.id);
  await page.reload();
  await page.locator('[data-video-tool=depth]').waitFor();
  const saved = (await api('GET','/api/projects/'+project.id)).project;
  assert.deepEqual(saved.nodes.filter(n=>n.type==='prompt').map(n=>n.copy).sort(),['测试镜头 1','测试镜头 2']);
  assert.equal(calls.length,3);
  await exerciseImage(page,origin,api,models,calls);
  assert.deepEqual(errors,[]);
}

async function main() {
  const script = [
    'import os, tempfile, json, threading, sys',
    'with tempfile.TemporaryDirectory(prefix="canvasflow-video-tools-") as data:',
    '    os.environ.update(CANVASFLOW_DATA_DIR=data, LOCALAPPDATA=data)',
    '    import server',
    '    server.Handler.log_message = lambda *args: None',
    '    httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)',
    '    report = httpd.handle_error',
    '    httpd.handle_error = lambda req, addr: None if isinstance(sys.exc_info()[1], ConnectionError) else report(req, addr)',
    '    thread = threading.Thread(target=httpd.serve_forever, daemon=True); thread.start()',
    '    print(json.dumps({"origin":"http://127.0.0.1:"+str(httpd.server_port),"data":data}), flush=True)',
    '    sys.stdin.readline(); httpd.shutdown(); httpd.server_close(); thread.join()'
  ].join('\n');
  const server = spawn(path.join(root,'.runtime/python/python.exe'),['-u','-c',script],{cwd:root,windowsHide:true,stdio:['pipe','pipe','inherit']});
  const closed = once(server,'exit');
  let browser;
  try {
    let fixture;
    for await (const line of readline.createInterface({input:server.stdout})) {
      if (line.startsWith('{"origin"')) { fixture = JSON.parse(line); break; }
    }
    assert.ok(fixture);
    const access = browserAccess(root,fixture.data,fixture.origin);
    browser = await chromium.launch({executablePath:path.join(root,'.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
    const page = await browser.newPage({viewport:{width:1417,height:881},reducedMotion:'reduce'});
    page.setDefaultTimeout(10000);
    await exercise(page,fixture.origin,access);
    console.log('Video and image prompt tools, model selection, depth output and reloaded graphs passed.');
  } finally { await browser?.close(); server.stdin.end('\n'); await closed; }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
