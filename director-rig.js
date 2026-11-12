/* Character rigs: immutable bind poses, canonical axes, and independent skeleton instances. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(typeof window==='object'||typeof module!=='object'||!module.exports)root.DirectorRig=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const SAM={body:'Hip',torso:'Waist',head:'Head',leftShoulder:'L_Upperarm',rightShoulder:'R_Upperarm',leftElbow:'L_Forearm',rightElbow:'R_Forearm',leftHip:'L_Thigh',rightHip:'R_Thigh',leftKnee:'L_Calf',rightKnee:'R_Calf'};
const UE={body:'pelvis',torso:'spine_01',head:'head',leftShoulder:'upperarm_l',rightShoulder:'upperarm_r',leftElbow:'lowerarm_l',rightElbow:'lowerarm_r',leftHip:'thigh_l',rightHip:'thigh_r',leftKnee:'calf_l',rightKnee:'calf_r'};
// Native FK walk: opposite arm/leg swing, flexed swing knee, trunk counter-turn.
// Reference cadence is 10.5 radians/second; no imported clips or root motion.
function walkControls(seconds,neutral={}){
 const c={...neutral,_rigAxes:3},s=Math.sin(seconds*10.5),lift=(1-Math.cos(seconds*21))*.5;
 const add=(k,v)=>c[k]=(Number(neutral[k])||0)+v;
 add('body.pitch',1.5+1.2*lift);add('body.roll',1.1*s);
 add('torso.yaw',-2.8*s);add('torso.roll',-.8*s);
 add('leftShoulder.pitch',20*s);add('rightShoulder.pitch',-20*s);
 add('leftElbow.bend',8+5*Math.max(0,s));add('rightElbow.bend',8+5*Math.max(0,-s));
 add('leftHip.pitch',-24*s);add('rightHip.pitch',24*s);
 add('leftKnee.bend',24*Math.max(0,-s)+4*lift);add('rightKnee.bend',24*Math.max(0,s)+4*lift);
 return c;
}
function update(root){root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
function runControls(seconds,neutral={}){
 const c=walkControls(seconds*1.35,neutral),s=Math.sin(seconds*14.175),lift=(1-Math.cos(seconds*28.35))*.5;
 c['body.pitch']=(neutral['body.pitch']||0)+9;c['torso.pitch']=(neutral['torso.pitch']||0)+5;
 c['leftHip.pitch']=-42*s;c['rightHip.pitch']=42*s;c['leftKnee.bend']=52*Math.max(0,-s)+8*lift;c['rightKnee.bend']=52*Math.max(0,s)+8*lift;
 c['leftShoulder.pitch']=35*s;c['rightShoulder.pitch']=-35*s;c['leftElbow.bend']=65;c['rightElbow.bend']=65;return c;
}
function bounds(T,root){update(root);const box=new T.Box3().makeEmpty(),inv=root.matrixWorld.clone().invert(),p=new T.Vector3(),matrix=new T.Matrix4();root.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;matrix.copy(inv).multiply(o.matrixWorld);for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,p);p.applyMatrix4(matrix);box.expandByPoint(p);}});return box;}
function jointRotation(T,rig,key,c={}){
 const {map,binds}=rig,rest=binds.get(map[key]);if(!rest)return new T.Quaternion();
 const n=k=>Number(c[k])||0,rad=Math.PI/180,rot=(axis,angle)=>new T.Quaternion().setFromAxisAngle(axis,angle*rad);
 const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1),canonical=map===SAM&&c._rigAxes!==2;
 let delta,local=false;
 if(['body','torso','head'].includes(key))delta=rot(Y,n(key+'.yaw')).multiply(rot(X,(key==='body'&&canonical?-1:1)*n(key+'.pitch'))).multiply(rot(Z,n(key+'.roll')));
 else{
  const side=key.startsWith('left')?'left':'right',sign=side==='left'?1:-1;
  if(key.endsWith('Shoulder')||key.endsWith('Hip')){
   if(canonical){delta=rot(Z,sign*n(key+'.spread')).multiply(rot(X,n(key+'.pitch'))).multiply(rot(Y,-sign*n(key+'.twist')));local=true;}
   else{const end=map[side+(key.endsWith('Shoulder')?'Elbow':'Knee')],axis=binds.get(end).worldPos.clone().sub(rest.worldPos).normalize();delta=rot(X,-n(key+'.pitch')).multiply(rot(Z,sign*n(key+'.spread'))).multiply(rot(axis,(key.endsWith('Shoulder')?sign:-sign)*n(key+'.twist')));}
  }else{delta=rot(X,(key.endsWith('Elbow')?(canonical?1:-1):(canonical?-1:1))*n(key+'.bend'));local=canonical;}
 }
 if(!local)delta=rest.world.clone().invert().multiply(delta).multiply(rest.world);
 return rest.quat.clone().multiply(delta);
}
function create(T,actor,visual){
 const bones=new Map(),binds=new Map();update(actor);const invQ=actor.getWorldQuaternion(new T.Quaternion()).invert(),inv=actor.matrixWorld.clone().invert();
 visual.traverse(b=>{if(!b.isBone)return;bones.set(b.name,b);binds.set(b.name,{quat:b.quaternion.clone(),pos:b.position.clone(),scale:b.scale.clone(),world:b.getWorldQuaternion(new T.Quaternion()).premultiply(invQ),worldPos:b.getWorldPosition(new T.Vector3()).applyMatrix4(inv)});});
 const map=bones.has('Hip')&&bones.has('L_Upperarm')?SAM:UE;
 const rig={actor,visual,bones,binds,map,groundOffset:0,body: bones.get(map.body),head:bones.get(map.head),bounds:null};
 rig.reset=()=>{visual.position.y=0;rig.groundOffset=0;for(const[name,b]of bones){const base=binds.get(name);b.quaternion.copy(base.quat);b.position.copy(base.pos);b.scale.copy(base.scale);}update(actor);};
 rig.bounds=()=>bounds(T,actor);
 rig.localRotation=(key,controls)=>jointRotation(T,rig,key,controls);
 rig.ground=()=>{visual.position.y=0;update(actor);const box=bounds(T,actor);if(!box.isEmpty()){visual.position.y=-box.min.y;rig.groundOffset=-box.min.y;}update(actor);};
 rig.apply=controls=>{
  rig.reset();const c=controls||{},n=k=>Number(c[k])||0;
  for(const key of Object.keys(map)){const bone=bones.get(map[key]);if(bone)bone.quaternion.copy(rig.localRotation(key,c));}
  if(c['body.autoGround']!==false)rig.ground();else update(actor);
  visual.position.y+=n('body.offsetY');update(actor);
 };
 actor.userData.rigType=map===SAM?'sam':'ue';return rig;
}
function cloneActor(T,clone,proto,{color='#4f8ef7',local=false,bodyType='sam'}={}){
 const actor=new T.Group(),visual=new T.Group(),model=clone(proto.scene);model.position.set(0,0,0);model.quaternion.identity();model.scale.set(1,1,1);
 visual.name='director-character-visual';visual.rotation.y=!local&&bodyType!=='mannequin'?-Math.PI/2:0;visual.add(model);actor.add(visual);
 model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;if(!local&&o.material){const tint=m=>{const x=m.clone();x.map=null;x.color.set(color);x.roughness=.62;x.metalness=.08;return x;};o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);}}});
 return {actor,rig:create(T,actor,visual)};
}
const AXES_VERSION=3;
function sameControls(a,b){const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);for(const key of keys){if(key.startsWith('_'))continue;if(a?.[key]!==b?.[key])return false;}return true;}
function upgradePoseControls(project,presets,knownLegacy=[]){
 const signatures=[...presets,...knownLegacy];
 for(const obj of project.objects||[]){
  if(obj.kind!=='character'||!obj.poseControls||obj.poseControls._rigAxes!=null)continue;
  const preset=presets.find(p=>p.label===obj.poseName);
  const known=preset&&signatures.some(p=>p.label===obj.poseName&&sameControls(obj.poseControls,p.controls));
  if(known){obj.poseControls={...preset.controls,_rigAxes:AXES_VERSION};}
  else obj.poseControls._rigAxes=2; // Preserve authored/custom old world-axis poses; never guess a preset from its name.
 }
 return project;
}
return {SAM,UE,AXES_VERSION,sameControls,upgradePoseControls,create,cloneActor,bounds,update,jointRotation,walkControls,runControls};
});
