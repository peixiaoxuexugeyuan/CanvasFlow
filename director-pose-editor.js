/* Joint handles edit semantic pose angles, independently of a model's bind axes. */
(function(root){
'use strict';
const JOINTS=[['body','身体'],['torso','躯干'],['head','头部'],['leftShoulder','左肩'],['rightShoulder','右肩'],['leftElbow','左肘'],['rightElbow','右肘'],['leftHip','左髋'],['rightHip','右髋'],['leftKnee','左膝'],['rightKnee','右膝']];
const LINKS=[['body','torso'],['torso','head'],['torso','leftShoulder'],['torso','rightShoulder'],['leftShoulder','leftElbow'],['rightShoulder','rightElbow'],['body','leftHip'],['body','rightHip'],['leftHip','leftKnee'],['rightHip','rightKnee']];
function axes(joint){
 if(joint==='head'||joint==='body'||joint==='torso')return {order:'YXZ',keys:['pitch','yaw','roll'],signs:[1,1,1]};
 if(joint.endsWith('Elbow'))return {order:'XYZ',keys:['bend'],signs:[-1]};
 if(joint.endsWith('Knee'))return {order:'XYZ',keys:['bend'],signs:[1]};
 const left=joint.startsWith('left');return {order:'ZXY',keys:['pitch','twist','spread'],signs:[-1,left?1:-1,left?-1:1]};
}
function poseEuler(T,joint,controls={}){
 const a=axes(joint),values=a.keys.map((key,i)=>(Number(controls[joint+'.'+key])||0)*a.signs[i]*Math.PI/180);
 return new T.Euler(values[0]||0,values[1]||0,values[2]||0,a.order);
}
function controlsFromEuler(joint,rotation,previous={},limits){
 const a=axes(joint),old=a.keys.map((key,i)=>(Number(previous[joint+'.'+key])||0)*a.signs[i]),raw=[rotation.x,rotation.y,rotation.z].map(v=>v*180/Math.PI);
 // At a gimbal singularity, preserve the nearest combination of twist and spread.
 if(a.order!=='XYZ'&&Math.abs(Math.cos(rotation.x))<.0005){
  const sign=Math.sign(raw[0]),wrap=v=>v-360*Math.round(v/360);
  if(a.order==='ZXY'){const delta=wrap(raw[2]-((old[2]||0)+sign*(old[1]||0)));raw[1]=(old[1]||0)+sign*delta/2;raw[2]=(old[2]||0)+delta/2;}
  else {const delta=wrap(raw[1]-((old[1]||0)-sign*(old[2]||0)));raw[1]=(old[1]||0)+delta/2;raw[2]=(old[2]||0)-sign*delta/2;}
 }
 // Equivalent Euler branches prevent a raised arm from jumping at 90 degrees.
 const candidates=[raw];if(a.order!=='XYZ')candidates.push([180-raw[0],raw[1]+180,raw[2]+180]);
 const near=candidates.map(v=>v.map((angle,i)=>angle+360*Math.round(((old[i]||0)-angle)/360)));
 near.sort((x,y)=>x.reduce((n,v,i)=>n+(v-(old[i]||0))**2,0)-y.reduce((n,v,i)=>n+(v-(old[i]||0))**2,0));
 return Object.fromEntries(a.keys.map((key,i)=>{const name=joint+'.'+key,[min,max]=limits[name];return[name,Math.round(Math.max(min,Math.min(max,near[0][i]*a.signs[i]))*10)/10||0];}));
}
function create(h){
 const {S,TransformControls,limits}=h,T=S.three,canvas=S.renderer.domElement;
 const layer=document.createElement('div');layer.className='dt-pose-overlay';layer.hidden=true;
 layer.innerHTML='<svg class="dt-pose-lines" aria-hidden="true"><path class="dt-pose-ground-ring"/></svg>'+JOINTS.map(([key,label])=>`<button type="button" class="dt-pose-point" data-pose-joint="${key}" aria-label="${label}骨骼控制点" aria-pressed="false" title="${label}：点击后拖动旋转环调整姿势"></button>`).join('');
 S.el.holder.parentElement.appendChild(layer);
 const overlay=new T.Group();overlay.name='dt-pose-bones';overlay.userData.directorHelper=true;S.envRoot.add(overlay);
 const sphere=new T.SphereGeometry(.05,18,12),dotMaterial=new T.MeshBasicMaterial({color:0x5fe8ff,transparent:true,opacity:.92,depthTest:false,depthWrite:false}),selectedMaterial=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1,depthTest:false,depthWrite:false});
 const lineMaterial=new T.LineBasicMaterial({color:0x5fe8ff,transparent:true,opacity:.52,depthTest:false,depthWrite:false});
 const dots=new Map(JOINTS.map(([key])=>{const dot=new T.Mesh(sphere,dotMaterial);dot.renderOrder=60;dot.userData.directorHelper=true;overlay.add(dot);return[key,dot];}));
 const lines=LINKS.map(([a,b])=>{const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),lineMaterial);line.renderOrder=55;line.userData.directorHelper=true;overlay.add(line);return{a,b,line};});
 const proxy=new T.Object3D();proxy.name='dt-pose-rotation-proxy';proxy.userData.directorHelper=true;S.envRoot.add(proxy);
 const gizmo=new TransformControls(S.camera,canvas);gizmo.name='dt-pose-rotation-rings';gizmo.userData.directorHelper=true;gizmo.setMode('rotate');gizmo.setSpace('local');gizmo.setSize(.62);S.scene.add(gizmo);
 let selected='',owner='',drag=null,navigationBefore=null,wasActive=false;
 const object=()=>S.project?.objects.find(o=>o.id===S.selectedId&&o.kind==='character');
 const active=()=>{const o=object();return S.open&&S.charTab==='pose'&&S.viewMode==='director'&&!S.recording&&!!S.rigs.get(o?.id)?.body&&h.visible(o.id);};
 const writable=o=>o&&!h.locked(o.id)&&!h.trackLocked(o.id);
 const pauseNavigation=()=>{if(navigationBefore===null){navigationBefore=S.controls.enabled;S.controls.enabled=false;}};
 const resumeNavigation=()=>{if(navigationBefore!==null){S.controls.enabled=navigationBefore&&S.open&&S.viewMode==='director';navigationBefore=null;}};
 const finish=()=>{if(drag){drag=null;gizmo.dragging=false;h.endBatch();h.persist();}resumeNavigation();};
 const clear=()=>{finish();selected='';gizmo.detach();};
 const pointer=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2,button:e.button};};
 // Capture runs before CameraControls' pointer listener; disabling it on mouseDown is too late.
 const capturePointer=e=>{if(e.button!==0||!active()||!writable(object())||!gizmo.object)return;gizmo.updateMatrixWorld(true);gizmo.pointerHover(pointer(e));if(gizmo.axis!==null)pauseNavigation();};
 const captureWheel=e=>{if(drag||gizmo.dragging){e.preventDefault();e.stopImmediatePropagation();}};
 const releasePointer=()=>{if(!gizmo.dragging)resumeNavigation();};
 canvas.addEventListener('pointerdown',capturePointer,true);canvas.addEventListener('wheel',captureWheel,{capture:true,passive:false});window.addEventListener('pointerup',releasePointer,true);
 layer.addEventListener('click',e=>{const btn=e.target.closest('[data-pose-joint]');if(!btn)return;const o=object();if(!active()||!writable(o))return;finish();selected=btn.dataset.poseJoint;owner=o.id;h.setPlaying(false);update();const group=S.el.inspector.querySelector(`[data-dt-paxis^="${selected}."]`)?.closest('.dt-paxis-group');S.el.inspector.querySelectorAll('.is-selected-joint').forEach(el=>el.classList.remove('is-selected-joint'));group?.classList.add('is-selected-joint');group?.scrollIntoView({block:'nearest'});});
 layer.addEventListener('keydown',e=>{const btn=e.target.closest('[data-pose-joint]');if(!btn)return;if([' ','Enter'].includes(e.key))e.stopPropagation();if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const o=object();if(!writable(o))return;const key=Object.keys(limits).find(k=>k.startsWith(btn.dataset.poseJoint+'.'));const v=(Number(o.poseControls?.[key])||0)+(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*(e.shiftKey ? .1 : 1);h.pushUndo();h.changePose(o,{[key]:Math.max(limits[key][0],Math.min(limits[key][1],v))});h.persist();});
 gizmo.addEventListener('mouseDown',()=>{
  const o=object();if(!active()||!writable(o)||!selected){gizmo.dragging=false;resumeNavigation();return;}
  h.setPlaying(false);h.beginBatch();h.pushUndo();drag={obj:o,rig:S.rigs.get(o.id),joint:selected};pauseNavigation();S.keyNudges.clear();
 });
 gizmo.addEventListener('objectChange',()=>{
  if(!drag||!gizmo.dragging)return;
  if(object()!==drag.obj||S.rigs.get(drag.obj.id)!==drag.rig||!writable(drag.obj)){finish();return;}
  h.changePose(drag.obj,controlsFromEuler(drag.joint,proxy.rotation,drag.obj.poseControls||{},limits));
 });
 gizmo.addEventListener('mouseUp',finish);
 const cancel=e=>{if(e.type==='keydown'&&!(e.key==='Escape'||(e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())))return;finish();};
 window.addEventListener('blur',cancel);window.addEventListener('pointercancel',cancel);document.addEventListener('keydown',cancel,true);
 function update(){
  if(!active()){wasActive=false;layer.hidden=true;overlay.visible=false;if(selected||drag)clear();gizmo.detach();return;}
  const o=object(),rig=S.rigs.get(o.id);if(owner!==o.id){clear();owner=o.id;wasActive=false;}
  if(!wasActive&&S.controls){
   const box=window.DirectorGround.bounds(T,rig.actor,S.scene),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
   const direction=S.camera.position.clone().sub(S.controls.getTarget()).normalize();if(direction.lengthSq()<.01)direction.set(0,0,1);
   const distance=Math.max(.5,Math.max(size.y,size.x/Math.max(.1,S.camera.aspect))/(2*Math.tan(S.camera.fov*Math.PI/360)*.65)+size.z*.5),position=center.clone().addScaledVector(direction,distance);
   S.controls.setLookAt(...position.toArray(),...center.toArray(),false);S.controls.update(0);
  }
  wasActive=true;
  layer.hidden=false;overlay.visible=true;rig.actor.updateWorldMatrix(true,true);S.envRoot.updateWorldMatrix(true,false);S.camera.updateMatrixWorld(true);
  const w=S.el.holder.clientWidth,hgt=S.el.holder.clientHeight,world={},local={},rootScale=S.envRoot.getWorldScale(new T.Vector3()),dotScale=Math.max(Math.abs(rootScale.x),Math.abs(rootScale.y),Math.abs(rootScale.z));
  const project=v=>{const p=v.clone().project(S.camera);return{x:(p.x+1)*w/2,y:(1-p.y)*hgt/2,visible:p.z>=-1&&p.z<=1&&p.x>=-1&&p.x<=1&&p.y>=-1&&p.y<=1};};
  for(const [key] of JOINTS){const bone=rig.bones.get(rig.map[key]);if(!bone)continue;world[key]=key==='body'?rig.actor.getWorldPosition(new T.Vector3()):bone.getWorldPosition(new T.Vector3());local[key]=S.envRoot.worldToLocal(world[key].clone());}
  for(const [key] of JOINTS){const btn=layer.querySelector(`[data-pose-joint="${key}"]`),dot=dots.get(key),v=world[key],p=v&&project(v),chosen=key===selected;dot.visible=!!v;if(v)dot.position.copy(local[key]);dot.scale.setScalar(chosen?1.35:1);dot.material=chosen?selectedMaterial:dotMaterial;btn.hidden=!p?.visible;btn.disabled=!writable(o);btn.setAttribute('aria-pressed',String(chosen));if(p){const depth=Math.abs(v.clone().applyMatrix4(S.camera.matrixWorldInverse).z),size=.1*dotScale*(chosen?1.35:1)*hgt*S.camera.zoom/(2*Math.tan(S.camera.fov*Math.PI/360)*Math.max(.01,depth));btn.style.width=btn.style.height=Math.max(10,size)+'px';btn.style.left=p.x+'px';btn.style.top=p.y+'px';}}
  for(const {a,b,line} of lines){line.visible=!!(local[a]&&local[b]);if(line.visible){const p=line.geometry.attributes.position;p.setXYZ(0,...local[a].toArray());p.setXYZ(1,...local[b].toArray());p.needsUpdate=true;line.geometry.computeBoundingSphere();}}
  const ring=layer.querySelector('.dt-pose-ground-ring'),outline=[];let ringVisible=true;
  for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,p=project(new T.Vector3(Math.cos(a)*.5,.005,Math.sin(a)*.5).applyMatrix4(rig.actor.matrixWorld));ringVisible&&=p.visible;outline.push((i?'L':'M')+p.x+','+p.y);}
  ring.setAttribute('d',outline.join(' ')+' Z');ring.style.display=ringVisible?'':'none';
  if(selected&&writable(o)&&world[selected]){
   if(!drag){proxy.position.copy(local[selected]);proxy.rotation.copy(poseEuler(T,selected,o.poseControls));proxy.scale.set(1,1,1);proxy.updateMatrixWorld(true);}
   if(gizmo.object!==proxy)gizmo.attach(proxy);
  }else gizmo.detach();
 }
 function dispose(){clear();canvas.removeEventListener('pointerdown',capturePointer,true);canvas.removeEventListener('wheel',captureWheel,true);window.removeEventListener('pointerup',releasePointer,true);window.removeEventListener('blur',cancel);window.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',cancel,true);gizmo.dispose();gizmo.removeFromParent();proxy.removeFromParent();overlay.removeFromParent();sphere.dispose();dotMaterial.dispose();selectedMaterial.dispose();lineMaterial.dispose();lines.forEach(({line})=>line.geometry.dispose());layer.remove();}
 return{update,dispose,active,escape:()=>{if(!selected)return false;clear();return true;},gizmo,layer};
}
const api={JOINTS,LINKS,poseEuler,controlsFromEuler,create};if(typeof module==='object'&&module.exports)module.exports=api;root.DirectorPoseEditor=api;
})(typeof window==='object'?window:globalThis);
