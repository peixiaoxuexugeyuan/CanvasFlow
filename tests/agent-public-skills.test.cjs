const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const root=path.join(__dirname,'..');
const base=path.join(root,'assets/agent-skills/libtv');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
function boot(fetch){
  const c=vm.createContext({window:{},fetch,URL,Map,Set});
  for(const file of ['agent-skill-catalog.js','agent-public-skills.js','agent-skill-details.js','agent-hub.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  return c.window;
}
test('every public document matches its provenance hash and local bundle, including case-sensitive paths',()=>{
  let count=0,bytes=0;
  for(const skill of manifest.skills){
    const dir=path.join(base,skill.templateUuid),bundle=JSON.parse(fs.readFileSync(path.join(dir,'bundle.bin'),'utf8'));
    assert.equal(bundle.files.length,skill.files.length);
    assert.ok(bundle.files.some(f=>f.path===bundle.primarySkillFilePath));
    for(const file of skill.files){
      const raw=fs.readFileSync(path.join(dir,'files',file.diskPath));
      assert.equal(raw.length,file.bytes);bytes+=raw.length;count++;
      assert.equal(createHash('sha256').update(raw).digest('hex'),file.sha256);
      assert.equal(raw.toString('utf8'),bundle.files.find(f=>f.path===file.path).content);
    }
  }
  assert.equal(count,2460);assert.equal(bytes,manifest.summary.contentBytes);
  assert.equal(manifest.skills.length,844);assert.equal(manifest.unavailable.length,811);
});
test('catalog merges old cards without duplicating templates or changing saved favorite IDs',()=>{
  const w=boot(()=>assert.fail('metadata must not fetch content'));
  const skills=w.CanvasFlowAgentHub.presets;
  const ids=skills.map(s=>s.details?.templateUuid).filter(Boolean);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(skills.filter(s=>s.bundleUrl).length,844);
  assert.equal(skills.find(s=>s.details?.templateUuid==='574f2608cf4a430eb5b1546dd60bcb29').id,'hub-film-shot');
  assert.equal(skills.find(s=>s.id==='hub-shot-remix').bundleUrl,undefined);
});
test('lazy load includes exact main and reference files, deduplicates requests and uses local URLs',async()=>{
  let calls=0;
  const w=boot(async url=>{calls++;assert.match(url,/^assets\/agent-skills\/libtv\/[a-f0-9]+\/bundle.bin$/);return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,url),'utf8'))};});
  const skill=w.CanvasFlowAgentHub.presets.find(s=>s.id==='hub-film-shot');
  assert.equal(skill.prompt,'');assert.equal(calls,0);
  await Promise.all([w.CanvasFlowPublicSkills.load(skill),w.CanvasFlowPublicSkills.load(skill)]);
  assert.equal(calls,1);assert.equal(skill.details.files.length,3);
  for(const f of skill.details.files)assert.ok(skill.prompt.includes(f.content));
  await w.CanvasFlowPublicSkills.load(skill);assert.equal(calls,1);
});
test('failed bundles remain retryable and cannot masquerade as another skill',async()=>{
  let calls=0;
  const w=boot(async url=>({ok:true,json:async()=>{calls++;return calls===1?{templateUuid:'wrong',files:[]}:JSON.parse(fs.readFileSync(path.join(root,url),'utf8'));}}));
  const skill=w.CanvasFlowAgentHub.presets.find(s=>s.bundleUrl);
  await assert.rejects(w.CanvasFlowPublicSkills.load(skill),/不完整/);
  assert.equal(skill.documentsLoaded,false);assert.equal(skill.prompt,'');
  await w.CanvasFlowPublicSkills.load(skill);assert.equal(skill.documentsLoaded,true);assert.equal(calls,2);
});
test('stable ID tokens resolve the selected skill even when titles collide',()=>{
  const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const start=source.indexOf('const AGENT_SKILL_TOKEN_RE'),end=source.indexOf('function agentRenderHighlight()',start);
  const items=[{id:'libtv-one',title:'同名技能'},{id:'libtv-two',title:'同名技能'}];
  const c=vm.createContext({agentAllSkills:()=>items,window:{}});vm.runInContext(source.slice(start,end),c);
  assert.equal(vm.runInContext("agentReferencedSkills('[[技能:libtv-two]]')[0].id",c),'libtv-two');
  assert.equal(vm.runInContext("agentReferencedSkills('[[技能:同名技能]]')[0].id",c),'libtv-one');
});
