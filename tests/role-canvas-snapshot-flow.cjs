const assert = require('node:assert/strict');
const {setTimeout:delay} = require('node:timers/promises');

module.exports = async function checkCanvasSnapshot({page,api,readRoles,generated}) {
  const path = '/api/preset-roles/record?scope=mine';
  const origin = new URL(page.url()).origin;
  const voice = JSON.stringify({name:'快照声线',source:'provider',profile:{modelId:'sample',voice:'sample-1'}});
  const role = {id:'char-snapshot',name:'画布引用',value:'插入时的文字',images:[generated,'','',''],
    styling:{version:1,controls:{'voice.selection':voice},prompt:'插入时的造型'}};
  await api('PUT',path,{data:{id:role.id,record:role}});
  const legacy = {id:'char-old-token',name:'历史角色',value:'旧标记对应的描述'};
  await api('PUT',path,{data:{id:legacy.id,record:legacy}});
  const project = (await api('POST','/api/projects',{data:{projectName:'角色快照',nodes:[
    {id:'snapshot-target',type:'image',title:'提示词目标',mediaPrompt:'[[角色:历史角色|id=char-old-token]] [[角色:历史角色]] [[角色:已删除旧角色|id=missing]]',left:35,top:30}
  ],edges:[]}})).project;
  const target = page.locator('[data-node-id=snapshot-target]');
  const library = page.locator('#roleLibraryModal');
  const cards = page.locator('.image-node[data-role-snapshot-ref]');
  const get = async id => (await api('GET','/api/projects/' + id)).project;
  async function savedWhen(id,check) {
    const end=Date.now()+9000;
    do { const p=await get(id); if(check(p)) return p; await delay(100); } while(Date.now()<end);
    assert.fail('Timed out waiting for the saved project snapshot');
  }
  async function libraryRole() {
    await page.locator('#roleLibraryBtn').click();
    await page.locator('[data-role-scope=mine]').click();
    await page.locator('[data-role-select="'+role.id+'"]').click();
  }
  await page.goto(origin+'/?project='+project.id);
  await target.waitFor();
  await target.click({position:{x:32,y:30}});
  await libraryRole();
  await page.locator('[data-role-apply="'+role.id+'"]').click();
  await cards.first().waitFor();
  await library.waitFor({state:'detached'});
  const saved=await savedWhen(project.id,p=>p.nodes.some(n=>n.roleAsset));
  const ref=saved.nodes.find(n=>n.roleAsset).roleSnapshots[0];
  const token=saved.nodes.find(n=>n.id==='snapshot-target').mediaPrompt;
  assert.ok(token.includes('|ref='+ref.ref),'the prompt owns an immutable reference');
  assert.equal(ref.originalPrompt,role.value);assert.equal(ref.prompt,role.value+'\n'+role.styling.prompt);
  assert.equal(ref.voice,voice);assert.equal(ref.mainReferenceImageUrl,generated);
  assert.equal(ref.stateId,'default');assert.ok(ref.version);
  await cards.first().dispatchEvent('contextmenu',{bubbles:true,clientX:550,clientY:280});
  await page.locator('#nodeMenu [data-group-menu-action=duplicate]').click();
  const copy=await savedWhen(project.id,p=>p.nodes.filter(n=>n.roleAsset?.ref===ref.ref).length===2);
  assert.equal(copy.nodes.filter(n=>n.roleAsset).every(n=>n.roleSnapshots[0].voice===voice),true);

  const latest={...role,name:'画布引用新版',value:'更新后的设定',images:['role-library/web/003-1.jpg','','','']};
  await api('PUT',path,{data:{id:role.id,expectedRevision:(await readRoles()).mine.recordRevisions[role.id],record:latest}});
  await page.reload();await target.waitFor();
  await libraryRole();
  const refresh=page.locator('[data-role-refresh="'+role.id+'"]');
  await refresh.waitFor();
  assert.equal(await cards.first().getAttribute('data-media-prompt'),ref.prompt);
  await refresh.click();
  const current=await savedWhen(project.id,p=>p.nodes.filter(n=>n.roleAsset).every(n=>n.roleSnapshots[0].name===latest.name));
  assert.equal(current.nodes.find(n=>n.id==='snapshot-target').roleSnapshots[0].version!==ref.version,true);
  assert.equal(current.nodes.filter(n=>n.roleAsset).every(n=>n.previewMedia===latest.images[0]),true);
  await api('PUT',path,{data:{id:role.id,expectedRevision:(await readRoles()).mine.recordRevisions[role.id],remove:true}});

  const imported=(await api('POST','/api/projects',{data:{projectName:'导入旧角色引用',nodes:copy.nodes,edges:[]}})).project;
  await page.goto(origin+'/?project='+imported.id);
  await target.waitFor();await target.click({position:{x:32,y:30}});
  await page.locator('#generateImageBtn').waitFor();
  const submitted=page.waitForRequest(r=>r.method()==='POST' && r.url().endsWith('/api/ai/image-generate'),{timeout:8000});
  await page.locator('#generateImageBtn').click();
  const payload=(await submitted).postDataJSON();
  assert.ok(payload.prompt.includes(ref.prompt),'deleted or newer library roles do not change the prompt');
  assert.ok(payload.prompt.includes(legacy.value+' '+legacy.value+' 已删除旧角色'),'legacy name and id tokens remain readable');
  assert.ok([payload.referenceImage,...(payload.referenceImages || [])].includes(generated),'generation uses the original identity image');
};
