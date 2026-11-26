const assert = require('node:assert/strict');

module.exports = async function checkRoleModels({page, modal, generated, model}) {
  const other = {...model, id:'fixture-alternate', model:'fixture-alternate', name:'备用图片模型'};
  const noReferences = {...model, id:'fixture-no-references', imageReferences:{min:0,max:0}};
  let catalog = [];
  const catalogRoute = '**/api/ai/models';
  const catalogHandler = route => catalog === null
    ? route.fulfill({status:503, json:{message:'测试目录暂时不可用'}})
    : route.fulfill({json:{models:{t2i:catalog, text:[], video:[], audio:[]}}});
  const generateRoute = '**/api/ai/image-generate';
  const submitted = [];
  const generateHandler = route => {
    submitted.push(route.request().postDataJSON());
    return route.fulfill({json:{job:{id:'fixture-selected-model', status:'completed', imageUrl:generated}}});
  };
  await page.route(catalogRoute, catalogHandler);
  await page.route(generateRoute, generateHandler);
  try {
    await page.locator('#roleLibraryMain [data-role-style]').click();
    const picker = modal.getByRole('combobox', {name:'图片模型', exact:true});
    const generate = modal.getByRole('button', {name:'确认生成', exact:true});
    const option = text => picker.getByRole('option', {name:text, exact:true});
    await picker.waitFor();
    await option('暂无可用图片模型').waitFor({state:'attached'});
    const field = await picker.boundingBox(), action = await generate.boundingBox();
    assert.ok(field && action && field.y + field.height <= action.y, 'the image model selector is visible above Generate');
    assert.ok(await generate.isDisabled());
    await modal.locator('[data-mode=outfit]').click();
    const edit = modal.locator('[data-option="outfit.styling.hairstyle"]').first();
    await edit.click();
    assert.ok(await generate.isDisabled());

    async function configure(nextCatalog) {
      await picker.selectOption({label:'配置图片模型…'});
      const settings = page.locator('#settingsBackdrop');
      await settings.waitFor();
      await settings.locator('[data-settings-tab="mainProviders"].is-active').waitFor();
      catalog = nextCatalog;
      await settings.locator('#settingsClose').click();
      await settings.waitFor({state:'hidden'});
      await modal.waitFor();
      assert.equal(await edit.getAttribute('aria-pressed'), 'true', 'returning from settings preserves the chosen hairstyle');
    }
    await configure([noReferences]);
    await option('暂无支持参考图的模型').waitFor({state:'attached'});
    assert.ok(await generate.isDisabled());
    await configure([model, noReferences]);
    await option(model.name).waitFor({state:'attached'});
    assert.equal(await picker.inputValue(), model.id);
    assert.ok(await picker.isVisible(), 'the selected model is visible even with only one compatible option');
    assert.ok(await generate.isEnabled());

    await configure(null);
    await option('重新加载').waitFor({state:'attached'});
    catalog = [model, other, noReferences];
    await picker.selectOption({label:'重新加载'});
    await option(other.name).waitFor({state:'attached'});
    assert.equal(await picker.locator('option[value="fixture-no-references"]').count(), 0);
    await picker.selectOption({label:other.name});
    await configure(null);
    await option('重新加载').waitFor({state:'attached'});
    catalog = [model, other];
    await picker.selectOption({label:'重新加载'});
    await option(other.name).waitFor({state:'attached'});
    assert.equal(await picker.inputValue(), other.id);
    assert.equal(submitted.length, 0, 'choosing or configuring a model does not start generation');
    await generate.click();
    await modal.locator('.rs-status').filter({hasText:'当前视角已生成'}).waitFor();
    assert.deepEqual(submitted.map(request=>request.modelId), [other.id]);
    assert.match(submitted[0].prompt, /仅调整发型/);
    await modal.getByRole('button', {name:'返回',exact:true}).click();
    await page.getByRole('alertdialog').getByRole('button', {name:'放弃并关闭'}).click();
    await modal.waitFor({state:'detached'});
  } finally {
    await page.unroute(generateRoute, generateHandler);
    await page.unroute(catalogRoute, catalogHandler);
  }
};
