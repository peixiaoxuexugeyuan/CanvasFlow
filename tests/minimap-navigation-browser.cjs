const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');

const root = path.resolve(__dirname, '..');
const graph = {
  id: 'minimap-navigation', projectName: 'Minimap navigation', panX: -200, panY: -100,
  nodes: [
    { id: 'near', type: 'prompt', left: -1100, top: -900 },
    { id: 'far', type: 'prompt', left: 4400, top: 2200 }
  ],
  edges: [], groups: []
};

function closeTo(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('#canvasStage');
    const wrap = document.querySelector('#canvasWrap');
    const transform = new DOMMatrixReadOnly(getComputedStyle(stage).transform);
    return {
      panX: transform.e, panY: transform.f, zoom: transform.a,
      width: wrap.clientWidth, height: wrap.clientHeight,
      previews: Array.from(document.querySelectorAll('.mini-node'), node => node.getBoundingClientRect().toJSON()),
      frame: document.querySelector('.mini-viewport').getBoundingClientRect().toJSON(),
      board: document.querySelector('.mini-map-canvas').getBoundingClientRect().toJSON()
    };
  });
}

async function verifyVisibilityToggle(page) {
  const toggle = page.locator('#toggleMiniMapBtn');
  const panelId = await toggle.getAttribute('aria-controls');
  assert.ok(panelId, 'the toggle identifies the overview it controls');
  const panel = page.locator(`#${panelId}`);
  const board = page.locator('.mini-map-canvas');
  async function checkExpanded(expanded) {
    assert.equal(await toggle.isVisible(), true, 'the toggle remains visible');
    assert.equal(await toggle.getAttribute('aria-expanded'), String(expanded));
    assert.equal(await panel.isVisible(), expanded, 'overview panel visibility');
    assert.equal(await board.isVisible(), expanded, 'overview canvas visibility');
  }

  await checkExpanded(true);
  await toggle.click();
  await checkExpanded(false);
  await page.reload();
  await page.locator('#canvasStage [data-node-id="far"]').waitFor({ state: 'attached' });
  await checkExpanded(false);
  await toggle.press('Enter');
  await checkExpanded(true);
  await page.reload();
  await page.locator('#canvasStage [data-node-id="far"]').waitFor({ state: 'attached' });
  await checkExpanded(true);
  await toggle.press('Space');
  await checkExpanded(false);
  await toggle.press('Space');
  await checkExpanded(true);
}

async function verifyNavigation(browser, zoom) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 850 }, reducedMotion: 'reduce' });
  try {
    // Exercise the real page, its pointer handlers and saving, with no backend or user data.
    await page.route(/^https?:/, route => route.abort());
    // A large project still has off-screen nodes at the 10% zoom used for storyboards.
    const spread = zoom === 0.1 ? 5 : 1;
    const nodes = graph.nodes.map(node => ({ ...node, left: node.left * spread, top: node.top * spread }));
    await page.addInitScript(project => {
      localStorage.setItem('canvasflow-projects', JSON.stringify([project]));
    }, { ...graph, nodes, zoom });
    const url = pathToFileURL(path.join(root, 'index.html'));
    url.searchParams.set('project', graph.id);
    await page.goto(url.href);
    await page.locator('#canvasStage [data-node-id="far"]').waitFor({ state: 'attached' });
    if (zoom === 1) await verifyVisibilityToggle(page);
    const start = await snapshot(page);
    closeTo(start.zoom, zoom, 0.00001, 'fixture zoom');
    const x = Math.round(start.frame.left + start.frame.width * 0.3);
    const y = Math.round(start.frame.top + start.frame.height * 0.7);
    await page.mouse.move(x, y);
    await page.mouse.down();
    const down = await snapshot(page);
    assert.equal(down.panX, start.panX, 'pressing off-center inside the frame must preserve its grab point');
    assert.equal(down.panY, start.panY);

    // Crossing the graph bounds refits the overview while the pointer is still down.
    // Moving back toward the graph should expand the preview again.
    let previous = start;
    for (const dx of [8, -110, -100, -35]) {
      await page.mouse.move(x + dx, y, { steps: 5 });
      const moved = await snapshot(page);
      assert.ok(dx === -110 ? moved.panX > previous.panX : moved.panX < previous.panX, 'pan direction');
      closeTo(moved.panY, start.panY, 0.01, 'horizontal pan preserves height');
      if (dx === -110 || dx === -100) {
        assert.ok(moved.frame.width < start.frame.width - 1, 'viewport shrinks before release');
        assert.ok(moved.previews[0].width < start.previews[0].width, 'node previews shrink while dragging');
        assert.ok(moved.frame.left >= moved.board.left && moved.frame.right <= moved.board.right);
        for (const box of moved.previews) assert.ok(box.left >= moved.board.left && box.right <= moved.board.right);
      }
      if (dx === -100) assert.ok(moved.frame.width > previous.frame.width, 'reverse drag expands overview');
      assert.equal(moved.zoom, start.zoom);
      previous = moved;
    }

    const beforeUp = await snapshot(page);
    await page.mouse.up();
    await page.mouse.move(x + 20, y + 18);
    const released = await snapshot(page);
    assert.equal(released.panX, beforeUp.panX, 'the frame stops moving after release');
    assert.equal(released.panY, beforeUp.panY);
    closeTo(released.frame.width, beforeUp.frame.width, 0.02, 'no refit jump on release');
    await page.waitForFunction(({ panX, panY }) => {
      const saved = JSON.parse(localStorage.getItem('canvasflow-project') || 'null');
      return saved && Math.abs(saved.panX - panX) < 0.01 && Math.abs(saved.panY - panY) < 0.01;
    }, released, { timeout: 4000 });

    const targetX = Math.round(released.board.right - 8);
    const targetY = Math.round(released.frame.top + released.frame.height / 2);
    assert.ok(targetX > released.frame.right, 'the jump target must be outside the frame');
    await page.mouse.move(targetX, targetY);
    await page.mouse.down();
    assert.equal((await snapshot(page)).panX, released.panX, 'pressing empty space does not jump before dragging');
    await page.mouse.up();
    const jump = await snapshot(page);
    const frame = released.frame;
    closeTo((released.panX - jump.panX) * frame.width / released.width, targetX - frame.left - frame.width / 2, 1, 'click centers chosen world x');
    closeTo((released.panY - jump.panY) * frame.height / released.height, targetY - frame.top - frame.height / 2, 1, 'click centers chosen world y');
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: path.join(root,
    '.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe') });
  try {
    for (const zoom of [0.1, 0.45, 1]) await verifyNavigation(browser, zoom);
    console.log('Minimap visibility and navigation passed: mouse and keyboard toggle, reload, grab, drag, release, save and click-to-center.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
