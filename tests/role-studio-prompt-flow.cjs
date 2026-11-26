const assert = require('node:assert/strict');

module.exports = async function checkRolePrompts({page, modal, api, generated, historical}) {
  const entry = page.locator('#roleLibraryMain [data-role-style]');
  const launch = modal.getByRole('button', {name:'提示词编辑', exact:true});
  const editor = page.locator('.dock-prompt-dialog');
  const key = 'field.face.skin.smooth';
  const hair = 'step.outfit.styling.hairstyle';
  const outfit = 'step.outfit.clothes.wardrobe';
  const text = id => editor.locator('[data-dock-prompt-key="'+id+'"]');
  const tab = id => editor.locator('[data-dock-prompt-tab="'+id+'"]');
  const customCard = id => editor.locator('[data-dock-prompt-card="'+id+'"].is-custom');
  const table = async () => (await api('GET', '/api/dock-prompts')).prompts.roleStudio;
  const sent = [];
  const endpoint = '**/api/ai/image-generate';
  const simulate = route => {
    sent.push(route.request().postDataJSON());
    const imageUrl = sent.length % 2 ? generated : historical;
    return route.fulfill({json:{job:{id:'prompt-fixture-'+sent.length,status:'completed',imageUrl}}});
  };
  function responseAt(path) {
    return page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === 'PUT');
  }
  async function saveTemplates(id) {
    const saved = responseAt('/api/dock-prompts');
    await editor.getByRole('button', {name:'保存修改',exact:true}).click();
    assert.equal((await saved).status(), 200);
    await customCard(id).waitFor();
  }
  async function resetTemplates(id) {
    const reset = responseAt('/api/dock-prompts');
    await editor.getByRole('button', {name:'恢复默认',exact:true}).click();
    assert.equal((await reset).status(), 200);
    await customCard(id).waitFor({state:'hidden'});
  }
  async function openEditor() {
    await launch.click();
    await editor.waitFor();
  }
  async function closeEditor() {
    await editor.getByRole('button', {name:'关闭',exact:true}).click();
    await editor.waitFor({state:'detached'});
  }
  async function generate() {
    await modal.getByRole('button', {name:'确认生成',exact:true}).click();
    await modal.locator('.rs-status').filter({hasText:'当前视角已生成'}).waitFor();
  }

  await page.route(endpoint, simulate);
  try {
    await entry.click();
    await launch.waitFor();
    const pos = await launch.boundingBox(), frame = await modal.boundingBox();
    assert.ok(pos.x > frame.x+frame.width/2 && pos.y > frame.y+frame.height*.75, 'admin entry is in the lower right of the role editor');
    await modal.locator('[data-mode=outfit]').click();
    const hairChoice = modal.locator('[data-option="outfit.styling.hairstyle"]').first();
    const preset = 'preset.outfit.styling.hairstyle.' + await hairChoice.getAttribute('data-value');
    await modal.locator('[data-mode=face]').click();
    await openEditor();
    await tab('face').click();
    const original = await table();
    assert.ok(original[key]?.prompt);
    const search = editor.getByRole('searchbox',{name:'搜索'});
    await search.fill('质感磨皮');
    assert.ok(await text(key).isVisible());
    assert.ok(await text('field.face.skin.texture').isHidden());
    await search.fill('');
    await text(key).fill('不保存的编辑');
    await closeEditor();
    await openEditor();
    await tab('face').click();
    assert.equal(await text(key).inputValue(), original[key].prompt);
    assert.equal((await table())[key].prompt, original[key].prompt);
    await text(key).fill('离线精修强度 {value}');
    await tab('outfit').click();
    await text(hair).fill('离线发型步骤 {value}');
    await text(preset).fill('离线造型预设');
    await text(outfit).fill('离线服装步骤 {value}');
    await tab('face').click();
    assert.equal(await text(key).inputValue(), '离线精修强度 {value}', 'switching tabs preserves the pending edit');
    await saveTemplates(key);
    assert.equal((await table())[hair].prompt, original[hair].prompt, 'saving the face tab does not publish outfit drafts');
    await tab('outfit').click();
    assert.equal(await text(hair).inputValue(), '离线发型步骤 {value}');
    await saveTemplates(hair);
    await closeEditor();
    const persisted = await table();
    assert.equal(persisted[key].prompt, '离线精修强度 {value}');
    assert.equal(persisted[hair].prompt, '离线发型步骤 {value}');
    assert.equal(persisted[outfit].prompt, '离线服装步骤 {value}');

    const smooth = modal.locator('[data-field="face.skin.smooth"]');
    await smooth.press('ArrowRight');
    const value = await smooth.inputValue();
    await generate();
    assert.equal(sent.length, 1);
    assert.ok(sent[0].prompt.includes('离线精修强度 '+value));
    await modal.locator('[data-mode=outfit]').click();
    await hairChoice.click();
    await modal.locator('[data-tab=clothes]').click();
    await modal.locator('[data-option="outfit.clothes.wardrobe"]').first().click();
    await generate();
    assert.equal(sent.length, 3);
    assert.ok(sent[1].prompt.includes('离线发型步骤 离线造型预设'), 'the selected preset expands in its own generation step');
    assert.match(sent[2].prompt, /离线服装步骤 [^{}\n]+/);
    assert.equal(sent[2].referenceImages[0], historical, 'the second step consumes the first step result');

    await openEditor();
    await tab('face').click();
    assert.equal(await text(key).inputValue(), persisted[key].prompt);
    await resetTemplates(key);
    assert.equal(await text(key).inputValue(), original[key].prompt);
    assert.equal((await table())[hair].custom, true, 'restoring face does not reset the outfit tab');
    await tab('outfit').click();
    await resetTemplates(hair);
    const restored = await table();
    for (const id of [hair,preset,outfit]) assert.equal(await text(id).inputValue(), original[id].prompt);
    for (const id of [key,hair,preset,outfit]) assert.equal(restored[id].custom, false);
    await closeEditor();
    await modal.getByRole('button', {name:'返回',exact:true}).click();
    await page.getByRole('alertdialog').getByRole('button', {name:'放弃并关闭'}).click();
    await modal.waitFor({state:'detached'});
  } finally {
    await page.unroute(endpoint, simulate);
  }
  const restricted = await page.context().newPage();
  try {
    const origin = new URL(page.url()).origin;
    await restricted.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/preset-prompts') return route.fulfill({json:{prompts:{}, canReadPrompt:false}});
      if (url.pathname === '/api/dock-prompts') return route.fulfill({json:{prompts:{}, canEdit:false}});
      if (url.pathname.startsWith('/api/ai/') || url.pathname.startsWith('/api/agent/')) return route.fulfill({json:{}});
      return route.continue();
    });
    await restricted.goto(page.url());
    await restricted.locator('html[data-preset-prompts="restricted"]').waitFor({state:'attached'});
    await restricted.locator('#roleLibraryBtn').click();
    await restricted.locator('#roleLibraryMain [data-role-style]').click();
    const roleEditor = restricted.getByRole('dialog',{name:'角色造型室'});
    await roleEditor.waitFor();
    assert.equal(await roleEditor.getByRole('button',{name:'提示词编辑',exact:true}).count(), 0,
      'the role editor hides global template management when the server reports restricted permissions');
  } finally {
    await restricted.close();
  }
};
