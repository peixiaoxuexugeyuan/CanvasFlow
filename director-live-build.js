/* User-invoked, local scene-tool session. Does not run on ordinary project visits. */
(() => {
  const params=new URLSearchParams(location.search);
  if(params.get('forestPreview')!=='1')return;
  const SESSION='forest-walk-20261013',projectId=params.get('project'),path='assets3d/';
  if(!projectId)return;
  let stopped=false,paused=false;
  const showPlayback=()=>{const toggle=document.querySelector('#directorDeskModal [data-pv-timeline]');if(toggle?.getAttribute('aria-label')==='打开时间轴')toggle.click();};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function ready(test,timeout=90000){const start=Date.now();while(!test()){if(Date.now()-start>timeout)throw Error('预演台尚未加载，请刷新后重新打开');await wait(250);}}
  async function main(){
    await ready(()=>window.CanvasFlowDirector&&document.querySelector('.flow-node[data-node="director"]')&&document.querySelector('#authGate')?.hidden);
    const node=document.querySelector('.flow-node[data-node="director"]');
    const response=await fetch('/api/projects/'+encodeURIComponent(projectId),{cache:'no-store'});
    if(!response.ok)throw Error('当前账户无法编辑这个场景项目');
    const saved=await response.json();
    if(!saved.project?.nodes?.some(n=>n.type==='director'&&n.id===node.dataset.nodeId))throw Error('当前画布已切换，停止搭建');
    const director=window.CanvasFlowDirector;
    if(!director.sceneStatus().open)await director.open(node);
    await ready(()=>director.sceneStatus().ready);
    const initial=director.sceneStatus(),epoch=initial.epoch,scene=initial.project;
    window.CanvasFlowDirectorRenameProject?.('林间小路 · 回头与同向跟移');
    if(scene.forestBuild?.session===SESSION&&scene.forestBuild.stage===6){
      if(scene.forestBuild.version!==3){
        const plans=await(await fetch(path+'forest-building-plans.json?t='+Date.now(),{cache:'no-store'})).json();
        await window.CanvasFlowDirector.applyCommands({operations:[{op:'environment',whitebox:false,showGround:false,gridOpacity:0,groundOpacity:0,showLabels:false},...plans.find(p=>p.number===4).operations.filter(o=>o.op==='motion'),{op:'update',id:'forest-camera',fov:42},...plans.find(p=>p.number===6).operations.filter(o=>o.op==='keyframes')],message:'回头与跟移已同步，可打开时间轴播放验收'},{view:'film'});
        director.saveBuildMetadata({...scene.forestBuild,version:3},epoch);
      }
      window.CanvasFlowDirector.viewPrevis();showPlayback();return;
    }
    const bar=document.createElement('aside');bar.className='forest-build-progress';bar.setAttribute('aria-label','场景助手搭建进度');
    bar.style.cssText='position:absolute;top:60px;left:50%;transform:translateX(-50%);z-index:50;border:1px solid #3a5662;border-radius:10px;background:#111a22ee;color:#d9edf2;padding:10px 15px;max-width:620px;font:13px system-ui;display:flex;align-items:center;gap:12px';
    bar.innerHTML='<span role="status">场景助手：准备搭建林间小路</span><button type="button" style="padding:6px 10px;border:1px solid #45616d;background:#253641;color:#e4f4fb;border-radius:6px">暂停搭建</button>';
    document.querySelector('#directorDeskModal').appendChild(bar);bar.querySelector('button').onclick=()=>{paused=!paused;bar.querySelector('button').textContent=paused?'继续搭建':'暂停搭建';};
    const status=bar.querySelector('[role=status]');
    const check=()=>{const current=director.sceneStatus();if(stopped||!current.open||!current.ready||current.epoch!==epoch)throw Error('预演台已切换，停止搭建');};
    const plans=await(await fetch(path+'forest-building-plans.json?t='+Date.now(),{cache:'no-store'})).json();
    const start=scene.forestBuild?.session===SESSION?scene.forestBuild.stage:0;
    for(const step of plans){
      if(step.number<=start)continue;check();while(paused){await wait(250);check();}
      let operations=step.operations;
      if(step.number===1)operations=[...director.sceneStatus().project.objects.map(o=>({op:'remove',id:o.id})),{op:'environment',whitebox:true,background:'#b7c9c4',groundHeight:0,showGround:false,gridOpacity:0,groundOpacity:0,showLabels:false}];
      status.textContent='第 '+step.number+' / 6 步：'+step.message;
      await window.CanvasFlowDirector.applyCommands({operations,message:step.message},{message:step.message,view:step.number===6?'film':'scene',prompt:step.number===1?'在这个预演台中搭建：主角沿林间小路行走，第 4 秒突然回头，机位起初正对主角，并在回头时与主角等速同向移动。':''});
      director.saveBuildMetadata({session:SESSION,stage:step.number,version:3},epoch);
      document.dispatchEvent(new CustomEvent('forest-build-stage',{detail:{stage:step.number,objects:director.sceneStatus().project.objects.length}}));
      await wait(6000);
    }
    check();
    showPlayback();
    director.saveBuildMetadata(null,epoch,plans.flatMap(p=>p.operations).length);
    status.textContent='搭建完成 · 第 4 秒回头与机位跟移同步 · 可打开时间轴播放验收';bar.querySelector('button').textContent='收起提示';bar.querySelector('button').onclick=()=>bar.remove();
  }
  main().catch(error=>{console.error('[forest-build]',error);const status=document.querySelector('.forest-build-progress [role=status]');if(status)status.textContent=error.message;});
})();
