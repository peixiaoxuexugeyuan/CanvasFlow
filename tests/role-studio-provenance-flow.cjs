const assert = require('node:assert/strict');

module.exports = async function checkModelReplacement({page,modal,api,readRoles,generated,model,requests}) {
  const id='char-provenance-regression', retired='retired-role-model';
  const old={id,name:'旧模型角色',value:'单个人物',images:Array(4).fill(generated),
    styling:{version:1,controls:{'body.figure.posture':16},renderModelId:retired,renderedSlots:[0,1,2,3],
      sourceImages:['role-library/web/007-1.jpg','role-library/web/007-2.jpg','','']}};
  await api('PUT','/api/preset-roles/record?scope=mine',{data:{id,record:old,expectedRevision:''}});
  await page.reload();
  await page.locator('[data-node-id="original-note"]').waitFor();
  const library=page.locator('#roleLibraryModal.open');
  const assets=modal.locator('.rs-assets');
  const save=async()=>{
    await modal.locator('[data-action=save]').click();
    await modal.getByRole('menuitem',{name:'更新当前角色'}).click();
    await modal.waitFor({state:'hidden'});await library.waitFor();
  };
  const read=async()=>(await readRoles()).mine.custom.find(r=>r.id===id);
  const open=async(target=page)=>{
    if (!await target.locator('#roleLibraryModal.open').isVisible()) await target.locator('#roleLibraryBtn').click();
    await target.locator('[data-role-scope=mine]').click();
    await target.locator('[data-role-select="'+id+'"]').click();
    await target.locator('#roleLibraryMain [data-role-style="'+id+'"]').click();
    const editor=target.locator('dialog.role-studio[open]');
    await editor.locator('.rs-model option').first().waitFor({state:'attached'});
    assert.equal(await editor.locator('.rs-model select').inputValue(),model.id);
    return editor;
  };
  const initial=requests.length;
  await open();
  await modal.getByText('· 已全部生成',{exact:true}).waitFor();
  assert.equal(await modal.getByRole('img',{name:'角色预览'}).getAttribute('src'),generated);
  await assets.uncheck();
  await modal.locator('.rs-identity input').fill('只修改角色名');
  await save();
  const named=await read();
  assert.deepEqual(named.images,old.images);
  assert.equal(named.styling.renderModelId,retired);
  assert.deepEqual(named.styling.renderSlotModels,Array(4).fill(retired));
  assert.deepEqual(named.styling.renderReadySlots,[0,1,2,3]);
  await open();await save();
  assert.equal(requests.length,initial,'all existing assets are reused with the retired model offline');
  await open();await modal.locator('.rs-slider input').first().press('ArrowRight');
  const estimate=modal.getByText('· 预计 4 次图片生成（全身主图 1 次，衍生资产 3 次）',{exact:true});
  await estimate.waitFor();
  await assets.uncheck();await save();
  const edited=await read();
  assert.deepEqual(edited.images,old.images);assert.equal(edited.styling.renderBasisKey,named.styling.renderBasisKey);
  assert.equal(requests.length,initial);
  await open();await estimate.waitFor();
  await modal.locator('[data-action=generate]').click();
  await modal.locator('.rs-status').filter({hasText:'当前视角已生成'}).waitFor();
  await assets.uncheck();await save();
  assert.equal(requests.length,initial+1);assert.equal(requests.at(-1).modelId,model.id);
  const mixed=await read();
  assert.deepEqual(mixed.styling.renderSlotModels,Array(4).fill(retired));
  assert.equal(mixed.styling.halfPreviewModel,model.id);
  assert.deepEqual(mixed.styling.renderReadySlots,[]);
  assert.equal(mixed.styling.halfPreviewOnly,false);

  await open();
  const jobId='resume-after-reload';
  let submits=0,done=false,checks=0;
  const routeSubmit=route=>{
    submits++;
    return route.fulfill({json:{jobId,job:{id:jobId,status:'running'}}});
  };
  await page.route('**/api/ai/image-generate',routeSubmit);
  await page.route('**/api/jobs/'+jobId,route=>{
    checks++;
    return route.fulfill({json:{job:{id:jobId,status:done?'completed':'running',imageUrl:done?generated:undefined}}});
  });
  await assets.uncheck();
  await modal.locator('[data-action=full]').click();
  await modal.locator('[data-action=generate]').click();
  await page.waitForFunction(job=>Object.values(sessionStorage).some(value=>value.includes(job)),jobId);
  await page.reload();await page.locator('[data-node-id="original-note"]').waitFor();
  await open();
  await modal.getByRole('button',{name:'继续已提交任务'}).waitFor();
  await modal.getByText('· 接续 1 个已提交任务，无新增调用',{exact:true}).waitFor();
  done=true;await save();
  assert.equal(submits,1,'ordinary save resumes the existing full-body job after reloading');
  assert.ok(checks>0);
  const resumed=await read();assert.deepEqual(resumed.styling.renderReadySlots,[0]);
  assert.equal(resumed.styling.renderSlotModels[0],model.id);

  // A completed asset must not start another paid job while the leave decision is still open.
  await open();
  await assets.check();
  await modal.locator('.rs-slider input').first().press('ArrowRight');
  const second=await page.context().newPage();
  await second.route('**/api/ai/models',r=>r.fulfill({json:{models:{t2i:[model],video:[],text:[],audio:[]}}}));
  await second.route('**/api/ai/image-generate',routeSubmit);
  await second.goto(page.url());await second.locator('[data-node-id="original-note"]').waitFor();
  const competing=await open(second);
  done=false;checks=0;
  await modal.locator('[data-action=save]').click();
  await modal.getByRole('menuitem',{name:'更新当前角色'}).click();
  await page.waitForFunction(job=>Object.values(sessionStorage).some(value=>value.includes(job)),jobId);
  await competing.locator('[data-action=save]').click();
  await competing.getByRole('menuitem',{name:'更新当前角色'}).click();
  await competing.locator('.rs-status').filter({hasText:'另一个窗口正在保存此角色'}).waitFor();
  assert.equal(submits,2,'a concurrent save in a second tab does not submit a duplicate');
  await second.close();
  await modal.locator('[data-action=back]').click();
  const leave=page.getByRole('alertdialog');
  await leave.waitFor();done=true;
  await page.waitForFunction(job=>Object.values(sessionStorage).some(value=>{
    try {const d=JSON.parse(value); return d.state?.frame?.assets?.[0] && !d.state.frame.job && !value.includes(job);}
    catch {return false;}
  }),jobId);
  assert.equal(submits,2,'close confirmation pauses follow-on submissions');
  await leave.getByRole('button',{name:'取消生成并离开'}).click();
  await modal.waitFor({state:'hidden'});
  assert.deepEqual(await read(),resumed,'closing the working copy does not overwrite the role');
  await open();
  await modal.getByText('· 预计 3 次图片生成（衍生资产 3 次）',{exact:true}).waitFor();
  assert.equal(submits,2);
  await page.unroute('**/api/ai/image-generate',routeSubmit);
  await assets.uncheck();await save();
};
