// Verify offline inference against the known alpha of a composited character.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const root = path.resolve(__dirname, '..');
const allowed = new Set(fs.readFileSync(path.join(root, 'tools/release/files.txt'), 'utf8').split(/\r?\n/));
const types = {'.js':'text/javascript', '.mjs':'text/javascript', '.wasm':'application/wasm', '.webp':'image/webp'};
const requested = [];
const server = http.createServer((req, res) => {
  const file = req.url.slice(1);
  if (!file) {
    res.setHeader('Content-Type', 'text/html');
    return res.end('<script src="/role-studio-cutout.js"></script>');
  }
  if (!allowed.has(file)) { res.writeHead(404); return res.end(); }
  requested.push(file);
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(path.join(root, file)).pipe(res);
});

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:path.join(root, '.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
    const page = await browser.newPage();
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin);
    await page.evaluate(async () => {
      async function load(url) {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 700;
      const ctx = canvas.getContext('2d', {willReadFrequently:true});
      ctx.drawImage(await load('assets/role-studio/subjects/052-1.webp'), 0, 0, canvas.width, canvas.height);
      const reference = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const bg = await load('assets/3d-box/showcase-1.webp');
      window.checkCutout = async mode => {
        ctx.putImageData(reference, 0, 0);
        const original = new Uint8ClampedArray(reference.data);
        if (mode !== 'alpha') {
          ctx.globalCompositeOperation = 'destination-over';
          ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
        }
        if (mode === 'rounded') {
          ctx.globalCompositeOperation = 'destination-in';
          ctx.beginPath();
          ctx.roundRect(0, 0, canvas.width, canvas.height, 42);
          ctx.fill();
        }
        if (mode === 'padded') {
          const margin = 36;
          ctx.clearRect(0, 0, margin, canvas.height);
          ctx.clearRect(canvas.width - margin, 0, margin, canvas.height);
          ctx.clearRect(0, 0, canvas.width, margin);
          ctx.clearRect(0, canvas.height - margin, canvas.width, margin);
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              if (x < margin || x >= canvas.width-margin || y < margin || y >= canvas.height-margin)
                original[(y*canvas.width+x)*4+3] = 0;
            }
          }
        }
        const result = await createImageBitmap(await roleStudioCutout(canvas));
        const output = new OffscreenCanvas(result.width, result.height).getContext('2d');
        output.drawImage(result, 0, 0);
        result.close();
        const rgba = output.getImageData(0, 0, canvas.width, canvas.height).data;
        let union = 0, intersection = 0, changedAlpha = 0;
        for (let i = 3; i < rgba.length; i += 4) {
          if (original[i] > 127 || rgba[i] > 127) union++;
          if (original[i] > 127 && rgba[i] > 127) intersection++;
          if (original[i] !== rgba[i]) changedAlpha++;
        }
        return {iou:intersection / union, changedAlpha};
      };
    });
    const alpha = await page.evaluate(() => checkCutout('alpha'));
    assert.equal(alpha.changedAlpha, 0, 'Existing feathered alpha must survive without changes');
    assert.ok(!requested.some(name => name.endsWith('.wasm')), 'Transparent assets should skip inference');
    for (const mode of ['scene', 'rounded', 'padded']) {
      const {iou} = await page.evaluate(mode => checkCutout(mode), mode);
      assert.ok(iou > 0.90, mode + ' mask overlap: ' + iou);
    }
    assert.ok(requested.includes('vendor/role-cutout/u2netp.bin'));
    console.log('Role cutout preserved original alpha and recovered scene, rounded and padded foregrounds.');
  } finally {
    await browser?.close();
    server.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
