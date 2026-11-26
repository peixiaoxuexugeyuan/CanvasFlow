const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');
const acorn = require('../tools/release/node_modules/acorn');

const root = path.resolve(__dirname, '..');
const runtime = path.join(root, '.runtime');
const script = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const definitions = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration') definitions.set(node.id.name, script.slice(node.start, node.end));
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach(visit);
    else if (child && typeof child === 'object') visit(child);
  }
}
visit(acorn.parse(script, {ecmaVersion: 'latest'}));

const ffmpegRoot = path.join(runtime, 'openfilm-ffmpeg');
const ffmpegBuild = fs.readdirSync(ffmpegRoot).find(name => name.startsWith('ffmpeg-'));
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvasflow-seekable-'));
const fixtureFile = path.join(fixtureDir, 'clip.webm');
let clip;
try {
  // A seekable file includes duration and cue metadata that FFmpeg cannot write to a pipe.
  execFileSync(path.join(ffmpegRoot, ffmpegBuild, 'bin/ffmpeg.exe'), [
    '-v', 'error', '-f', 'lavfi', '-i', 'color=red:size=160x90:rate=12',
    '-vf', "drawbox=color=lime:w=iw:h=ih:t=fill:enable='gte(t,0.25)'",
    '-t', '3', '-c:v', 'libvpx', '-deadline', 'realtime', fixtureFile
  ], {windowsHide: true});
  clip = fs.readFileSync(fixtureFile);
} finally {
  fs.rmSync(fixtureFile, {force: true});
  fs.rmdirSync(fixtureDir);
}

async function expectColor(page, box, color, message) {
  const expected = {blue: 2, red: 0, green: 1}[color];
  const end = Date.now() + 3500;
  let rgb;
  do {
    const rect = await box.boundingBox();
    // Inspect composited pixels. A paused <video> may report readyState=4 even while blank.
    const png = await page.screenshot({clip: {
      x: Math.round(rect.x + rect.width * 0.7), y: Math.round(rect.y + rect.height * 0.4),
      width: 1, height: 1
    }});
    rgb = await page.evaluate(async data => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + data;
      await image.decode();
      const surface = document.createElement('canvas').getContext('2d');
      surface.drawImage(image, 0, 0);
      return [...surface.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }, png.toString('base64'));
    if (rgb[expected] > 170 && rgb.every((n, i) => i === expected || n < 90)) return;
  } while (Date.now() < end);
  assert.fail(message + ' expected ' + color + ', got rgb(' + rgb.join(',') + ')');
}

