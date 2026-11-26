const assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');

module.exports=async function checkManualRoleImages({page,api,readRoles,generated,modal}) {
  const id='char-manual-profile-images';
  const images=Array(4).fill(generated);
  const role={id,name:'手动替换人设图',images,styling:{version:1,controls:{},renderModelId:'old-image-model',
    sourceImages:['role-library/web/003-1.jpg','role-library/web/003-2.jpg','',''],
    renderedSlots:[0,1,2,3],renderReadySlots:[0,1,2,3]}};
  await api('PUT','/api/preset-roles/record?scope=mine',{data:{id,record:role,expectedRevision:''}});
  await page.reload();await page.locator('.flow-node').first().waitFor();
  await page.locator('#roleLibraryBtn').click();
  const library=page.locator('#roleLibraryModal.open');
  await library.locator('[data-role-scope=mine]').click();
  await library.locator('[data-role-select="'+id+'"]').click();
  const read=async()=>(await readRoles()).mine.custom.find(r=>r.id===id);
  async function waitForSaved(check) {
    const until=Date.now()+6000;
    while(Date.now()<until) {const saved=await read();if(check(saved))return saved;await delay(80);}
    assert.fail('Profile photo change was not saved');
  }
  async function choose(button,color) {
    const data=await page.evaluate(col=>{
      const canvas=document.createElement('canvas');canvas.width=20;canvas.height=12;
      const ctx=canvas.getContext('2d');ctx.fillStyle=col;ctx.fillRect(0,0,20,12);
      return canvas.toDataURL().split(',')[1];
    },color);
    const chooser=page.waitForEvent('filechooser');await button.click();
    await (await chooser).setFiles({name:'profile.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  }
  async function verifyCount(number,generate=false) {
    await library.locator('[data-role-style="'+id+'"]').click();await modal.waitFor();
    await modal.locator('.rs-model option').first().waitFor({state:'attached'});
    await modal.locator('.rs-assets').check();
    await modal.getByText('· 预计 '+number+' 次图片生成（衍生资产 '+number+' 次）',{exact:true}).waitFor();
    await modal.locator(generate ? '[data-action=save]' : '[data-action=back]').click();
    if(generate)await modal.getByRole('menuitem',{name:'更新当前角色'}).click();
    await modal.waitFor({state:'hidden'});
  }
  await choose(library.locator('[data-role-resource="0"]'),'#c32a11');
  const body=await waitForSaved(r=>r.images[0]!==generated);
  assert.deepEqual(body.styling.renderReadySlots,[0]);
  assert.deepEqual(body.styling.renderSlotModels,['','old-image-model','old-image-model','old-image-model']);
  assert.deepEqual(body.styling.sourceImages,[body.images[0],role.styling.sourceImages[1],'','']);
  assert.deepEqual(body.images.slice(1),images.slice(1));
  const queued=page.waitForRequest(req=>req.method()==='PUT' && req.url().includes('/api/preset-roles/record') && req.postDataJSON().derivatives);
  await verifyCount(3,true);
  const submissions=(await queued).postDataJSON().derivatives.items.map(row=>row.payload);
  assert.equal(submissions.length,3);
  assert.equal(submissions[0].referenceImages[0],body.images[0]);
  const rebuilt=await waitForSaved(r=>r.styling.renderReadySlots.length===4);
  assert.deepEqual(rebuilt.styling.renderReadySlots,[0,1,2,3]);
  assert.equal(rebuilt.images[0],body.images[0]);
  await library.locator('[data-role-edit="'+id+'"]').click();
  const editor=page.locator('#roleEditorModal.open');
  await choose(editor.locator('button[data-role-upload="1"]').first(),'#212db7');
  await editor.locator('[data-role-slot="1"] img[src^="data:image/"]').waitFor();
  await editor.locator('[data-role-editor-save]').click();await editor.waitFor({state:'hidden'});
  const face=await waitForSaved(r=>r.images[1]!==rebuilt.images[1]);
  assert.deepEqual(face.styling.renderReadySlots,[0,1]);
  assert.deepEqual(face.styling.renderSlotModels,['','',submissions[0].modelId,submissions[0].modelId]);
  assert.equal(face.styling.sourceImages[1],face.images[1]);
  await verifyCount(2);
  const saved=page.waitForResponse(r=>r.request().method()==='PUT' && r.url().includes('/api/preset-roles/record'));
  await choose(library.locator('[data-role-resource="0"]'),'#c32a11');await saved;
  assert.deepEqual((await read()).styling,face.styling,'uploading the same full body preserves the already confirmed face');
};
