const assert = require('node:assert/strict');

module.exports = async function checkStyling({page, generated, historical, modal}) {
  const payloads=[];
  const route=async request=>{
    payloads.push(request.request().postDataJSON());
    const imageUrl=payloads.length%2?generated:historical;
    await request.fulfill({json:{job:{id:'style-'+payloads.length,status:'completed',imageUrl}}});
  };
  const endpoint='**/api/ai/image-generate';
  await page.route(endpoint,route);
  async function open(gender) {
    await page.evaluate(gender=>CanvasFlowRoleStudio.open({role:{id:'style-fixture-'+gender,name:'造型测试',gender,
      images:['role-library/web/001-1.jpg','role-library/web/001-2.jpg','','']},
      escapeHtml:String,workspaceKey:'style-fixture-'+gender,notify:()=>{},exitLibrary:()=>{}}),gender);
    await modal.locator('[data-mode=outfit]').click();
  }
  async function close() {
    await modal.locator('[data-action=close]').click();
    const confirm=page.getByRole('alertdialog');
    if(await confirm.count())await confirm.locator('button[value=leave]').click();
    await modal.waitFor({state:'hidden'});
  }
  const hair=modal.locator('[data-option="outfit.styling.hairstyle"]');
  const list=()=>hair.evaluateAll(rows=>rows.map(row=>row.dataset.value));
  const generate=modal.locator('[data-action=generate]');
  const waitForCompletion=()=>modal.locator('.rs-status').filter({hasText:'当前视角已生成'}).waitFor();
  try {
    await open('男');const men=await list();await close();
    await open('女');const women=await list();await close();
    await open('');assert.deepEqual(new Set(await list()),new Set([...men,...women]));
    assert.ok(men.length && women.some(id=>!men.includes(id)));
    const customColor=modal.getByRole('button',{name:'自定义颜色'});
    await customColor.click();
    const picker=modal.getByRole('dialog',{name:'自定义发色'});
    await picker.getByLabel('十六进制发色').fill('#12739a');
    await picker.getByRole('button',{name:'取消'}).click();
    assert.equal(await modal.locator('[data-value="#12739a"]').count(),0);
    assert.equal(await modal.locator('[data-option="outfit.styling.hairColor"][aria-pressed=true]').getAttribute('data-value'),'#0b0b0b');
    for(const key of ['hairColor','lipColor']) {
      const selection=modal.locator('[data-option="outfit.styling.'+key+'"][aria-pressed=true]');
      await selection.click();assert.equal(await selection.count(),0);
      const swatch=modal.locator('[data-option="outfit.styling.'+key+'"]').nth(1);
      await swatch.click();assert.equal(await swatch.getAttribute('aria-pressed'),'true');
      await swatch.click();assert.equal(await selection.count(),0);
    }
    await hair.first().click();
    await modal.locator('[data-tab=clothes]').click();
    await modal.locator('[data-option="outfit.clothes.wardrobe"]').first().click();
    assert.match(await modal.locator('.rs-status').textContent(),/多选.*生成时间/);
    await generate.click();await waitForCompletion();
    assert.equal(payloads.length,2);
    assert.match(payloads[0].prompt,/仅调整发型/);
    assert.match(payloads[1].prompt,/仅调整服装/);
    assert.equal(payloads[1].referenceImages[0],generated,'step 2 uses the exact step 1 result');
    assert.ok(await generate.isDisabled());

    await modal.locator('[data-tab=ai]').click();
    const skill=modal.locator('[data-field="outfit.ai.stylingSkill"]');
    await skill.selectOption('妆造复刻');assert.ok(await generate.isDisabled());
    const brief=modal.locator('[data-field="outfit.ai.outfitNotes"]');
    await brief.fill('  ');assert.ok(await generate.isDisabled());
    await brief.fill('白色汉服');
    for(const [name,id] of [['妆造复刻','libtv-7efd8f0969b04bf391dc3589f8aebdc9'],
      ['人设定制造型','libtv-2247c88d1ecc496abdd7d8246eead1bb'],['不使用技能',null]]) {
      await skill.selectOption(name);
      const next=page.waitForRequest(req=>req.url().endsWith('/api/ai/image-generate'));
      await generate.click();
      const submitted=(await next).postDataJSON();
      assert.equal(submitted.roleStyling?.skillId??null,id);
      assert.ok(submitted.referenceImages.length);
      await waitForCompletion();
    }
    await modal.locator('[data-mode=face]').click();
    const count=payloads.length;
    await modal.locator('[data-action=smart]').click();
    await waitForCompletion();
    assert.equal(payloads.length,count+1,'smart adjustment submits once');
    assert.equal(await modal.locator('[data-field="face.skin.smooth"]').inputValue(),'20');
    await close();
  } finally {await page.unroute(endpoint,route);}
};
