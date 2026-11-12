/* Small, data-only boundary for AI scene edits and persistent image jobs. */
(function(root){
  'use strict';
  const finite=(value,fallback=0,min=-100,max=100)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
  function vector(value,fallback,min,max){return fallback.map((n,i)=>finite(value?.[i],n,min,max));}
  function scenePlan(text){
    const raw=typeof text==='string'?JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')):text;
    if(!raw||!Array.isArray(raw.objects)||!raw.objects.length||raw.objects.length>30)throw Error('模型未返回有效场景，请补充描述后重试');
    const objects=raw.objects.map(item=>{
      if(!item||!['character','camera','geometry'].includes(item.kind))throw Error('场景包含不支持的对象');
      const row={kind:item.kind,name:String(item.name||'').slice(0,40),position:vector(item.position,[0,0,0],-100,100),rotation:vector(item.rotation,[0,0,0],-360,360),scale:vector(item.scale,[1,1,1],.05,20)};
      row.operation=item.operation==='update'?'update':'add';
      row.id=typeof item.id==='string'?item.id.slice(0,120):'';
      row.provided=['name','position','rotation','scale','color','bodyType','type','pose','target','fov'].filter(key=>Object.hasOwn(item,key));
      if(row.operation==='update'&&!row.id)throw Error('场景修改缺少对象标识');
      if(/^#[0-9a-f]{6}$/i.test(item.color||''))row.color=item.color;
      if(item.kind==='character'){
        row.bodyType=['sam','female','muscular','slim','broad','child','teen','chibi'].includes(item.bodyType)?item.bodyType:'sam';
        row.pose=['站立','思考','单膝跪','双膝跪','招手','伸手'].includes(item.pose)?item.pose:'站立';
      }
      if(item.kind==='geometry')row.type=['box','sphere','cylinder','torus','cone','pyramid'].includes(item.type)?item.type:'box';
      if(item.kind==='camera'){row.target=vector(item.target,[0,1.2,0],-100,100);row.fov=finite(item.fov,50,10,100);}
      return row;
    });
    return {objects,message:String(raw.message||'场景已搭建').slice(0,180)};
  }
  async function watchJob(id,read,{onProgress=()=>{},delay=ms=>new Promise(r=>setTimeout(r,ms)),interval=1500,attempts=1200}={}){
    let failures=0;
    for(let i=0;i<attempts;i++){
      let job;
      try{job=await read(id);failures=0;}catch(e){if(++failures>=5)throw e;await delay(interval);continue;}
      onProgress(job);
      if(job?.status==='completed'){if(!job.imageUrl)throw Error('生成完成但没有返回图片');return job;}
      if(['failed','cancelled'].includes(job?.status))throw Error(job.error||'全景图生成失败');
      await delay(interval);
    }
    throw Error('等待超时，任务仍可在历史记录中查看');
  }
  const api={scenePlan,watchJob};if(typeof module==='object'&&module.exports)module.exports=api;root.DirectorTools=api;
})(typeof window==='object'?window:globalThis);
