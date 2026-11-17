/* Reviewed community packages are data, never scripts. Private Skills stay local. */
(() => {
  'use strict';
  const origin='https://skill.zzzapi.xyz', endpoint='/api/agent/community-skills';
  const pending=new Map(), objects=new Map();
  let catalog=[], request=null, attempted=0;
  let state={count:0,added:0,syncedAt:0,stale:false,error:''};
  const text=value=>typeof value==='string'?value:'';
  const categories={'角色设计':'专业影视','场景概念':'专业影视','短片故事':'短剧漫剧','音乐视觉':'音乐MV','通用工具':'通用技能'};
  function coverUrl(value){
    if(!text(value))return '';
    if(/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(text(value)))return value;
    try{const u=new URL(value,origin+'/');return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
  }
  async function read(url){
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(22000)});
    const data=await response.json();
    if(!response.ok)throw Error(data.message||'社区技能同步失败，请稍后重试');
    return data;
  }
  function metadata(item){
    return {description:text(item.description),useScenario:text(item.scenario),inputType:text(item.usage),outputContent:text(item.output),
      primarySkillFilePath:item.primarySkillFilePath,version:text(item.version),sourceUrl:origin+'/#skill/'+encodeURIComponent(item.id)};
  }
  function convert(item){
    let skill=objects.get(item.id);
    if(!skill||skill.communityHash!==item.contentHash){
      skill={id:item.id,tokenName:item.id,title:item.name,desc:text(item.description),cat:categories[item.category]||text(item.category)||'通用技能',
        kind:text(item.type)||'技能',cover:coverUrl(item.cover),icon:'wand',communityId:item.id,communityHash:item.contentHash,
        author:text(item.author)||'社区创作者',fileCount:item.fileCount,details:metadata(item),prompt:'',documentsLoaded:false};
      objects.set(item.id,skill);
    }
    return skill;
  }
  function merge(base){
    const ids=new Set(base.map(s=>s.id)), templates=new Set(base.map(s=>s.details?.templateUuid).filter(Boolean));
    const linked=new Set();const extra=[];
    for(const item of catalog){
      // Only application-origin mirrors may link to a built-in ID; user metadata cannot shadow one.
      const appId=item.origin==='application'&&text(item.appId);
      if(appId&&ids.has(appId)){linked.add(appId);continue;}
      if(appId&&item.provenance?.templateUuid&&templates.has(item.provenance.templateUuid))continue;
      if(!ids.has(item.id)){extra.push(convert(item));ids.add(item.id);}
    }
    for(const skill of base)skill.inCommunity=linked.has(skill.id);
    state.added=extra.length;
    // New community content stays discoverable before the large built-in catalog.
    return extra.concat(base);
  }
  async function sync(force=false){
    if(request)return request;
    if(!force&&attempted&&Date.now()-attempted<60000)return {...state};
    attempted=Date.now();
    request=(async()=>{
      try{
        const data=await read(endpoint+(force?'?refresh=1':''));
        if(data.schemaVersion!==1||!Array.isArray(data.skills)||data.skills.some(s=>!s||!/^((community|app)-)[a-z0-9_-]{1,100}$/i.test(s.id)||!s.name||!s.contentHash||!s.fileCount))throw Error('社区目录格式不正确');
        catalog=data.skills;
        const current=new Map(catalog.map(s=>[s.id,s.contentHash]));
        for(const [id,skill] of objects)if(current.get(id)!==skill.communityHash)objects.delete(id);
        state={...state,count:catalog.length,syncedAt:data.syncedAt,stale:!!data.stale,error:data.stale?'社区暂时无法连接，显示上次同步目录':''};
      }catch(error){state={...state,stale:true,error:error.message||'社区暂时无法连接，本地技能仍可使用'};}
      return {...state};
    })().finally(()=>{request=null;});
    return request;
  }
  async function load(skill){
    if(!skill?.communityId)return skill;
    if(!pending.has(skill.id))pending.set(skill.id,(async()=>{
      const {skill:body}=await read(endpoint+'/'+encodeURIComponent(skill.communityId));
      if(!body||body.id!==skill.communityId||!Array.isArray(body.files)||!body.files.length||
        !body.files.every(f=>typeof f.path==='string'&&typeof f.content==='string'&&f.content.trim())||
        !body.files.some(f=>f.path===body.primarySkillFilePath))throw Error('社区技能文件不完整，请重新同步');
      skill.details={...metadata(body),files:body.files};
      skill.title=body.name;skill.desc=text(body.description);skill.communityHash=body.contentHash;
      const entry=catalog.find(s=>s.id===body.id);
      if(entry){const {files,...current}=body;Object.assign(entry,current,{fileCount:files.length});}
      objects.set(skill.id,skill);
      skill.prompt='在 CanvasFlow 中使用此技能，按实际可用工具执行；缺少的能力、素材和引用文件需要明确说明。\n\n'+body.files.map(f=>`文件：${f.path}\n${f.content}`).join('\n\n');
      skill.documentsLoaded=true;
      return skill;
    })().finally(()=>pending.delete(skill.id)));
    return pending.get(skill.id);
  }
  window.CanvasFlowCommunitySkills={sync,merge,load,status:()=>({...state})};
})();
