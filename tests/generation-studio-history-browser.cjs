const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const root = path.resolve(__dirname, '..');
const runtimes = path.join(root, '.runtime');
const ffmpegRoot = path.join(runtimes, 'openfilm-ffmpeg');
const ffmpegBuild = fs.readdirSync(ffmpegRoot).find(name => name.startsWith('ffmpeg-'));
const video = execFileSync(path.join(ffmpegRoot, ffmpegBuild, 'bin', 'ffmpeg.exe'), [
  '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=96x64:rate=8', '-t', '10',
  '-c:v', 'libvpx', '-deadline', 'realtime', '-b:v', '60k', '-f', 'webm', 'pipe:1'
], { windowsHide: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: path.join(runtimes, 'openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')
  });
  try {
    const page = await browser.newPage({ viewport: {width: 1092, height: 871} });
    await page.route('http://studio.test/**', route => {
      if (route.request().resourceType() === 'media') return route.fulfill({body: video, contentType: 'video/webm'});
      return route.fulfill({body: '<!doctype html><meta charset="utf-8"><main></main>', contentType: 'text/html'});
    });
    await page.goto('http://studio.test/');
    await page.addStyleTag({ path: path.join(root, 'styles.css') });
    await page.addScriptTag({ path: path.join(root, 'generation-studio-ui.js') });
    await page.evaluate(() => {
      const host = document.querySelector('main');
      host.innerHTML = CanvasFlowStudioUI.markup('video');
      const panel = CanvasFlowStudioUI.historyController(host, 'video', {
        reuse: job => { window.reused = job.id; },
        retryLookup: job => { window.lookedUp = job.id; },
        download: job => { window.downloaded = job.id; }
      });
      window.jobs = [
        {id: 'newest', prompt: '测试镜头', status: 'running', progress: 0, modelId: 'm'},
        {id: 'old', prompt: '第一个镜头', status: 'completed', videoUrl: '/media/old.webm', modelId: 'm'},
        {id: 'missing', prompt: '待取回的镜头', status: 'completed', providerJobId: 'provider-missing'},
        {id: 'unrecoverable', prompt: '无上游编号的镜头', status: 'completed'}
      ];
      window.refresh = () => panel.render(jobs, [{id: 'm', name: '测试模型'}], {total: jobs.length, submittedIds: ['newest']});
      refresh();
      window.originalRow = host.querySelector('[data-job-id=old]');
    });
    await page.locator('[data-job-id=old] [data-view-job]').click();
    const player = page.locator('[data-output-media] video');
    await player.evaluate(async el => {
      window.originalPlayer = el;
      el.muted = true;
      await el.play();
    });
    await page.waitForFunction(() => originalPlayer.currentTime > 0.1);
    await page.evaluate(() => {
      jobs[0].progress = 45;
      refresh();
    });
    assert.match(await page.locator('[data-job-id=newest]').innerText(), /45%/);
    await page.evaluate(() => {
      jobs[0].status = 'completed';
      jobs[0].videoUrl = '/media/new.webm';
      refresh();
    });
    await page.getByRole('button', {name: '查看新结果'}).waitFor();
    assert.equal(await player.evaluate(el => el === originalPlayer && !el.paused), true);
    assert.equal(await page.evaluate(() => document.querySelector('[data-job-id=old]') === originalRow), true);
    await page.getByRole('button', {name: '查看新结果'}).click();
    assert.equal(await player.getAttribute('src'), '/media/new.webm');
    const download = page.locator('[data-download]');
    assert.equal(await download.getAttribute('href'), '/media/new.webm');
    assert.equal(await download.getAttribute('download'), '');
    await page.locator('[data-job-id=newest] [data-reuse]').click();
    await page.locator('[data-job-id=missing] [data-lookup]').click();
    assert.equal(await page.locator('[data-job-id=unrecoverable] [data-lookup]').isHidden(), true);
    assert.deepEqual(await page.evaluate(() => [window.reused, window.lookedUp]), ['newest', 'missing']);
    await page.evaluate(() => {
      jobs[0].videoUrl = 'http://studio.test/provider/new.webm';
      refresh();
    });
    await download.click();
    assert.equal(await page.evaluate(() => window.downloaded), 'newest');
    await page.setViewportSize({width: 375, height: 700});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const embedded = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6vMAAAAAASUVORK5CYII=';
    await page.evaluate(imageData => {
      const host = document.querySelector('main');
      host.innerHTML = CanvasFlowStudioUI.markup('image');
      CanvasFlowStudioUI.historyController(host, 'image', {retryLookup() {}}).render([
        {id:'embedded', status:'completed', imageData},
        {id:'invalid', status:'completed', providerJobId:'unused', imageData:'data:image/svg+xml;base64,PHN2Zy8+'}
      ], [], {submittedIds:['embedded']});
    }, embedded);
    assert.equal(await page.locator('[data-output-media] img').getAttribute('src'), embedded);
    assert.equal(await download.getAttribute('href'), embedded);
    assert.equal(await download.getAttribute('download'), '');
    assert.equal(await page.locator('[data-job-id=invalid] [data-view-job]').isHidden(), true);
    assert.equal(await page.locator('[data-job-id=invalid] [data-lookup]').isHidden(), true);
    console.log('Studio playback, incremental history, original downloads, result lookup and parameter reuse passed.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
