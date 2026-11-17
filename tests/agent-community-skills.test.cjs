const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const item={id:'community-example',name:'同名技能',description:'完整包',category:'角色设计',type:'图片',author:'实际作者',contentHash:'a'.repeat(64),fileCount:2,primarySkillFilePath:'SKILL.md'};
const files=[{path:'SKILL.md',content:'主文档 [参考](references/camera.md)'},{path:'references/camera.md',content:'完整参考'}];
function boot(){
  let response={schemaVersion:1,skills:[{...item}],syncedAt:1000};const requests=[];
  const context=vm.createContext({window:{},URL,AbortSignal,fetch:async(url,options)=>{requests.push({url,options});if(response instanceof Error)throw response;return {ok:!response.message,json:async()=>structuredClone(response)};}});
  for(const name of ['agent-community-skills.js','agent-public-skills.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),context);
  return {module:context.window.CanvasFlowCommunitySkills,loader:context.window.CanvasFlowPublicSkills,requests,set:v=>response=v};
}
test('mirrors deduplicate without modifying private Skills or built-in content',async()=>{
  const t=boot();t.set({schemaVersion:1,skills:[item,{...item,id:'app-hub-film-shot',origin:'application',appId:'hub-film-shot'}]});
  await t.module.sync();
  const local=[{id:'hub-film-shot',title:'旧标题',prompt:'本地正文'},{id:'private-one',title:'同名技能',owned:true,prompt:'私有正文'}];
  const merged=t.module.merge(local);
  assert.equal(merged.length,3);assert.equal(merged[0].id,item.id);
  assert.equal(merged.find(s=>s.id==='hub-film-shot').prompt,'本地正文');
  assert.equal(merged.find(s=>s.owned),local[1]);
  assert.equal(merged[0].cat,'专业影视');assert.equal(merged[0].author,'实际作者');
});
test('full reference content reaches the existing public loader and never posts private data',async()=>{
  const t=boot();await t.module.sync();const skill=t.module.merge([])[0];
  t.set({skill:{...item,files}});
  await Promise.all([t.loader.load(skill),t.loader.load(skill)]);
  assert.equal(t.requests.length,2);
  assert.equal(skill.details.files.length,2);for(const file of files)assert.ok(skill.prompt.includes(file.content));
  for(const req of t.requests){assert.ok(req.url.startsWith('/api/agent/community-skills'));assert.equal(req.options.body,undefined);}
});
test('changed versions discard old documents and successful removal clears only remote entries',async()=>{
  const t=boot();await t.module.sync();const old=t.module.merge([])[0];
  t.set({skill:{...item,files}});await t.module.load(old);
  t.set({schemaVersion:1,skills:[{...item,contentHash:'b'.repeat(64)}]});await t.module.sync(true);
  const current=t.module.merge([])[0];assert.notEqual(current,old);assert.equal(current.prompt,'');
  t.set({schemaVersion:1,skills:[]});await t.module.sync(true);
  assert.equal(t.module.merge([{id:'local'}]).length,1);
});
test('offline or malformed catalog keeps known entries and reports failure',async()=>{
  const t=boot();await t.module.sync();t.set(Error('offline'));
  assert.equal((await t.module.sync(true)).stale,true);assert.equal(t.module.merge([]).length,1);
  t.set({skills:[]});assert.match((await t.module.sync(true)).error,/格式/);
  assert.equal(t.module.merge([]).length,1);
});
test('withdrawn or incomplete packages cannot execute stale instructions',async()=>{
  const t=boot();await t.module.sync();const skill=t.module.merge([])[0];
  t.set({skill:{...item,files}});await t.module.load(skill);
  t.set({message:'已下架'});await assert.rejects(t.loader.load(skill),/已下架/);
  t.set({skill:{...item,primarySkillFilePath:'missing.md',files}});
  await assert.rejects(t.module.load(skill),/不完整/);
});
