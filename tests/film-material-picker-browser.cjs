// Exercise the canvas-material picker in Chromium with the production drawer and styles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const root = path.resolve(__dirname, '..');
const host = 'http://canvas.test';
const editor = 'http://127.0.0.1:48484/open';
const kinds = ['image', 'video', 'audio'];
const names = ['角色亮相', '街景预演', '对白参考', '环境设定', '运镜参考', '人物旁白', '产品分镜', '灯光测试', '备用对白'];
const materials = Array.from({length:96}, (_, index) => {
  const id = 'asset-' + String(index + 1).padStart(3, '0');
  const kind = kinds[index % kinds.length];
  const cover = '/media/cover-' + (index % 13 + 1) + '.png';
  const row = {id, name:(index === 12 ? '很长的画布分镜素材名称'.repeat(6) : names[index % names.length]) + ' ' + id,
    kind, url:kind === 'image' ? '/media/full-image.png' : '/media/clip.' + (kind === 'video' ? 'webm' : 'mp3'),
    thumbnail:cover, projects:[{id:'canvas-fixture'}]};
  if (index === 9 || index === 15) Object.assign(row, {deferred:true, url:'', thumbnail:''});
  return row;
});

async function checkViewport(browser, width, height, video) {
  const page = await browser.newPage({viewport:{width, height}, reducedMotion:'reduce'});
  try {
    const files = new Set(['styles.css', 'local-app.css', 'film-workbench.css', 'film-workbench.js']);
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.href === editor) return route.fulfill({contentType:'text/html',
        body:'<script>parent.postMessage({type:"canvasflow-film-project",projectId:"editor-fixture"},"http://canvas.test")</script>'});
      if (url.origin !== host) return route.abort();
      const file = url.pathname.slice(1);
      const cover = file.match(/^media\/cover-(\d+)\.png$/);
      if (cover) return route.fulfill({path:path.join(root, 'assets/agent-skills/cover-' + cover[1] + '.png')});
      if (file === 'media/full-image.png') return route.fulfill({path:path.join(root,'assets/agent-skills/cover-1.png')});
      if (file === 'media/clip.mp3') return route.fulfill({path:path.join(root,'assets/role-studio/voices/young.mp3')});
      if (file === 'media/clip.webm') return route.fulfill({contentType:'video/webm', body:video});
      if (files.has(file)) return route.fulfill({path:path.join(root, file)});
      if (file) return route.abort();
      return route.fulfill({contentType:'text/html', body:'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/local-app.css"><link rel="stylesheet" href="/film-workbench.css"><script src="/film-workbench.js"></script>'});
    });
    await page.goto(host);
    await page.evaluate(({editor, materials}) => {
      window.imports = [];
      const delayed = new Promise(resolve => { window.finishPreview = resolve; });
      window.CanvasFlowFilm.open({
        context:{projectId:'canvas-fixture', title:'回归画布', headers:{}},
        api:async (url, options) => {
          if (url === '/api/film/open') return {url:editor, projectId:'editor-fixture'};
          if (url === '/api/workspace/materials?project=canvas-fixture') return {materials};
          if (url === '/api/workspace/materials/asset-016') throw Error('fixture media unavailable');
          if (url === '/api/workspace/materials/asset-010') {
            await delayed;
            return {material:{url:'/media/full-image.png', projects:[{id:'canvas-fixture'}]}};
          }
          if (url === '/api/film/action') return {conflicts:[]};
          if (url === '/api/film/import') {
            const body = JSON.parse(options.body);
            window.imports.push(body);
            return {imported:body.materialIds.length};
          }
          throw new Error('Unexpected fixture route ' + url);
        },
        toast() {}
      });
    }, {editor, materials});
    await page.waitForFunction(() => window.CanvasFlowFilm.agentReady());
    await page.getByRole('button', {name:'导入当前画布素材到成片'}).click();
    const dialog = page.getByRole('dialog', {name:'导入当前画布素材'});
    const list = dialog.locator('.film-materials-list');
    const cards = list.locator('.film-material-card');
    await cards.last().waitFor({state:'attached',timeout:4000});
    assert.equal(await cards.count(), materials.length);
    await cards.nth(15).getByText('图片暂不可预览').waitFor({state:'attached'});
    assert.equal(await cards.nth(9).locator('img').count(), 0);
    const firstImage = cards.first().locator('img');
    assert.equal(new URL(await firstImage.getAttribute('src'), host).pathname, materials[0].thumbnail);
    const metrics = await list.evaluate(list => {
      const cards = Array.from(list.querySelectorAll('.film-material-card'));
      const boxes = cards.map(card => ({
        card:card.getBoundingClientRect(), preview:card.querySelector('.film-material-preview').getBoundingClientRect(),
        label:card.querySelector('label').getBoundingClientRect()
      }));
      return {
        minCard:Math.min(...boxes.map(b => b.card.height)), preview:boxes[0].preview.height,
        clipped:boxes.filter(b => b.label.bottom > b.card.bottom + 1 || b.preview.bottom > b.card.bottom + 1).length,
        columns:boxes.filter(b => Math.abs(b.card.top - boxes[0].card.top) < 1).length,
        height:list.clientHeight, scrollHeight:list.scrollHeight, overflowX:list.scrollWidth - list.clientWidth
      };
    });
    console.log(width + 'x' + height, JSON.stringify(metrics));
    assert.equal(metrics.clipped, 0, 'every preview and selection label must fit inside its card');
    assert.ok(metrics.minCard > metrics.preview && metrics.preview > 0);
    assert.ok(metrics.scrollHeight > metrics.height, 'many rows require vertical scrolling');
    assert.ok(metrics.overflowX <= 1, 'list must fit the drawer width');

    const checkbox = row => dialog.getByRole('checkbox', {name:'选择 ' + row.name, exact:true});
    const submit = dialog.getByRole('button', {name:'导入所选素材'});
    const search = dialog.getByRole('searchbox', {name:'搜索成片素材'});
    assert.ok(await submit.isDisabled());
    await firstImage.click();
    assert.ok(await checkbox(materials[0]).isChecked());
    await cards.nth(1).locator('video').click();
    assert.equal(await checkbox(materials[1]).isChecked(), false);
    await search.fill('视频');
    assert.equal(await cards.count(), materials.length / 3);
    await search.fill('asset-047');
    assert.equal(await cards.count(), 1);
    await checkbox(materials[46]).check(); // Video selected under a search filter.
    await search.fill('does-not-exist');
    assert.equal(await cards.count(), 0);
    await search.fill('');
    assert.equal(await cards.count(), materials.length);
    assert.ok(await checkbox(materials[0]).isChecked());
    await page.evaluate(() => window.finishPreview());
    await cards.nth(9).locator('img').waitFor({state:'attached'});
    if (width === 1440 && process.argv[2]) {
      await firstImage.evaluate(img => img.decode());
      await dialog.screenshot({path:process.argv[2]});
    }
    await list.evaluate(list => { list.scrollTop = list.scrollHeight; });
    assert.ok(await list.evaluate(list => {
      const last = list.querySelector('.film-material-card:last-child label').getBoundingClientRect();
      const viewport = list.getBoundingClientRect();
      return list.scrollTop > 0 && last.top >= viewport.top - 1 && last.bottom <= viewport.bottom + 1;
    }), 'last selection label must be reachable by scrolling the list');
    await checkbox(materials.at(-1)).check(); // Audio at the bottom of the full list.
    assert.equal(await submit.innerText(), '导入所选（3）');
    await submit.click();
    await dialog.waitFor({state:'detached'});
    assert.deepEqual(await page.evaluate(() => window.imports), [
      {projectId:'canvas-fixture', draft:false, materialIds:[materials[0].id, materials[46].id, materials.at(-1).id]}
    ]);
  } finally {
    await page.close();
  }
}

async function main() {
  const ffmpegRoot = path.join(root, '.runtime/openfilm-ffmpeg');
  const build = fs.readdirSync(ffmpegRoot).find(name => name.startsWith('ffmpeg-'));
  const clip = execFileSync(path.join(ffmpegRoot,build,'bin/ffmpeg.exe'), [
    '-v','error','-f','lavfi','-i','color=steelblue:size=160x90:rate=8','-t','1','-c:v','libvpx','-deadline','realtime','-f','webm','pipe:1'
  ], {windowsHide:true});
  const browser = await chromium.launch({executablePath:path.join(root,
    '.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
  try {
    const errors = [];
    for (const [width, height] of [[1440,900], [920,680], [390,760]]) {
      try { await checkViewport(browser, width, height, clip); }
      catch (error) { errors.push(new Error(width + 'x' + height + ': ' + error.message, {cause:error})); }
    }
    if (errors.length) throw new AggregateError(errors, 'Canvas material picker regressions');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
