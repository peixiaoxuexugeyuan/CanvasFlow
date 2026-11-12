import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import * as SU from '../vendor/three/addons/utils/SkeletonUtils.js';
import A from '../director-animation.js';
import Rig from '../director-rig.js';
import {loadRig} from './rig-fixture.mjs';
import fs from 'node:fs';
const stand=JSON.parse(fs.readFileSync('director.js','utf8').split('const POSE_PRESETS = ')[1].split(';')[0])[0].controls;
const actor={kind:'character',transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}};
function track(type='line',fps=30,duration=300){const t={channels:{}};A.bakePath(t,A.pathPreset(type,[0,0,0],0,duration/fps,true),fps,duration);return t;}
test('all five path types automatically walk at the reference movement threshold',()=>{
 for(const type of ['line','circle','rectangle','pencil','pen']){
  const t=type==='pencil'||type==='pen'?{channels:{}}:track(type);
  if(!t.path)A.bakePath(t,A.pathFromAnchors(type,[{point:[0,0,0]},{point:[4,0,0]}],10,false),30,300);
  assert.ok(A.samplePathWalk(actor,t,150,30),type);
 }
 const t=track();t.path.origin=[5,2,8];t.path.scale=.01;A.bakePath(t,t.path,30,300);
 assert.equal(A.samplePathWalk(actor,t,150,30),null,'almost static paths must not march');
});
test('walk only applies to moving characters inside enabled path ranges',()=>{
 const t=track();assert.equal(A.samplePathWalk({...actor,kind:'camera'},t,100,30),null);
 t.muted=true;assert.equal(A.samplePathWalk(actor,t,100,30),null);t.muted=false;
 t.path.enabled=false;assert.equal(A.samplePathWalk(actor,t,100,30),null);delete t.path.enabled;
 assert.equal(A.samplePathWalk(actor,t,299,30),null);assert.equal(A.samplePathWalk(actor,t,350,30),null);
 t.path.startFrame=60;t.path.duration=3;A.bakePath(t,t.path,30,300);
 assert.equal(A.samplePathWalk(actor,t,59,30),null);assert.ok(A.samplePathWalk(actor,t,90,30));assert.equal(A.samplePathWalk(actor,t,150,30),null);
 delete t.path;assert.equal(A.samplePathWalk(actor,t,90,30),null);
});
test('zero-length and held path segments stand still; follow checkbox does not disable walking',()=>{
 const t=track();t.path.follow=false;A.bakePath(t,t.path,30,300);assert.ok(A.samplePathWalk(actor,t,90,30));
 for(const k of t.channels['position.z'])k.value=0;
 assert.equal(A.samplePathWalk(actor,t,90,30),null);
 const held=track();for(const k of held.channels['position.z'])k.interp='hold';
 assert.equal(A.samplePathWalk(actor,held,101,30),null);
});
test('stride uses seconds consistently across timeline rates, fractional export, seeking and reopened data',()=>{
 const t=track(),reopened=JSON.parse(JSON.stringify(t)),f=38.25;
 assert.deepEqual(A.samplePathWalk(actor,t,f,30),A.samplePathWalk(actor,reopened,f,30));
 const pose=Rig.walkControls(A.samplePathWalk(actor,t,f,30).seconds,stand);
 assert.deepEqual(pose,Rig.walkControls(A.samplePathWalk(actor,track('line',60,600),f*2,60).seconds,stand));
 const plan=A.exportPlan({fps:30},[0,299],60);
 assert.deepEqual(Rig.walkControls(A.samplePathWalk(actor,t,plan.frameAt(77),30).seconds,stand),Rig.walkControls(38.5/30,stand));
 assert.deepEqual(pose,Rig.walkControls(f/30,stand));
});
const model=await loadRig('assets3d/models/sam-male.glb');
test('actual SAM walk alternates legs and opposite arms, stays grounded and has no root motion',()=>{
 const {actor:mesh,rig}=Rig.cloneActor(T,SU.clone,model,{bodyType:'sam'}),other=Rig.cloneActor(T,SU.clone,model,{bodyType:'sam'});
 mesh.position.set(3,2,-1);mesh.scale.setScalar(.63);
 const root=mesh.position.toArray(),rest=other.rig.bones.get('L_Thigh').quaternion.toArray();
 const foot=(side)=>rig.bones.get(side+'_Foot').getWorldPosition(new T.Vector3());
 rig.apply(Rig.walkControls(Math.PI/2/10.5,stand));const left=foot('L'),right=foot('R');
 assert.ok(left.z<right.z-.1,'one leg strides forward');
 rig.apply(Rig.walkControls(3*Math.PI/2/10.5,stand));assert.ok(foot('R').z<foot('L').z-.1,'the other leg strides forward');
 for(let i=0;i<16;i++){
  const controls=Rig.walkControls(i/16*2*Math.PI/10.5,stand);rig.apply(controls);
  assert.ok(Math.abs(rig.bounds().min.y)<1e-5,'feet remain at actor-local ground');
  assert.ok(controls['leftHip.pitch']*controls['rightHip.pitch']<=0);
  assert.ok((controls['leftShoulder.pitch']-stand['leftShoulder.pitch'])*controls['leftHip.pitch']<=0);
  assert.deepEqual(mesh.position.toArray(),root);
 }
 assert.deepEqual(other.rig.bones.get('L_Thigh').quaternion.toArray(),rest);
 rig.apply({'leftShoulder.spread':60,'leftKnee.bend':30});const saved=rig.bones.get('L_Upperarm').quaternion.toArray();
 rig.apply(Rig.walkControls(.3,stand));rig.apply({'leftShoulder.spread':60,'leftKnee.bend':30});
 assert.deepEqual(rig.bones.get('L_Upperarm').quaternion.toArray(),saved,'authored pose restores exactly');
 assert.equal(stand._rigAxes,undefined,'neutral preset is not mutated');
});
