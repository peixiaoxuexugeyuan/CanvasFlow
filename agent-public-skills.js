/* Local, read-only public Skill bundles. Never execute downloaded documents. */
(() => {
  'use strict';
  const pending=new Map();
  function merge(existing){
    const byTemplate=new Map(existing.filter(s=>s.details?.templateUuid).map(s=>[s.details.templateUuid,s]));
    const extra=[];
    for(const item of window.CanvasFlowPublicSkillCatalog||[]){
      const old=byTemplate.get(item.templateUuid);
      const skill=old||{...item,icon:'wand'};
      if(old)Object.assign(skill,{desc:item.desc,details:item.details,bundleUrl:item.bundleUrl,fileCount:item.fileCount,slug:item.slug});
      skill.prompt='';skill.documentsLoaded=false;skill.tokenName=skill.id;
      if(!old)extra.push(skill);
    }
    return existing.concat(extra);
  }
  async function load(skill){
    if(skill?.communityId)return window.CanvasFlowCommunitySkills.load(skill);
    if(!skill?.bundleUrl||skill.documentsLoaded)return skill;
    if(!pending.has(skill.id))pending.set(skill.id,(async()=>{
      const response=await fetch(skill.bundleUrl);
      if(!response.ok)throw Error('Skill 文件读取失败，请重试');
      const detail=await response.json();
      if(detail.templateUuid!==skill.details.templateUuid||!Array.isArray(detail.files)||detail.files.length!==skill.fileCount||
        !detail.files.every(f=>typeof f.path==='string'&&typeof f.content==='string'&&f.content.length)||
        !detail.files.some(f=>f.path===detail.primarySkillFilePath))throw Error('Skill 文件不完整，请重新加载');
      skill.details=detail;
      skill.prompt='在 CanvasFlow 中使用此技能，按实际可用工具执行；文档中的 LibTV 专属工具不代表当前平台已提供。缺少的能力、素材和引用文件需要明确说明。\n\n'+
        (detail.missingReferences?.length?'原始文档中以下引用路径未匹配到返回文件：'+detail.missingReferences.join('、')+'。仅使用下方实际提供的文件；不要假装已读取缺失内容。\n\n':'')+
        detail.files.map(f=>`文件：${f.path}\n${f.content}`).join('\n\n');
      skill.documentsLoaded=true;return skill;
    })().finally(()=>pending.delete(skill.id)));
    return pending.get(skill.id);
  }
  window.CanvasFlowPublicSkills={merge,load};
})();
