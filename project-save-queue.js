/* One pending snapshot per project; a conflict never overwrites another editor. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasFlowProjectSaveQueue=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function create({send,onConflict=()=>{},onSaved=()=>{}}){
 const records=new Map();
 const record=id=>{if(!records.has(id))records.set(id,{revision:0,blocked:false,running:false,pending:null,waiters:[]});return records.get(id);};
 async function drain(id,row){
  if(row.running)return;row.running=true;
  try{
   while(row.pending&&!row.blocked){
    const payload=row.pending,waiters=row.waiters;row.pending=null;row.waiters=[];
    payload.revision=Math.max(Number(payload.revision)||0,row.revision);
    try{
     const result=await send(id,payload);
     if(result?.project?.revision){row.revision=Number(result.project.revision);onSaved(id,result,payload);}
     waiters.forEach(resolve=>resolve(result));
    }catch(error){
     if(error?.status===409){row.blocked=true;onConflict(id,error,payload);row.pending=null;row.waiters.splice(0).forEach(resolve=>resolve(null));}
     waiters.forEach(resolve=>resolve(null));
    }
   }
  }finally{row.running=false;}
 }
 return{
  enqueue(id,payload){const row=record(id);if(row.blocked)return Promise.resolve(null);row.pending=JSON.parse(JSON.stringify(payload));const done=new Promise(resolve=>row.waiters.push(resolve));void drain(id,row);return done;},
  reset(id,revision){const row=record(id);if(row.running)return false;row.blocked=false;row.revision=Number(revision)||0;return true;},
  discard(id){const row=record(id);row.blocked=true;row.pending=null;row.waiters.splice(0).forEach(resolve=>resolve(null));},
  blocked:id=>record(id).blocked
 };
}
return{create};
});
