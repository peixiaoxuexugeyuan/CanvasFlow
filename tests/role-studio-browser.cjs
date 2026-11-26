const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const path = require('node:path');
const readline = require('node:readline');
const {chromium} = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');
const browserAccess = require('./local-browser-access.cjs');

const root = path.resolve(__dirname, '..');
const model = {id:'role-fixture', model:'role-fixture', name:'离线角色模型', imageReferences:{min:0,max:4}};
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jEOcAAAAASUVORK5CYII=', 'base64');

async function exercise(page, origin, access, dataDir) {
  const errors = [];
  const requests = [];
  let failNext = true;
  page.on('pageerror', err => errors.push(err.message));
  const headers = access.headers;
  const api = async (method, route, options={}) => {
    const res = await page.request.fetch(origin+route, {method,headers,...options});
    assert.ok(res.ok(), method+' '+route+' returned '+res.status());
    return res.json();
  };
  const generated = (await api('POST','/api/media',{data:pixel,headers:{...headers,'Content-Type':'image/png','X-Media-Name':'result.png','X-Media-Type':'image/png'}})).media.url;
  const historyImage = require('node:fs').readFileSync(path.join(root,'role-library/web/008-1.jpg'));
  const historical = (await api('POST','/api/media',{data:historyImage,headers:{...headers,'Content-Type':'image/jpeg','X-Media-Name':'history.jpg','X-Media-Type':'image/jpeg'}})).media.url;
  require('node:fs').writeFileSync(path.join(dataDir,'fixture-derivative-url'),historical);
  const project = (await api('POST','/api/projects',{data:{projectName:'角色测试',nodes:[{id:'original-note',type:'prompt',title:'测试',copy:'',left:30,top:30}],edges:[]}})).project;
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== origin) return route.abort();
    switch (url.pathname) {
      case '/api/jobs':
        if(url.searchParams.get('kind')==='image' && url.searchParams.get('status')==='completed' && url.searchParams.get('projectId')===project.id)
          return route.fulfill({json:{total:2,jobs:[{status:'completed',imageUrl:historical,prompt:'蓝色服装'}, {status:'completed',imageUrl:generated,prompt:'白色服装'}]}});
        return route.continue();
      case '/api/ai/models': return route.fulfill({json:{models:{t2i:[model],video:[],text:[],audio:[]}}});
      case '/api/agent/community-skills': return route.fulfill({json:{skills:[],count:0}});
      case '/api/ai/image-generate':
        requests.push(req.postDataJSON());
        if (failNext) { failNext=false; return route.fulfill({status:503,json:{message:'测试模型暂时不可用'}}); }
        return route.fulfill({json:{job:{id:'fixture-'+requests.length,status:'completed',imageUrl:generated}}});
    }
    if (req.method()==='POST' && (/^\/api\/(?:ai\/|generate|agent\/chat)/).test(url.pathname)) throw new Error('Unexpected provider request '+url.pathname);
    return route.continue();
  });
  await page.addInitScript(() => localStorage.setItem('canvasflow-startup-animation', JSON.stringify({enabled:false})));
  await page.goto(access.link);
  await page.waitForURL(origin+'/');
  await page.goto(origin+'/?project='+project.id);
  await page.locator('[data-node-id="original-note"]').waitFor();
  const modal=page.locator('dialog.role-studio[open]');
  await require('./role-studio-styling-flow.cjs')({page,generated,historical,modal});
  const openLibrary=async()=>{await page.locator('#roleLibraryBtn').click(); await page.locator('#roleLibraryModal.open').waitFor();};
  const readRoles=()=>api('GET','/api/preset-roles');
  const start=await readRoles();
  await openLibrary();
  await require('./role-studio-cutout-flow.cjs')({page,modal,api,headers,openLibrary,historical});
  await require('./role-studio-model-flow.cjs')({page,modal,generated,model});
  await require('./role-studio-prompt-flow.cjs')({page,modal,api,generated,historical});
  const entry=page.locator('#roleLibraryMain [data-role-style]');
  const source=await entry.getAttribute('data-role-style');
  assert.ok(source.startsWith('libtv-'));
  await require('./role-studio-editing-flow.cjs')({page,modal,openLibrary});
  await entry.click();
  await modal.waitFor();
  const mode=id=>modal.locator('[data-mode="'+id+'"]');
  async function save(add,copy=false) {
    await modal.locator('[data-action='+(add?'apply':'save')+']').click();
    await modal.getByRole('menuitem',{name:copy?'保存为新角色':'更新当前角色'}).click();
  }
  const slider=modal.locator('input[type=range]').first();
  assert.ok(await modal.locator('[data-action=generate]').isDisabled(),'unmodified role cannot submit a generation');
  await modal.getByText('· 已全部生成',{exact:true}).waitFor();
  const compare=modal.locator('[data-action=compare]');
  const blemish=modal.locator('[data-field="face.skin.blemish"]');
  assert.ok(await compare.isDisabled());
  await blemish.check();
  assert.ok(await modal.locator('[data-action=generate]').isEnabled());
  assert.ok(await compare.isDisabled(),'a change requiring generation has no visible before/after yet');
  await blemish.uncheck();
  const portrait=modal.getByRole('img',{name:'角色预览'});
  const originalPortrait=await portrait.getAttribute('src');
  assert.equal(source,'libtv-024');
  assert.ok(originalPortrait.endsWith('role-library/web/024-2.jpg'),'the initial half view uses the matching close-up');
  async function checkOfficialPhoto(slot,width,height) {
    const stem='024-'+slot;
    await page.waitForFunction(stem=>{
      const box=document.querySelector('dialog[open] .rs-image-box');
      const base=box?.querySelector('img[alt="角色预览"]'),cutout=box?.querySelector('.rs-subject-preview');
      return base?.currentSrc.endsWith(stem+'.jpg') && cutout?.currentSrc.endsWith(stem+'.webp') &&
        cutout.complete && cutout.naturalHeight && !cutout.hidden;
    },stem);
    const frame=await modal.locator('.rs-image-box').evaluate(box=>{
      const subject=box.querySelector('.rs-subject-preview');
      return {width:subject.naturalWidth,height:subject.naturalHeight,boxHeight:box.clientHeight,
        stageHeight:box.parentElement.clientHeight,displayHeight:box.getBoundingClientRect().height};
    });
    assert.deepEqual([frame.width,frame.height],[width,height],'the preview decodes the native portrait pixels');
    assert.ok(frame.boxHeight<=frame.stageHeight && Math.abs(frame.boxHeight-frame.displayHeight)<1,
      'paired original photographs fit the stage without camera enlargement');
  }
  await checkOfficialPhoto(2,1792,2400);
  await modal.locator('[data-action=full]').click();
  await checkOfficialPhoto(1,1536,2048);
  const originalFull=await portrait.getAttribute('src');
  await modal.locator('[data-action=half]').click();
  await checkOfficialPhoto(2,1792,2400);
  assert.equal(await portrait.getAttribute('src'),originalPortrait);
  const sliderStart=await slider.inputValue();
  await slider.focus(); await slider.press('ArrowRight');
  const changed=await slider.inputValue();
  assert.notEqual(changed,sliderStart,'skin control changed');
  await modal.locator('.rs-history').getByRole('button',{name:/撤销/}).click();
  assert.equal(await slider.inputValue(),sliderStart,'undo restores original');
  await modal.locator('[data-action=redo]').click();
  assert.equal(await slider.inputValue(),changed,'redo restores edit');

  assert.equal(await modal.locator('.rs-modes button').count(),5);
  for (const id of ['features','body','outfit','voice','face']) {
    const button=mode(id); await button.click();
    assert.ok(await button.evaluate(el=>el.classList.contains('is-active') || el.getAttribute('aria-pressed')==='true' || el.getAttribute('aria-selected')==='true'));
  }
  await mode('outfit').click();
  for(const [category,field] of [['styling','hairstyle'],['styling','makeup'],['clothes','wardrobe']]) {
    await modal.locator('[data-tab="'+category+'"]').click();
    const card=modal.locator('[data-option="outfit.'+category+'.'+field+'"]').first();
    await card.click();
    assert.equal(await card.getAttribute('aria-pressed'),'true');
    await card.click();
    assert.equal(await card.getAttribute('aria-pressed'),'false','clicking an active '+field+' clears it');
  }
  await modal.locator('[data-tab=styling]').click();
  const customHair=modal.getByLabel('自定义颜色');
  for(const color of ['#235472','#b34872']) {
    await customHair.click();
    const picker=modal.getByRole('dialog',{name:'自定义发色'});
    await picker.getByRole('button',{name:/饱和度/}).press('ArrowRight');
    await picker.getByLabel('色相').press('ArrowRight');
    await picker.getByLabel('十六进制发色').fill(color);
    await picker.getByRole('button',{name:'应用'}).click();
    assert.equal(await picker.count(),0);
  }
  const earlierSwatch=modal.getByRole('button',{name:'发色 #235472',exact:true});
  await earlierSwatch.click();
  assert.equal(await earlierSwatch.getAttribute('aria-pressed'),'true','earlier custom colors can be picked again');
  await modal.locator('[data-tab=ai]').click();
  await modal.locator('.rs-upload').setInputFiles(path.join(root,'role-library/web/007-1.jpg'));
  await modal.locator('.rs-outfit-thumb').waitFor();
  const outfit=await modal.locator('.rs-outfit-thumb').getAttribute('src');
  assert.match(outfit,/^\/media\/media-[a-f0-9]{32}\.jpg$/);
  const thumbUrls=()=>modal.locator('.rs-outfit-thumb').evaluateAll(elements=>elements.map(el=>el.getAttribute('src')));
  await modal.locator('.rs-upload').setInputFiles([path.join(root,'role-library/web/007-1.jpg'),path.join(root,'role-library/web/007-2.jpg')]);
  await modal.getByRole('button',{name:'移除第 2 张参考图'}).waitFor();
  assert.equal((await thumbUrls()).length,2,'uploading a duplicate appends only the new file');
  await modal.getByRole('button',{name:'移除第 2 张参考图'}).click();
  await modal.getByRole('button',{name:'生成历史',exact:true}).click();
  const historyPicker=page.getByRole('dialog',{name:'选择参考图'});
  await historyPicker.getByRole('button',{name:'白色服装'}).click();
  await historyPicker.getByRole('button',{name:'蓝色服装'}).click();
  await historyPicker.getByRole('button',{name:'添加所选（2）'}).click();
  await modal.getByRole('button',{name:'移除第 3 张参考图'}).waitFor();
  assert.deepEqual(await thumbUrls(),[outfit,generated,historical]);
  await modal.getByRole('button',{name:'移除第 2 张参考图'}).click();
  assert.deepEqual(await thumbUrls(),[outfit,historical]);
  await modal.locator('[data-action=undo]').click();
  assert.deepEqual(await thumbUrls(),[outfit,generated,historical]);
  await modal.locator('[data-action=redo]').click();
  assert.deepEqual(await thumbUrls(),[outfit,historical],'redo removes the same reference after undo');
  await mode('voice').click();
  const voiceCard=modal.locator('[data-rs-voice-card]').first();
  const voiceName=await voiceCard.getAttribute('data-name');
  await voiceCard.locator('.rs-voice-select').click();
  await mode('face').click();
  await modal.locator('[data-tab=eyes]').click();
  await modal.locator('[data-field="face.eyes.eyeSizeLeft"]').press('End');
  await modal.locator('[data-tab=skin]').click();
  await modal.locator('.rs-identity input').fill('私有角色浏览器测试');
  const generate=modal.locator('[data-action=generate]');
  await generate.click();
  await modal.locator('.rs-status').filter({hasText:'测试模型暂时不可用'}).waitFor();
  assert.equal(requests.length,1);
  await generate.click();
  await page.waitForFunction(url=>document.querySelector('.rs-image-box > img')?.getAttribute('src')===url,generated);
  assert.equal(requests.length,2);
  assert.deepEqual(requests[1],requests[0],'retry uses identical model, pose, and reference images');
  assert.equal(requests[1].modelId,model.id);
  assert.ok(requests[1].prompt.includes('质感磨皮'));
  assert.ok(requests[1].referenceImages.includes(outfit));
  assert.ok(requests[1].referenceImages.indexOf(historical)>requests[1].referenceImages.indexOf(outfit));
  const refIndex=requests[1].prompt.match(/参考图\s*(\d+)\s*用于还原角色的局部外观调整/);
  assert.ok(refIndex,'a separate edited identity photograph is sent to the actual image adapter');
  const delta=await page.evaluate(async({raw,edited,skin})=>{
    const photo=async src=>{const img=new Image();img.src=src;await img.decode();return img;};
    const [a,b]=await Promise.all([raw,edited].map(photo));
    const host=document.createElement('div');host.append(a);
    const inspector=createRoleAppearancePreview(a);let reference;
    try {reference=await inspector.referenceFor(a.src,{'face.skin.smooth':skin,'face.eyes.eyeSizeLeft':100});}
    finally {inspector.destroy();}
    if(!reference) throw Error('Missing edited preview');
    const expected=await photo(reference.toDataURL('image/jpeg',.94));
    const canvas=document.createElement('canvas');canvas.width=b.width;canvas.height=b.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    function rgb(img){ctx.drawImage(img,0,0,canvas.width,canvas.height);return ctx.getImageData(0,0,canvas.width,canvas.height).data;}
    const src=rgb(a),ref=rgb(b),want=rgb(expected);let originalDiff=0,expectedDiff=0;
    for(let i=0;i<ref.length;i+=4){originalDiff+=Math.abs(src[i]-ref[i]);expectedDiff+=Math.abs(want[i]-ref[i]);}
    return {originalDiff,expectedDiff};
  },{raw:originalPortrait,skin:Number(changed),edited:requests[1].referenceImages[Number(refIndex[1])-1]});
  assert.ok(delta.originalDiff>0 && delta.expectedDiff<delta.originalDiff*.02,'provider image matches the edited reference: '+JSON.stringify(delta));
  assert.ok(await modal.getByText('· 预计 4 次图片生成（全身主图 1 次，衍生资产 3 次）',{exact:true}).isVisible(),'the half portrait does not replace the full body or the separate close-up asset');
  await modal.locator('[data-action=undo]').click();
  assert.equal(await portrait.getAttribute('src'),originalPortrait,'undoing completed generation restores the original image');
  assert.equal(await slider.inputValue(),changed,'undoing generation preserves slider edits');
  await modal.locator('[data-action=redo]').click();
  assert.equal(await portrait.getAttribute('src'),generated,'redoing generation restores the rendered frame without another job');
  assert.ok(await modal.locator('.rs-assets').isChecked(),'both save modes can build the four views');
  await modal.locator('.rs-assets').uncheck();
  await save(false,true);
  await modal.waitFor({state:'hidden'});
  const first=await readRoles();
  assert.deepEqual(first.global,start.global,'official source unmodified');
  assert.equal(first.mine.custom.length,start.mine.custom.length+1);
  const copy=first.mine.custom.find(item=>item.name==='私有角色浏览器测试');
  assert.ok(copy && copy.id!==source);
  assert.equal(copy.styling.controls['face.skin.smooth'],Number(changed));
  assert.ok(copy.styling.prompt.includes('质感磨皮'));
  assert.equal(copy.styling.outfitUrl,outfit);
  assert.deepEqual(copy.styling.outfitUrls,[outfit,historical]);
  assert.equal(copy.styling.sourceImages.length,4);
  assert.deepEqual(copy.styling.renderedSlots,[]);
  assert.equal(copy.styling.halfPreviewOnly,false);
  assert.ok(originalFull.endsWith(copy.styling.sourceImages[0]));
  assert.ok(originalPortrait.endsWith(copy.styling.sourceImages[1]));
  assert.equal(copy.styling.halfPreviewUrl,generated);
  assert.equal(copy.images[1],copy.styling.sourceImages[1]);
  assert.equal(JSON.parse(copy.styling.controls['voice.selection']).name,voiceName);
  assert.ok(copy.styling.prompt.includes(voiceName));
  assert.ok(!requests[1].prompt.includes('音色：'+voiceName),'image generation excludes voice controls');
  await page.reload();
  await page.locator('[data-node-id="original-note"]').waitFor();
  await openLibrary();
  await page.locator('[data-role-scope=mine]').click();
  await page.locator('#roleLibraryMain [data-role-style="'+copy.id+'"]').click();
  await modal.waitFor();
  assert.equal(await slider.inputValue(),changed);
  assert.equal(await portrait.getAttribute('src'),generated,'saved generated view opens intact');
  await mode('outfit').click();
  assert.equal(await earlierSwatch.getAttribute('aria-pressed'),'true');
  assert.equal(await modal.getByRole('button',{name:'发色 #b34872',exact:true}).count(),1,'unselected custom color survives reload');
  await mode('face').click();
  await compare.focus(); await page.keyboard.down('Space');
  assert.equal(await portrait.getAttribute('src'),originalPortrait,'holding Compare shows the matching original portrait after reload');
  await page.keyboard.up('Space');
  assert.equal(await portrait.getAttribute('src'),generated,'releasing Compare returns to the generated image');
  await slider.focus(); await slider.press('ArrowRight');
  assert.equal(await portrait.getAttribute('src'),originalPortrait,'new sliders start from the matching original portrait');
  await modal.locator('[data-action=undo]').click();
  assert.equal(await portrait.getAttribute('src'),generated,'undoing the edit restores the saved visual settings and frame');
  await mode('voice').click();
  assert.equal(await modal.locator('[data-rs-voice-card] .rs-voice-select[aria-pressed=true]').count(),1);
  await mode('outfit').click();
  await modal.locator('[data-tab=ai]').click();
  assert.deepEqual(await thumbUrls(),[outfit,historical]);
  await modal.locator('.rs-identity input').fill('私有角色更新');
  const recordRoute='**/api/preset-roles/record?scope=mine';
  const missedReply=async route=>{
    await api('PUT','/api/preset-roles/record?scope=mine',{data:route.request().postDataJSON()});
    await route.abort('failed');
  };
  await page.route(recordRoute,missedReply);
  const queued=page.waitForRequest(req=>req.method()==='PUT' && req.url().includes('/api/preset-roles/record') && req.postDataJSON().derivatives);
  await save(true);
  const submittedOperation=(await queued).postDataJSON(),spec=submittedOperation.derivatives;
  assert.equal(spec.projectId,project.id);
  assert.deepEqual(spec.items.map(i=>i.slot),[1,2,3]);
  for(const row of spec.items) for(const url of row.payload.referenceImages) assert.match(url,/^\/media\//);
  await page.waitForFunction(()=>document.querySelector('dialog.role-studio')?.getAttribute('aria-busy')==='false');
  await page.unroute(recordRoute,missedReply);
  await page.reload();
  await page.locator('[data-node-id="original-note"]').waitFor();
  await openLibrary();
  await page.locator('[data-role-scope=mine]').click();
  await page.locator('[data-role-select="'+copy.id+'"]').click();
  await page.locator('#roleLibraryMain [data-role-style="'+copy.id+'"]').click();
  await modal.locator('.rs-model option').first().waitFor({state:'attached'});
  const replay=page.waitForRequest(req=>req.method()==='PUT' && req.url().includes('/api/preset-roles/record'));
  await save(true);
  assert.deepEqual((await replay).postDataJSON(),submittedOperation,'after a lost save response and a reload the same normalized operation is replayed');
  await modal.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelectorAll('.flow-node.image-node[data-media-prompt]').length===4);
  const userGroup=await page.locator('.image-node[data-role-snapshot-ref]').evaluateAll(nodes=>nodes.map(n=>n.dataset.groupId));
  assert.ok(userGroup[0] && userGroup.every(id=>id===userGroup[0]));
  const replacement=generated;
  let pendingProject;
  for(let n=0;n<80&&!pendingProject;n++){
    const stored=(await api('GET','/api/projects/'+project.id)).project;
    const node=stored.nodes.find(row=>row.roleAsset?.slot===2 && row.roleSnapshots?.some(s=>s.derivativeBatchId===spec.id));
    if(node){node.previewMedia=replacement;pendingProject=stored;}
    else await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(pendingProject,'the project saved the queued batch on its canvas nodes');
  await page.goto(origin+'/');
  await api('PUT','/api/projects/'+project.id,{data:pendingProject});
  await page.goto(origin+'/?project='+project.id);await page.locator('[data-node-id="original-note"]').waitFor();
  require('node:fs').writeFileSync(path.join(dataDir,'allow-fixture-derivatives'),'ready');
  await page.waitForFunction(({url,replacement})=>Array.from(document.querySelectorAll('.image-node[data-role-snapshot-slot]')).filter(n=>n.dataset.roleSnapshotSlot!=='0').every(n=>n.dataset.previewMedia===(n.dataset.roleSnapshotSlot==='2'?replacement:url)),{url:historical,replacement},{timeout:20000});
  const after=await readRoles();
  assert.equal(after.mine.custom.length,first.mine.custom.length);
  const updated=after.mine.custom.find(item=>item.id===copy.id);
  assert.equal(updated.name,'私有角色更新');
  assert.deepEqual(updated.styling.sourceImages,copy.styling.sourceImages);
  assert.deepEqual(updated.styling.renderedSlots,[0,1,2,3]);
  assert.equal(updated.styling.halfPreviewOnly,false);
  assert.deepEqual(after.global,start.global);
  assert.equal(requests.length,3,'save only submits the main picture from the editor');
  assert.ok(requests.every(r=>r.projectId===project.id),'all foreground role pictures enter the current project history');
  const nodes=page.locator('.flow-node.image-node[data-media-prompt]');
  for (const prompt of await nodes.evaluateAll(rows=>rows.map(node=>node.dataset.mediaPrompt))) assert.ok(prompt.includes('质感磨皮'));
  const reopenCopy=async(fromCanvas)=>{
    if (fromCanvas) {
      await page.locator('#roleLibraryModal').waitFor({state:'detached'});
      await openLibrary();
    } else {
      await page.locator('#roleLibraryModal.open').waitFor();
    }
    await page.locator('[data-role-scope=mine]').click();
    await page.locator('#roleLibraryMain [data-role-style="'+copy.id+'"]').click();
    await modal.waitFor();
    await mode('features').click();
  };
  await reopenCopy(true);
  await modal.locator('[data-option="features.marks.mark"][data-value="痣"]').click();
  await modal.locator('[data-action=full]').click();
  const marks=modal.locator('.rs-marks .rs-mark');
  const countMarks=(expected)=>page.waitForFunction(n=>document.querySelectorAll('dialog.role-studio[open] .rs-marks .rs-mark').length===n,expected);
  async function uploadColor(name,color) {
    const png=await page.evaluate(c=>{
      const image=document.createElement('canvas');image.width=48;image.height=32;
      const ctx=image.getContext('2d');ctx.fillStyle=c;ctx.fillRect(0,0,48,32);
      return image.toDataURL().split(',')[1];
    },color);
    const chooser=page.waitForEvent('filechooser');
    await modal.locator('[data-option="features.marks.mark"][data-value="自定义"]').click();
    await (await chooser).setFiles({name:name+'.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  }
  const selected=()=>modal.locator('.rs-mark-editing').getAttribute('data-mark-id');
  const layer=id=>modal.locator('[data-mark-id="'+id+'"]');
  const position=id=>layer(id).evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),
    size:parseFloat(el.style.width),turn:parseFloat(el.style.getPropertyValue('--turn'))}));
  async function moveLayer(id,x,y) {
    const area=await modal.locator('.rs-marks').boundingBox(),box=await layer(id).boundingBox();
    const cx=box.x+box.width/2,cy=box.y+box.height/2;
    await page.mouse.move(cx,cy);await page.mouse.down();
    await page.mouse.move(cx+x*area.width,cy+y*area.height,{steps:4});await page.mouse.up();
    assert.equal(await selected(),id);
  }
  await countMarks(1);
  const mole=await selected();
  await modal.locator('[data-action=half]').click();
  for (let i=0;i<28;i++) await layer(mole).locator('.rs-resize').press('ArrowLeft');
  const projectedWidth=await page.evaluate(async([full,half])=>{
    const holder=document.createElement('div'), img=new Image();holder.append(img);
    const inspector=createRoleAppearancePreview(img);
    try {
      const [a,b]=await Promise.all([full,half].map(url=>inspector.faceBounds(url)));
      if(!a || !b) throw Error('Missing face landmarks on the paired portraits');
      return 3*b.width/a.width;
    } finally {inspector.destroy();}
  },[originalFull,originalPortrait]);
  async function waitForMoleOnCloseup() {
    await page.waitForFunction(({id,width})=>{
      const layer=document.querySelector('[data-mark-id="'+id+'"]');
      return layer && Math.abs(parseFloat(layer.style.width)-width)<0.01;
    },{id:mole,width:projectedWidth});
  }
  assert.ok(projectedWidth>3,'a full-view mark projects larger on the close-up');
  await waitForMoleOnCloseup();
  await modal.locator('[data-action=full]').click();
  assert.equal((await position(mole)).size,3,'the own-view minimum is stored in full-image coordinates');
  await layer(mole).press('ArrowRight');
  await layer(mole).locator('[data-mark-action=rotate]').press('Enter');
  await modal.locator('[data-action=half]').click();
  await waitForMoleOnCloseup();
  await modal.locator('[data-action=full]').click();
  await uploadColor('green','#00ff00');
  await countMarks(2);
  const green=await selected();
  await moveLayer(green,-.043,.01);
  await modal.locator('[data-action=half]').click();
  assert.equal(await marks.count(),2,'full and half views use the same sticker layers');
  await uploadColor('red','#ff0000');await countMarks(3);
  const red=await selected();
  const before=await position(red);
  await moveLayer(red,.22,.07);
  const moved=await position(red);
  assert.ok(moved.x>before.x+20 && moved.y>before.y+5);
  const greenBefore=await position(green);
  await layer(red).locator('[data-mark-action=rotate]').press('Enter');
  await layer(red).locator('[data-mark-action=resize]').press('ArrowRight');
  const redHalf=await position(red);
  assert.equal(redHalf.turn,15);assert.ok(redHalf.size>moved.size);
  assert.deepEqual(await position(green),greenBefore,'transforming red leaves green intact');
  await layer(green).click();
  assert.equal(await selected(),green,'each sticker can be independently selected');
  for (const action of ['rotate','resize','erase']) {
    await layer(green).locator('[data-mark-action='+action+']').click({trial:true});
  }
  await layer(green).locator('[data-mark-action=erase]').click();await countMarks(2);
  assert.equal(await layer(green).count(),0);assert.deepEqual(await position(red),redHalf);
  await modal.locator('[data-action=undo]').click();await countMarks(3);
  assert.deepEqual(await position(green),greenBefore);
  await modal.locator('[data-action=full]').click();
  const redFull=await position(red);
  assert.ok(redFull.size<redHalf.size && redFull.y<redHalf.y,
    'the same face sticker occupies a smaller region nearer the top of the full photograph');
  assert.equal(redFull.turn,redHalf.turn);
  await modal.locator('[data-action=half]').click();
  assert.deepEqual(await position(red),redHalf);
  await modal.locator('.rs-assets').uncheck();
  await save(false); await modal.waitFor({state:'hidden'});
  const getSaved=async()=>(await readRoles()).mine.custom.find(r=>r.id===copy.id);
  const savedMarks=JSON.parse((await getSaved()).styling.controls['features.marks.items']);
  assert.equal(savedMarks.length,3);
  assert.equal(savedMarks.find(m=>m.id===red).view,'full');
  assert.equal(savedMarks.find(m=>m.id===green).view,'full');
  assert.equal(savedMarks.filter(m=>m.preset==='痣').length,1);
  for(const item of savedMarks.filter(m=>m.preset==='自定义')) assert.match(item.src,/^\/media\/media-[a-f0-9]{32}\.png$/);
  assert.equal(requests.length,3,'saving layers without assets does not submit a generation');
  await reopenCopy(false); await countMarks(3);
  await page.waitForFunction(({id,expected})=>{
    const layer=document.querySelector('[data-mark-id="'+id+'"]');
    return layer && parseFloat(layer.style.top)===expected.y && parseFloat(layer.style.width)===expected.size;
  },{id:red,expected:redHalf});
  assert.deepEqual(await position(red),redHalf,'reopening reproduces the close-up placement after landmarks resolve');
  await modal.locator('[data-action=generate]').click();
  await modal.locator('.rs-status').filter({hasText:'当前视角已生成'}).waitFor();
  const submission=requests.at(-1);
  const match=submission.prompt.match(/参考图\s*(\d+)\s*用于还原角色原图上已定位的特征/);
  assert.ok(match,'actual provider prompt identifies the positioned composite');
  const ref=submission.referenceImages[Number(match[1])-1];
  const centers={red:redHalf,green:await position(green)};
  const samples=await page.evaluate(async({ref,centers})=>{
    const img=new Image();img.src=ref;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    return Object.fromEntries(Object.entries(centers).map(([name,p])=>[name,
      Array.from(ctx.getImageData(Math.floor(img.width*p.x/100),Math.floor(img.height*p.y/100),1,1).data)]));
  },{ref,centers});
  assert.ok(samples.red[0]>235 && samples.red[1]<20 && samples.red[2]<20,'red layer present at its rendered center: '+samples.red);
  assert.ok(samples.green[1]>235 && samples.green[0]<20 && samples.green[2]<20,'green layer present at its rendered center: '+samples.green);
  for (const remaining of [2,1,0]) {
    await modal.locator('.rs-mark-editing [data-mark-action=erase]').click();
    await countMarks(remaining);
  }
  await modal.locator('.rs-assets').uncheck();
  await save(false); await modal.waitFor({state:'hidden'});
  assert.ok(!Object.hasOwn((await getSaved()).styling.controls,'features.marks.items'));
  await require('./role-studio-save-flow.cjs')({page, modal, readRoles, api, copyId:copy.id, officialId:source, generated});
  await require('./role-studio-provenance-flow.cjs')({page,modal,api,readRoles,generated,model,requests});
  await require('./role-profile-image-flow.cjs')({page,api,readRoles,generated,modal});
  await require('./role-canvas-snapshot-flow.cjs')({page,api,readRoles,generated});
  assert.deepEqual(errors,[]);
}