async function main() {
  const browser = await chromium.launch({executablePath: path.join(runtime,
    'openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
  try {
    const page = await browser.newPage({viewport: {width: 800, height: 500}});
    await page.route('http://canvas.test/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('.webm')) {
        const body = url.pathname.includes('broken') ? Buffer.alloc(12) : clip;
        const bytes = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
        if (!bytes) return route.fulfill({contentType: 'video/webm', body, headers: {'Accept-Ranges':'bytes'}});
        const start = Number(bytes[1]);
        const end = Math.min(body.length - 1, bytes[2] ? Number(bytes[2]) : body.length - 1);
        if (start > end) return route.fulfill({status: 416, headers: {'Content-Range': 'bytes */' + body.length}});
        return route.fulfill({status: 206, contentType: 'video/webm', body: body.subarray(start, end + 1),
          headers: {'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${body.length}`}});
      }
      if (url.pathname === '/missing.svg') return route.fulfill({status: 404, body: ''});
      if (url.pathname.endsWith('.svg')) return route.fulfill({contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="blue"/></svg>'});
      return route.fulfill({contentType: 'text/html', body: '<!doctype html><main></main>'});
    });
    await page.goto('http://canvas.test/');
    await page.addStyleTag({path: path.join(root, 'styles.css')});
    await page.addStyleTag({content: [
      'main {position:absolute;left:60px;top:80px;display:flex;gap:40px;transform-origin:0 0;transform:scale(.14)}',
      'article.output-node {position:relative;width:440px}',
      '.output-preview {width:400px;height:225px;aspect-ratio:16/9}'
    ].join('\n')});
    await page.addScriptTag({content: [
      'function applyNodeAspectSizing() {}',
      'const $ = s => document.querySelector(s); const nodeLabel = node => node.id;',
      'const generationContext = () => ({}); const generationContextActive = () => true; const scheduleSave = () => {};',
      'const api = async path => { window.lookup = path; return {job:{videoUrl:"/restored.webm"}}; };',
      'const renderJobProgress = (node, job, options) => setOutputVideoPreview(node, job.videoUrl, undefined, options.preserveTrim);',
      ...['videoTrimRange', 'bindTrimPlayback', 'createOutputVideoSurface', 'setOutputVideoPreview', 'ensureOutputPreviewBehavior', 'openVideoOutputPreview']
        .map(name => { assert.ok(definitions.has(name), name); return definitions.get(name); })
    ].join('\n')});
    await page.evaluate(() => {
      for (const id of ['saved', 'legacy', 'broken', 'lost-cover']) {
        const node = document.createElement('article');
        node.id = id;
        node.className = 'flow-node output-node video-output-node';
        node.dataset.node = 'output';
        node.innerHTML = '<div class="media-preview output-preview generated"><span class="output-state"></span></div>';
        if (id !== 'legacy') node.dataset.previewMedia = id === 'lost-cover' ? '/missing.svg' : '/cover.svg';
        document.querySelector('main').append(node);
        node.addEventListener('pointerdown', () => node.classList.add('selected'));
        ensureOutputPreviewBehavior(node);
        setOutputVideoPreview(node, '/' + id + '.webm');
      }
    });
    const saved = page.locator('#saved .output-preview');
    const legacy = page.locator('#legacy .output-preview');
    const broken = page.locator('#broken .output-preview');
    await expectColor(page, saved, 'blue', 'Saved preview should use its poster');
    await expectColor(page, legacy, 'red', 'Older project should show a decoded first frame');
    await expectColor(page, broken, 'blue', 'Unavailable video should keep its saved poster');
    await expectColor(page, page.locator('#lost-cover .output-preview'), 'red', 'Missing poster should fall back to a decoded still before hover');
    for (let i = 0; i < 2; i++) {
      // Simulate a compositor discarding the video layer but continuing to decode frames.
      if (i === 1) await page.addStyleTag({content: '#saved video {opacity:0}'});
      await saved.click();
      await expectColor(page, saved, 'green', 'Selected preview should display moving frames');
      await page.mouse.move(700, 450);
      await expectColor(page, saved, 'blue', 'Leaving the preview should restore its poster');
    }
    await legacy.hover();
    await expectColor(page, legacy, 'green', 'Legacy preview should play');
    await page.mouse.move(700, 450);
    await expectColor(page, legacy, 'red', 'Legacy preview should return to the first frame');
    await broken.hover();
    await expectColor(page, broken, 'blue', 'Playback failure should leave the poster visible');
    await page.mouse.move(700, 450);
    await page.evaluate(() => {
      const node = document.getElementById('saved');
      setOutputVideoPreview(node, '/replacement.webm');
    });
    await expectColor(page, saved, 'red', 'Replacement should use its own first frame');
    assert.equal(await saved.locator('video').count(), 1);
    await page.evaluate(() => {
      const node = document.getElementById('saved');
      Object.assign(node.dataset, { trimStart: '0.9', trimEnd: '1.5' });
      setOutputVideoPreview(node, '/replacement.webm');
    });
    await page.waitForFunction(() => Math.abs(document.querySelector('#saved video').currentTime - .9) < .02,
      null, {timeout: 5000}).catch(async error => {
      const details = await saved.locator('video').evaluate(video => ({
        time: video.currentTime, duration: video.duration, ready: video.readyState, seeking: video.seeking,
        seekable: video.seekable.length && video.seekable.end(0), node: {...video.closest('.flow-node').dataset}
      }));
      throw new Error(error.message + ' ' + JSON.stringify(details));
    });
    await saved.hover();
    await page.waitForFunction(() => document.querySelector('#saved video').currentTime > 1.05);
    await page.mouse.move(700, 450);
    await page.waitForFunction(() => Math.abs(document.querySelector('#saved video').currentTime - .9) < .02);
    await expectColor(page, saved, 'green', 'Leaving a trimmed clip should restore the in-point');
    await page.evaluate(() => openVideoOutputPreview(document.getElementById('saved')));
    const lightbox = page.locator('.video-lightbox-video');
    await page.waitForFunction(() => document.querySelector('.video-lightbox-video').currentTime >= .89);
    await lightbox.evaluate(el => { el.pause(); el.currentTime = 2; });
    await page.waitForFunction(() => Math.abs(document.querySelector('.video-lightbox-video').currentTime - .9) < .02);
    await page.locator('.video-lightbox-close').click();
    await page.evaluate(() => {
      const node = document.getElementById('broken');
      Object.assign(node.dataset, {jobId: 'existing-task', trimStart: '.5', trimEnd: '1.5'});
      openVideoOutputPreview(node);
    });
    await page.getByRole('button', {name: '重新取回视频'}).click();
    await page.waitForFunction(() => document.querySelector('.video-lightbox-video')?.src.endsWith('/restored.webm'));
    assert.equal(await page.evaluate(() => window.lookup), '/api/jobs/existing-task?recoverMedia=1');
    assert.equal(await page.locator('#broken').getAttribute('data-trim-start'), '.5');
    console.log('Canvas video preview pixels verified at 14% zoom.');
  } finally {
    await browser.close();
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
