const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const root = path.resolve(__dirname, '..');
const zoom = .33;
const videoUrl = pathToFileURL(path.join(root, 'tools/openfilm/node_modules/openfilm/library/transitions/wipe/preview.mp4')).href;
const graph = {
  id:'toolbar-stacking', projectName:'Toolbar stacking', zoom, panX:0, panY:0, edges:[], groups:[],
  nodes:[
    {id:'photo', type:'image', left:1260, top:830, previewData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jEOcAAAAASUVORK5CYII='},
    {id:'clip', type:'model', left:1850, top:700, jobStatus:'completed', videoUrl},
    ...Array.from({length:59}, (_, i)=>({id:'note-'+i, type:'prompt', left:i===0 ? 540 : 2500 + i*15, top:300})),
  ],
};

async function clickWithOverlap(target) {
  const card = target.page().locator('[data-node-id=note-58]');
  const initialPosition = await card.evaluate(el=>({left:el.style.left, top:el.style.top}));
  const overlap = await target.evaluate(button=>{
    const card = document.querySelector('[data-node-id=note-58]');
    const stage = document.querySelector('#canvasStage');
    const rect = button.getBoundingClientRect();
    const scale = new DOMMatrixReadOnly(getComputedStyle(stage).transform).a;
    const stageRect = stage.getBoundingClientRect();
    const x = rect.x+rect.width/2, y = rect.y+rect.height/2;
    card.style.left = ((x-stageRect.left)/scale - card.offsetWidth/2)+'px';
    card.style.top = ((y-stageRect.top)/scale - card.offsetHeight/2)+'px';
    const hits = document.elementsFromPoint(x,y);
    return {scale, obscurerPresent:hits.some(el=>card.contains(el)), buttonOnTop:button.contains(hits[0])};
  });
  try {
    assert.equal(overlap.scale,zoom);
    assert.ok(overlap.obscurerPresent,'the test node lies directly under the target button');
    assert.ok(overlap.buttonOnTop,'the overlapping node must not intercept the button');
    await target.click();
  } finally {
    await card.evaluate((el, position)=>Object.assign(el.style, position), initialPosition);
  }
}

async function exercise(page, theme) {
  await page.route(/^https?:/, route => route.abort());
  await page.addInitScript(({graph,theme})=>{
    localStorage.setItem('canvasflow-theme', theme);
    localStorage.setItem('canvasflow-projects', JSON.stringify([graph]));
    localStorage.setItem('canvasflow-startup-animation', JSON.stringify({enabled:false}));
  }, {graph,theme});
  const url = pathToFileURL(path.join(root,'index.html'));
  url.searchParams.set('project', graph.id);
  await page.goto(url.href);
  const toolbar = page.locator('#nodeQuickToolbar');
  const photo = page.locator('[data-node-id=photo]');
  await photo.locator('.media-preview').click();
  await toolbar.waitFor();
  const more = toolbar.locator('[data-quick-tool=nine-grid]');
  assert.ok(await more.isEnabled());
  await clickWithOverlap(more);
  const item = page.locator('#nineGridMenu [role=menuitem]').first();
  await item.waitFor();
  assert.ok(await item.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  await more.click();
  await page.waitForSelector('#nineGridMenu',{state:'hidden'});
  await toolbar.locator('[data-quick-tool=preview]').click();
  const preview = page.locator('.image-lightbox-backdrop');
  await preview.waitFor();
  assert.ok(await more.evaluate(el=>{const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest('.image-lightbox-backdrop');}));
  await page.keyboard.press('Escape');
  await preview.waitFor({state:'hidden'});
  await toolbar.locator('[data-quick-tool=rotate]').click();
  const exitTransform = page.locator('#ftvTransformToolbar [data-transform-exit]');
  await exitTransform.waitFor();
  await clickWithOverlap(exitTransform);
  await exitTransform.waitFor({state:'hidden'});
  await photo.locator('.media-preview').click();
  await page.locator('[data-node-id=note-0] .node-title').click({modifiers:['Alt']});
  assert.ok(await toolbar.isHidden(),'multi-selection hides the single-node toolbar');
  await page.keyboard.press('Control+g');
  const ungroup = page.locator('#groupToolbar [data-group-tool=ungroup]');
  await ungroup.waitFor();
  await clickWithOverlap(ungroup);
  await ungroup.waitFor({state:'hidden'});
  await page.locator('[data-node-id=clip] .node-title').click();
  const videoPreview = toolbar.locator('[data-quick-tool=video-preview]');
  await videoPreview.waitFor();
  assert.ok(await videoPreview.isEnabled());
  await clickWithOverlap(videoPreview);
  const videoDialog = page.getByRole('dialog', {name:'视频节点放大预览'});
  await videoDialog.waitFor();
  assert.equal(await videoDialog.locator('video').getAttribute('src'), videoUrl);
  await videoDialog.getByRole('button', {name:'关闭视频预览'}).click();
  await videoDialog.waitFor({state:'hidden'});
}

(async()=>{
  const browser = await chromium.launch({executablePath:path.join(root,'.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
  try {
    for (const theme of ['dark','light']) {
      const page = await browser.newPage({viewport:{width:1417,height:881},reducedMotion:'reduce'});
      try { await exercise(page,theme); } finally { await page.close(); }
    }
    console.log('Image and video previews, toolbar hit tests, dropdown, transform and grouping passed at 33% in both themes.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