async function main() {
  const script = [
    'import json, os, sys, tempfile, threading',
    'with tempfile.TemporaryDirectory(prefix="canvasflow-role-studio-") as data:',
    '    os.environ.update(CANVASFLOW_DATA_DIR=data, LOCALAPPDATA=data)',
    '    from server import Handler, ThreadingHTTPServer',
    '    import server, time',
    '    from pathlib import Path',
    '    def fake_image(user, payload, workspace, job_id=None):',
    '        assert payload["modelId"] == "role-fixture"',
    '        for _ in range(600):',
    '            if (Path(data)/"allow-fixture-derivatives").exists(): break',
    '            time.sleep(.05)',
    '        return {"id":job_id,"status":"completed","imageUrl":(Path(data)/"fixture-derivative-url").read_text()}, None',
    '    server.create_image_job = fake_image',
    '    Handler.log_message=lambda *args: None',
    '    httpd=ThreadingHTTPServer(("127.0.0.1",0),Handler)',
    '    report=httpd.handle_error',
    '    httpd.handle_error=lambda req,addr: None if isinstance(sys.exc_info()[1], ConnectionError) else report(req,addr)',
    '    thread=threading.Thread(target=httpd.serve_forever,daemon=True); thread.start()',
    '    print(json.dumps({"origin":"http://127.0.0.1:"+str(httpd.server_port),"data":data}),flush=True)',
    '    sys.stdin.readline(); httpd.shutdown(); httpd.server_close(); thread.join()',
  ].join('\n');
  const server=spawn(path.join(root,'.runtime/python/python.exe'),['-u','-c',script],
    {cwd:root,windowsHide:true,stdio:['pipe','pipe','inherit']});
  const closed=once(server,'exit');
  const lines=readline.createInterface({input:server.stdout});
  let browser;
  try {
    let fixture;
    for await (const line of lines) { if (line.startsWith('{"origin"')) {fixture=JSON.parse(line);break;} }
    assert.ok(fixture,'isolated role server started');
    const access=browserAccess(root,fixture.data,fixture.origin);
    browser=await chromium.launch({executablePath:path.join(root,'.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
    const context=await browser.newContext({viewport:{width:1400,height:900},reducedMotion:'reduce'});
    const page=await context.newPage();
    page.setDefaultTimeout(9000);
    await exercise(page,fixture.origin,access,fixture.data);
    console.log('Role studio browser flow passed, using private test storage and a simulated image provider.');
  } finally {
    await browser?.close(); server.stdin.end('\n'); await closed;
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
