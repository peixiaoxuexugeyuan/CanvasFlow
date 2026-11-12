/* Image history shared by the canvas adapter and the director picker. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(typeof window==='object'||typeof module!=='object'||!module.exports)root.DirectorHistory=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const imageSource=value=>typeof value==='string'&&/^(data:image\/|https?:\/\/|\/(?!\/)|blob:)/i.test(value)?value:'';
const time=value=>typeof value==='number'?value:(Date.parse(value)||0);
function merge(items){
 const bySource=new Map();
 for(const item of items){const data=imageSource(item.data);if(!data)continue;const previous=bySource.get(data);
  if(previous){previous.projectIds=[...new Set([...previous.projectIds,...(item.projectIds||[])])];previous.createdAt=Math.max(previous.createdAt,time(item.createdAt));continue;}
  bySource.set(data,{...item,id:item.id||data,data,projectIds:[...new Set(item.projectIds||[])],createdAt:time(item.createdAt),rating:Math.max(0,Math.min(5,Number(item.rating)||0))});
 }
 return [...bySource.values()];
}
function collect({projects=[],assets=[],jobs=[],currentProjectId='',currentNodes}={}){
 const items=[],assetById=new Map(assets.filter(a=>a.kind==='image').map(a=>[a.id,a]));
 const assetSource=a=>imageSource(a?.url||a?.mediaUrl)||(a?.mediaId?'/media/'+encodeURIComponent(a.mediaId):imageSource(a?.data));
 const addAsset=(id,projectId,node,date)=>{const a=assetById.get(id);if(!a)return;items.push({id:'asset:'+id,data:assetSource(a),name:a.name||node?.previewName||'历史图片',projectIds:projectId?[projectId]:[],rating:node?.rating??a.rating,createdAt:a.createdAt||date});};
 const allProjects=projects.map(p=>p.id===currentProjectId&&currentNodes?{...p,nodes:currentNodes}:p);
 if(currentNodes&&!allProjects.some(p=>p.id===currentProjectId))allProjects.unshift({id:currentProjectId,nodes:currentNodes});
 allProjects.sort((a,b)=>Number(b.id===currentProjectId)-Number(a.id===currentProjectId));
 for(const p of allProjects)for(const n of p.nodes||[]){
  if(n.videoUrl||n.type==='audio')continue;
  const date=n.createdAt||p.updatedAt||p.createdAt;
  if(n.previewAsset)addAsset(n.previewAsset,p.id,n,date);
  if(n.fileAsset)addAsset(n.fileAsset,p.id,n,date);
  const data=imageSource(n.previewMedia||n.previewData);if(data&&!/\.(mp4|webm|mp3|wav)(\?|$)/i.test(data))items.push({id:'node:'+p.id+':'+n.id,data,name:n.previewName||n.title||'历史图片',projectIds:[p.id],rating:n.rating,createdAt:date});
  let history=n.imageHistory||[];if(typeof history==='string'){try{history=JSON.parse(history);}catch{history=[];}}
  for(const id of Array.isArray(history)?history:[])addAsset(id,p.id,null,date);
  if(n.directorProject){try{const sc=JSON.parse(n.directorProject).scene||{};for(const h of sc.panoramaHistory||[])items.push({id:'pano:'+p.id+':'+n.id+':'+h.ts,data:h.data,name:h.name||'全景图',projectIds:[p.id],rating:h.rating,createdAt:h.ts});const current=sc.panoramaData||sc.panoramaUrl;if(current&&!(sc.panoramaHistory||[]).some(h=>h.data===current))items.push({id:'pano:'+p.id+':'+n.id,data:current,name:sc.panoramaName||'全景图',projectIds:[p.id],createdAt:date});}catch{}}
 }
 for(const job of jobs){if(job.kind!=='image'||job.status!=='completed')continue;items.push({id:'job:'+job.id,data:job.imageUrl||job.imageData,name:job.name||job.prompt||'生成图片',projectIds:job.projectId?[job.projectId]:[],rating:job.rating,createdAt:job.createdAt});}
 for(const a of assetById.values())items.push({id:'asset:'+a.id,data:assetSource(a),name:a.name||'历史图片',projectIds:a.projectId?[a.projectId]:[],rating:a.rating,createdAt:a.createdAt});
 return merge(items);
}
function filter(items,{scope='all',projectId='',rating='all',order='desc'}={}){
 return items.filter(h=>(scope==='all'||h.projectIds.includes(projectId))&&(rating==='all'||h.rating===Number(rating))).slice().sort((a,b)=>(order==='asc'?1:-1)*(a.createdAt-b.createdAt)||a.id.localeCompare(b.id));
}
return{collect,merge,filter};
});
