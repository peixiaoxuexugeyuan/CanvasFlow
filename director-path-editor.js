/* Editable path anchors and cubic tangents share the playback geometry. */
(function(root){
'use strict';
function create(h){
 const {S,TransformControls}=h,T=S.three,A=root.DirectorAnimation,canvas=S.renderer.domElement;
 const layer=document.createElement('div');layer.className='dt-path-overlay';layer.hidden=true;layer.innerHTML='<svg aria-hidden="true"><path/></svg>';S.el.holder.parentElement.appendChild(layer);
 const proxy=new T.Object3D();proxy.userData.directorHelper=true;S.envRoot.add(proxy);
 const gizmo=new TransformControls(S.camera,canvas);gizmo.userData.directorHelper=true;gizmo.setMode('translate');gizmo.setSpace('local');gizmo.setSize(.65);S.scene.add(gizmo);
 let selected=null,part='point',owner='',signature='',drag=null,navigation=null,cleanup=null;
 const object=()=>S.project?.objects.find(o=>o.id===S.selectedId),path=()=>h.trackOf(S.selectedId)?.path;
 const active=()=>{const o=object();return S.open&&!S.recording&&!S.playing&&S.navigationMode!=='orbit'&&S.viewMode==='director'&&!h.isDrawing()&&h.visible(o?.id)&&!!path()&&(o?.kind==='camera'||S.charTab==='path');};
 const writable=()=>!h.locked(S.selectedId)&&!h.trackOf(S.selectedId)?.locked;
 const parent=()=>S.sceneObjects.get(S.selectedId)?.parent||S.envRoot;
 const pause=()=>{if(navigation===null){navigation=S.controls.enabled;S.controls.enabled=false;}S.keyNudges?.clear();};
 const resume=()=>{if(navigation!==null){S.controls.enabled=navigation&&S.open&&S.viewMode==='director';navigation=null;}};
 function finish(){cleanup?.();cleanup=null;if(drag){drag=null;gizmo.dragging=false;h.endBatch();h.persist();h.renderInspector();}resume();}
 function clear(){finish();selected=null;part='point';gizmo.detach();signature='';}
 const localToWorld=p=>parent().localToWorld(new T.Vector3(...p));
 const pointPosition=(p,index,key)=>A.pathToWorld(p,p.anchors[index][key]);
 function move(value){if(!drag||!writable())return;A.editPathAnchor(path(),selected,part,value);h.commitPath();}
 function choose(index,key){if(!active()||!writable())return;finish();selected=index;part=key;h.setPlaying(false);signature='';h.renderInspector();update();}
 function ground(e,at){const r=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),S.camera);parent().updateWorldMatrix(true,false);ray.ray.applyMatrix4(parent().matrixWorld.clone().invert());const p=new T.Vector3();return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-at[1]),p)?p.toArray():null;}
 layer.addEventListener('pointerdown',e=>{
  const btn=e.target.closest('[data-path-anchor]');if(!btn||e.button!==0)return;e.preventDefault();e.stopPropagation();choose(Number(btn.dataset.pathAnchor),btn.dataset.pathPart);if(!writable())return;
  const p=path(),initial=pointPosition(p,selected,part),hit=ground(e,initial);if(!hit)return;let moved=false;const x=e.clientX,y=e.clientY,id=e.pointerId;try{canvas.setPointerCapture?.(id);}catch{}
  const onMove=ev=>{if(ev.pointerId!==id)return;if(!active()){finish();return;}if(!moved&&Math.hypot(ev.clientX-x,ev.clientY-y)<3)return;const q=ground(ev,initial);if(!q)return;if(!moved){moved=true;h.beginBatch();h.pushUndo();drag={kind:'point'};pause();}move(q.map((v,i)=>v+initial[i]-hit[i]));};
  const onEnd=ev=>{if(ev.pointerId!==id)return;finish();};window.addEventListener('pointermove',onMove,true);window.addEventListener('pointerup',onEnd,true);window.addEventListener('pointercancel',onEnd,true);
  cleanup=()=>{window.removeEventListener('pointermove',onMove,true);window.removeEventListener('pointerup',onEnd,true);window.removeEventListener('pointercancel',onEnd,true);try{canvas.releasePointerCapture?.(id);}catch{}};
 });
 layer.addEventListener('keydown',e=>{const b=e.target.closest('[data-path-anchor]');if(!b)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();choose(Number(b.dataset.pathAnchor),b.dataset.pathPart);return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();choose(Number(b.dataset.pathAnchor),b.dataset.pathPart);h.pushUndo();const v=pointPosition(path(),selected,part),axis=['ArrowLeft','ArrowRight'].includes(e.key)?0:2;v[axis]+=(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)*(e.shiftKey?.01:.1);A.editPathAnchor(path(),selected,part,v);h.commitPath();}});
 const capture=e=>{if(e.button!==0||!active()||!writable()||!gizmo.object)return;const r=canvas.getBoundingClientRect();gizmo.updateMatrixWorld(true);gizmo.pointerHover({x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2,button:e.button});if(gizmo.axis!==null)pause();};
 canvas.addEventListener('pointerdown',capture,true);
 gizmo.addEventListener('mouseDown',()=>{if(!active()||!writable()||selected===null){gizmo.dragging=false;resume();return;}h.beginBatch();h.pushUndo();drag={kind:'gizmo'};pause();});
 gizmo.addEventListener('objectChange',()=>{if(drag?.kind==='gizmo'&&gizmo.dragging)move(proxy.position.toArray());});gizmo.addEventListener('mouseUp',finish);
 const release=()=>{if(!gizmo.dragging&&!drag)resume();};window.addEventListener('pointerup',release,true);window.addEventListener('blur',finish);
 const cancel=e=>{if(e.key==='Escape'||(e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase()))finish();};document.addEventListener('keydown',cancel,true);
 function update(){
  if(!active()){layer.hidden=true;if(drag)finish();gizmo.detach();return;}
  const p=A.upgradePath(path());if(owner!==S.selectedId){clear();owner=S.selectedId;}if(selected!==null&&!p.anchors[selected])clear();
  const closed=['circle','rectangle'].includes(p.type),anchors=p.anchors.slice(0,closed?-1:undefined),key=owner+':'+anchors.length+':'+selected+':'+part+':'+anchors.map(a=>!!a.in+','+!!a.out).join(';');
  if(signature!==key){signature=key;layer.querySelectorAll('button').forEach(b=>b.remove());for(let i=0;i<anchors.length;i++)for(const k of ['point',...(i===selected?['in','out'].filter(k=>anchors[i][k]):[])]){const b=document.createElement('button');b.type='button';b.className='dt-path-point'+(k==='point'?'':' is-tangent');b.dataset.pathAnchor=i;b.dataset.pathPart=k;b.setAttribute('aria-label',k==='point'?`路径锚点 ${i+1}`:`路径锚点 ${i+1} ${k==='in'?'入':'出'}手柄`);b.title=k==='point'?'拖动锚点；点击后使用三轴移动工具':'拖动曲线手柄';layer.appendChild(b);}}
  parent().updateWorldMatrix(true,false);S.camera.updateMatrixWorld(true);layer.hidden=false;const w=S.el.holder.clientWidth,ht=S.el.holder.clientHeight,segments=[];
  const project=v=>{const p=v.project(S.camera);return {x:(p.x+1)*w/2,y:(1-p.y)*ht/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1};};
  for(const b of layer.querySelectorAll('button')){const i=Number(b.dataset.pathAnchor),k=b.dataset.pathPart,v=project(localToWorld(pointPosition(p,i,k)));b.hidden=!v.visible;b.disabled=!writable();b.style.left=v.x+'px';b.style.top=v.y+'px';b.classList.toggle('is-selected',i===selected&&k===part);b.setAttribute('aria-pressed',String(i===selected&&k===part));if(k!=='point'){const a=project(localToWorld(pointPosition(p,i,'point')));segments.push(`M${a.x},${a.y}L${v.x},${v.y}`);}}
  layer.querySelector('path').setAttribute('d',segments.join(' '));
  if(selected!==null&&writable()){
   if(proxy.parent!==parent())parent().add(proxy);if(!drag){proxy.position.fromArray(pointPosition(p,selected,part));proxy.rotation.set(0,0,0);proxy.scale.set(1,1,1);proxy.updateMatrixWorld(true);}if(gizmo.object!==proxy)gizmo.attach(proxy);gizmo.enabled=true;
  }else gizmo.detach();
 }
 return {gizmo,update,active,clear,selectedAnchor:()=>owner===S.selectedId?selected:null,escape(){if(selected===null)return false;clear();h.renderInspector();return true;},dispose(){clear();canvas.removeEventListener('pointerdown',capture,true);window.removeEventListener('pointerup',release,true);window.removeEventListener('blur',finish);document.removeEventListener('keydown',cancel,true);gizmo.detach();gizmo.dispose();gizmo.parent?.remove(gizmo);proxy.parent?.remove(proxy);layer.remove();}};
}
root.DirectorPathEditor={create};
})(window);
