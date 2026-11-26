const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const root = path.resolve(__dirname, '..');
const mp4 = fs.readFileSync(path.join(root, 'tools/openfilm/node_modules/openfilm/library/transitions/wipe/preview.mp4'));
const script = fs.readFileSync(path.join(root, 'canvas-video-tools.js'));
const preferences = fs.readFileSync(path.join(root, 'canvas-reverse-preferences.js'));
const server = http.createServer((req, res) => {
  if (req.url === '/clip.mp4') {
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Number(range[2]) : mp4.length - 1;
    res.writeHead(range ? 206 : 200, {
      'Content-Type':'video/mp4', 'Accept-Ranges':'bytes', 'Content-Length':end-start+1,
      ...(range && {'Content-Range':`bytes ${start}-${end}/${mp4.length}`})
    }).end(mp4.subarray(start,end+1));
  } else if (req.url === '/tools.js') res.writeHead(200, {'Content-Type':'text/javascript'}).end(script);
  else if (req.url === '/preferences.js') res.writeHead(200, {'Content-Type':'text/javascript'}).end(preferences);
  else res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'}).end('<script src="/preferences.js"></script><script src="/tools.js"></script>');
});

async function exercise(page, url) {
  await page.goto(url);
  await page.evaluate(() => {
    const run = window.run = {calls:[], messages:[], text:[], configured:false, depth:0,
      catalog:{i2t:[{id:'vision-a'},{id:'vision-b'}], videoUnderstanding:[{id:'video-a'}]}};
    const options = {
      owner:{}, preferenceKey:'test-workspace', projectId:'clip-project', sourceUrl:'/clip.mp4', label:'测试镜头', trim:{start:0.3,end:1.4},
      check() {}, notify(message) { run.messages.push(message); }, writeText(text) { run.text.push(text); },
      async request(path, init) {
        if (!init) return path.endsWith('/models') ? {models:run.catalog} : {configured:run.configured};
        const payload = JSON.parse(init.body);
        if (path.endsWith('/settings')) { run.configured = !!payload.apiKey; return {configured:run.configured}; }
        run.calls.push({path, payload});
        if (path.endsWith('video-prompt-frames')) {
          const count = payload.frameCount ?? 2;
          const times = Array.from({length:count}, (_, i) =>
            payload.trimStart + (i + 0.5) * (payload.trimEnd - payload.trimStart) / count);
          return {referenceImages:times.map((_, i) => 'decoded-frame-' + i), times};
        }
        if (run.fail) throw new Error('模拟供应商拒绝当前输入');
        return {text:'已分析素材。'};
      },
      async submitDepth() { run.depth++; }
    };
    window.openTool = (toolId = 'video-to-prompt', sourceUrl = '/clip.mp4') => window.CanvasVideoTools.open({...options,toolId,sourceUrl});
  });
  const modal = page.getByRole('dialog');
  const select = modal.getByRole('combobox');
  const frameMode = modal.getByRole('radio',{name:'截取帧'});
  const videoMode = modal.getByRole('radio',{name:'整段视频'});
  const confirm = modal.getByRole('button',{name:'确认反推'});
  await page.evaluate(() => openTool());
  assert.ok(await confirm.isDisabled());
  assert.equal(await modal.locator('input:checked').count(), 0);
  assert.match(await modal.innerText(), /0\.30–1\.40 秒/);
  await frameMode.check();
  assert.match(await modal.innerText(), /不含音轨.*收费/);
  assert.deepEqual(await select.locator('option').allTextContents(), ['vision-a','vision-b']);
  await select.selectOption('vision-b');
  await confirm.click();
  await modal.waitFor({state:'hidden'});
  const frames = await page.evaluate(() => run.calls[0]);
  assert.equal(frames.path, '/api/ai/text-generate');
  assert.equal(frames.payload.modelId, 'vision-b');
  assert.deepEqual(Object.keys(frames.payload).sort(), ['modelId', 'projectId', 'prompt', 'purpose', 'referenceImages']);
  assert.equal(frames.payload.purpose,'video_prompt_frames');
  assert.equal(frames.payload.referenceImages.length, 3);
  assert.ok(frames.payload.referenceImages.every(frame => frame.startsWith('data:image/jpeg;base64,') && frame.length > 500));
  assert.deepEqual([...frames.payload.prompt.matchAll(/([\d.]+) 秒/g)].map(match=>Number(match[1])), [.48,.85,1.22]);

  await page.evaluate(() => openTool());
  assert.ok(await frameMode.isChecked());
  assert.equal(await select.inputValue(),'vision-b');
  await videoMode.check();
  assert.deepEqual(await select.locator('option').allTextContents(), ['video-a']);
  assert.match(await modal.innerText(), /含原有音轨.*收费/);
  await page.evaluate(() => { run.fail = true; });
  await confirm.click();
  await modal.getByText('模拟供应商拒绝当前输入').waitFor();
  assert.ok(await videoMode.isChecked());
  assert.equal(await page.evaluate(() => run.calls.length),2);
  const native = await page.evaluate(() => run.calls[1]);
  assert.deepEqual(native, {path:'/api/ai/video-to-prompt',payload:{
    mode:'video', modelId:'video-a', videoUrl:'/clip.mp4', projectId:'clip-project', trimStart:.3, trimEnd:1.4
  }});
  await page.evaluate(() => { run.fail = false; });
  await confirm.click();
  await modal.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(() => run.text.length),2);
  await page.evaluate(() => { run.catalog.videoUnderstanding = []; return openTool(); });
  assert.ok(await videoMode.isChecked());
  assert.ok(await confirm.isDisabled());
  assert.match(await modal.innerText(), /没有兼容模型/);
  await modal.getByRole('button',{name:'取消'}).click();

  await page.evaluate(() => openTool('video-to-prompt','https://fixture.invalid/remote.mp4'));
  await frameMode.check();
  await confirm.click();
  await modal.waitFor({state:'hidden'});
  const [decode, analysis] = await page.evaluate(() => run.calls.slice(-2));
  assert.deepEqual(decode,{path:'/api/ai/video-prompt-frames',payload:{projectId:'clip-project',
    videoUrl:'https://fixture.invalid/remote.mp4',trimStart:.3,trimEnd:1.4}});
  assert.equal(analysis.path,'/api/ai/text-generate');
  assert.ok(!JSON.stringify(analysis.payload).includes('remote.mp4'));
  assert.deepEqual(analysis.payload.referenceImages,['decoded-frame-0','decoded-frame-1']);
  assert.match(analysis.payload.prompt,/0\.57 秒、1\.13 秒/);

  await page.evaluate(() => {
    CanvasFlowReversePreferences.save({frameCount:30, frameModelId:'vision-b', videoModelId:''});
    return openTool('video-to-prompt','https://fixture.invalid/remote.mp4');
  });
  await modal.getByText(/均匀截取 30 帧/).waitFor();
  await confirm.click();
  await modal.waitFor({state:'hidden'});
  const [manualDecode, manualAnalysis] = await page.evaluate(() => run.calls.slice(-2));
  assert.deepEqual(manualDecode, {path:decode.path, payload:{...decode.payload,frameCount:30}});
  assert.equal(manualAnalysis.payload.modelId,'vision-b');
  assert.equal(manualAnalysis.payload.purpose,'video_prompt_frames');
  assert.deepEqual(manualAnalysis.payload.referenceImages,Array.from({length:30}, (_, i) => 'decoded-frame-' + i));
  await assert.rejects(page.evaluate(() => CanvasFlowReversePreferences.save({frameCount:31})), /30/);
  assert.equal(await page.evaluate(() => CanvasFlowReversePreferences.read().frameCount),30);

  await page.evaluate(() => openTool('video-depth'));
  const extract = modal.getByRole('button',{name:'确认提取'});
  assert.ok(await extract.isDisabled());
  assert.equal(await modal.locator('input[type=password]').count(),0);
  await page.evaluate(() => { window.CanvasFlowSettings = {open:tab => { run.settingsTab = tab; }}; });
  await modal.getByRole('button',{name:'前往偏好设置'}).click();
  await modal.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(() => run.settingsTab),'mediaKit');
  assert.equal(await page.evaluate(() => run.depth),0);
  await page.evaluate(() => { run.configured = true; return openTool('video-depth'); });
  assert.ok(await extract.isEnabled());
  await extract.click();
  await modal.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(() => run.depth),1);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:path.join(root,'.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
    await exercise(await browser.newPage(), 'http://127.0.0.1:' + server.address().port);
    console.log('Video tools: real clipped frame decoding, explicit mode, model fit, request shape, no fallback and depth credential confirmation passed.');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
