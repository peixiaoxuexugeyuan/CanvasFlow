const assert = require('node:assert/strict');

module.exports = async function checkRoleSaveFlow({page, modal, readRoles, api, copyId, officialId, generated}) {
  const library = page.locator('#roleLibraryModal');
  const back = modal.locator('[data-action=back]');
  const options = modal.locator('[data-save-menu=save]');
  const leave = page.getByRole('alertdialog');
  const name = modal.locator('.rs-identity input');
  async function open(scope, id) {
    if (!await library.isVisible()) await page.locator('#roleLibraryBtn').click();
    await page.locator('[data-role-scope="'+scope+'"]').click();
    await page.locator('[data-role-select="'+id+'"]').click();
    await page.locator('#roleLibraryMain [data-role-style="'+id+'"]').click();
    await modal.waitFor();
    await modal.locator('.rs-model option').first().waitFor({state:'attached'});
  }
  const roleById = async id => (await readRoles()).mine.custom.find(row => row.id === id);
  const source = await roleById(copyId);
  await open('official', officialId);
  await modal.locator('[data-mode=features]').click();
  const libraryMarks=modal.getByRole('group',{name:'我的贴图'});
  await libraryMarks.getByRole('button',{name:'red.png'}).click();
  await modal.locator('.rs-marks .rs-mark').waitFor();
  assert.equal(await modal.locator('.rs-marks .rs-mark').count(),1,'custom mark uploaded in another role can be reused');
  await modal.locator('[data-action=undo]').click();
  await modal.locator('[data-mode=face]').click();
  await options.click();
  assert.ok(await modal.getByRole('menuitem',{name:'更新当前角色'}).isDisabled());
  assert.ok(await modal.getByRole('menuitem',{name:'保存为新角色'}).isEnabled());
  await page.keyboard.press('Escape');
  assert.equal(await options.getAttribute('aria-expanded'),'false');
  assert.ok(await modal.isVisible(),'Escape closes only the save menu');
  await back.click();
  await modal.waitFor({state:'hidden'});

  await open('mine', copyId);
  await name.fill('保留草稿与另存测试');
  await page.mouse.click(2,2);
  await leave.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await name.inputValue(),'保留草稿与另存测试');
  await back.click();
  await leave.getByRole('button',{name:'放弃并关闭'}).click();
  await modal.waitFor({state:'hidden'});
  assert.deepEqual(await roleById(copyId),source);
  await open('mine', copyId);
  assert.equal(await name.inputValue(),source.name,'explicitly discarding the edit removes its saved draft');
  await name.fill('保留草稿与另存测试');
  await modal.locator('.rs-assets').uncheck();
  await options.click();
  assert.ok(await modal.getByRole('menuitem',{name:'更新当前角色'}).isEnabled());
  await modal.getByRole('menuitem',{name:'保存为新角色'}).click();
  await modal.waitFor({state:'hidden'});
  const duplicate = (await readRoles()).mine.custom.find(row=>row.name==='保留草稿与另存测试' && row.id!==copyId);
  assert.ok(duplicate,'Save as creates a distinct private role');
  assert.deepEqual(duplicate.tags,source.tags);
  assert.deepEqual(await roleById(copyId),source,'saving a copy leaves its source intact');

  await open('mine', duplicate.id);
  const firstRange = modal.locator('.rs-slider input').first();
  await firstRange.focus(); await firstRange.press('ArrowRight');
  const pendingId = 'pending-role-exit';
  let cancelledBySupplier=false;
  await page.route('**/api/jobs/'+pendingId, route=>route.fulfill({json:{job:{id:pendingId,
    status:cancelledBySupplier?'failed':'running',error:cancelledBySupplier?'上次角色任务已取消':''}}}));
  await page.route('**/api/jobs/'+pendingId+'/cancel', route=>{
    cancelledBySupplier=true;return route.fulfill({json:{cancelled:true,upstreamCancelled:true}});
  });
  const pendingRoute = route => route.fulfill({json:{jobId:pendingId,job:{id:pendingId,status:'running'}}});
  await page.route('**/api/ai/image-generate', pendingRoute);
  const submitted = page.waitForResponse(r=>r.url().endsWith('/api/ai/image-generate'));
  await modal.locator('[data-action=generate]').click(); await submitted;
  await back.click();
  await leave.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await modal.getAttribute('aria-busy'),'true');
  await back.click();
  await page.evaluate(()=>{
    const set=Storage.prototype.setItem;
    window.restoreDraftStorage=()=>{Storage.prototype.setItem=set;};
    Storage.prototype.setItem=function(key,value){
      if(key.startsWith('canvasflow.role-studio.draft.'))throw new DOMException('test full','QuotaExceededError');
      return set.call(this,key,value);
    };
  });
  const cancelled = page.waitForRequest(r=>r.url().endsWith('/api/jobs/'+pendingId+'/cancel'));
  await leave.getByRole('button',{name:'取消生成并离开'}).click(); await cancelled;
  await modal.waitFor({state:'hidden'});
  await page.evaluate(()=>window.restoreDraftStorage());
  await page.unroute('**/api/ai/image-generate',pendingRoute);
  await open('mine',duplicate.id);
  if (await modal.getByRole('button',{name:'继续已提交任务'}).count()) {
    await modal.getByRole('button',{name:'继续已提交任务'}).click();
    await modal.locator('.rs-status').filter({hasText:'上次角色任务已取消'}).waitFor();
  }
  await modal.locator('[data-action=generate]').click();
  await modal.locator('.rs-status').filter({hasText:'当前视角已生成'}).waitFor();
  await back.click();
  await leave.getByRole('button',{name:'放弃并关闭'}).click();
  await modal.waitFor({state:'hidden'});
  await open('mine',duplicate.id);
  const savedPreview=await modal.getByRole('img',{name:'角色预览'}).getAttribute('src');
  assert.deepEqual(await roleById(duplicate.id), duplicate, 'leaving generation does not save over the role');

  await name.fill('刷新前的并发草稿');
  await page.reload();
  await page.locator('[data-node-id="original-note"]').waitFor();
  await open('mine', duplicate.id);
  assert.equal(await name.inputValue(),'刷新前的并发草稿','an immediate reload flushes the active input');
  assert.equal(await modal.getByRole('img',{name:'角色预览'}).getAttribute('src'),savedPreview);
  const bucket=(await readRoles()).mine;
  await api('PUT','/api/preset-roles/record?scope=mine',{data:{id:duplicate.id,
    expectedRevision:bucket.recordRevisions[duplicate.id],record:{...duplicate,name:'另一个编辑器保存的版本'}}});
  await modal.locator('.rs-assets').uncheck();
  await modal.locator('[data-action=save]').click();
  await modal.getByRole('menuitem',{name:'更新当前角色'}).click();
  await modal.locator('.rs-conflict').waitFor();
  assert.equal(await name.inputValue(),'刷新前的并发草稿');
  await page.reload();await page.locator('[data-node-id="original-note"]').waitFor();
  await open('mine',duplicate.id);await modal.locator('.rs-conflict').waitFor();
  assert.equal(await name.inputValue(),'刷新前的并发草稿','a conflicting draft survives reload');
  await modal.locator('.rs-assets').uncheck();
  await options.click();await modal.getByRole('menuitem',{name:'保存为新角色'}).click();
  await modal.waitFor({state:'hidden'});
  assert.equal((await roleById(duplicate.id)).name,'另一个编辑器保存的版本');
  assert.ok((await readRoles()).mine.custom.some(r=>r.name==='刷新前的并发草稿'&&r.id!==duplicate.id));

  const plain={id:'char-plain-prompt',name:'原始设定测试',value:'只存在于原角色设定里的文字',
    images:['role-library/web/007-1.jpg','role-library/web/007-2.jpg','','']};
  await api('PUT','/api/preset-roles/record?scope=mine',{data:{id:plain.id,record:plain,expectedRevision:''}});
  await page.reload();await page.locator('[data-node-id="original-note"]').waitFor();
  await open('mine',plain.id);await modal.locator('.rs-assets').uncheck();
  await modal.locator('[data-action=apply]').click();await modal.getByRole('menuitem',{name:'更新当前角色'}).click();await modal.waitFor({state:'hidden'});
  await page.waitForFunction(text=>[...document.querySelectorAll('.image-node')].filter(n=>n.dataset.mediaPrompt===text).length===2,plain.value);
  await library.waitFor({state:'detached'});
  await page.locator('#roleLibraryBtn').click();
  await page.locator('[data-role-scope="mine"]').click();
  await page.locator('[data-role-select="'+plain.id+'"]').click();
  await page.locator('[data-role-edit="'+plain.id+'"]').click();
  const editor=page.locator('#roleEditorModal.open');
  await editor.locator('#rolePromptInput').fill('资料编辑器中的未保存修改');
  const latest=(await readRoles()).mine;
  await api('PUT','/api/preset-roles/record?scope=mine',{data:{id:plain.id,expectedRevision:latest.recordRevisions[plain.id],
    record:{...plain,name:'资料冲突的最新角色'}}});
  await editor.locator('[data-role-editor-save]').click();
  await editor.getByRole('button',{name:'另存为新角色'}).click();await editor.waitFor({state:'hidden'});
  assert.equal((await roleById(plain.id)).name,'资料冲突的最新角色');
  assert.ok((await readRoles()).mine.custom.some(r=>r.id!==plain.id&&r.value==='资料编辑器中的未保存修改'));
};
