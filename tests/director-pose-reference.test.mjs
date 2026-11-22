import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import * as SU from '../vendor/three/addons/utils/SkeletonUtils.js';
import Rig from '../director-rig.js';
import {loadRig} from './rig-fixture.mjs';
const presets=JSON.parse(fs.readFileSync('director.js','utf8').split('const POSE_PRESETS = ')[1].split(';')[0]);
const src=await loadRig('assets3d/models/sam-male.glb');
const make=()=>Rig.cloneActor(T,SU.clone,src,{bodyType:'sam'});
const position=(rig,name)=>rig.bones.get(name).getWorldPosition(new T.Vector3());
const controls=id=>presets.find(p=>p.id===id).controls;
test('SAM reference shoulder flexion/spread/twist use bind-local axes, not world axes',()=>{
 const {rig}=make();
 for(const side of ['left','right']){
  rig.apply({[side+'Shoulder.pitch']:45,[side+'Shoulder.spread']:30,[side+'Shoulder.twist']:20,'body.autoGround':false});
  const name=rig.map[side+'Shoulder'],rest=rig.binds.get(name),sign=side==='left'?1:-1;
  const q=rest.quat.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(45*Math.PI/180,-sign*20*Math.PI/180,sign*30*Math.PI/180,'ZXY')));
  // GLB float32 bind quaternions can be a few 1e-8 away from unit length.
  // Compare orientations, not the product of their slightly non-unit lengths.
  assert.ok(Math.abs(q.normalize().dot(rig.bones.get(name).quaternion.clone().normalize()))>1-1e-10);
 }
});
test('all twenty shipped preset values match the captured reference controls',()=>{
 const keys=['body.pitch','body.yaw','body.roll','torso.pitch','torso.yaw','torso.roll','head.pitch','head.yaw','head.roll','leftShoulder.pitch','leftShoulder.spread','leftShoulder.twist','rightShoulder.pitch','rightShoulder.spread','rightShoulder.twist','leftElbow.bend','rightElbow.bend','leftHip.pitch','leftHip.spread','leftHip.twist','rightHip.pitch','rightHip.spread','rightHip.twist','leftKnee.bend','rightKnee.bend'];
 const refs=JSON.parse(fs.readFileSync('tests/fixtures/director-pose-reference.json','utf8'));
 for(const p of presets)assert.deepEqual(keys.map(k=>p.controls[k]),refs.find(r=>r.name===p.label).values,p.label);
});
test('stand, think, wave and reach retain the reference hand placements',()=>{
 const{rig}=make();
 rig.apply(controls('stand'));
 for(const side of ['L','R']){const hand=position(rig,side+'_Hand');assert.ok(hand.y>.85&&hand.y<1.08,'standing hand must hang beside hip');assert.ok(Math.abs(hand.x)<.4,'standing arm must not splay into an A-pose');}
 rig.apply(controls('think'));
 const head=position(rig,'Head'),hand=position(rig,'R_Hand');assert.ok(hand.y>head.y+.025,'thinking hand must reach temple, not the chin');assert.ok(hand.distanceTo(head)<.27,'thinking hand must stay beside head');
 rig.apply(controls('wave'));
 const wrist=position(rig,'R_Hand'),elbow=position(rig,'R_Forearm');assert.ok(wrist.y>elbow.y+.2,'wave forearm must point upward');assert.ok(wrist.z>0,'wave hand must stay in front of the face');
 rig.apply(controls('reach'));
 for(const side of ['L','R']){const h=position(rig,side+'_Hand');assert.ok(h.y>position(rig,'Head').y+.1,'reach hand must be above face');assert.ok(h.z>position(rig,'Head').z+.15,'reach must extend forward, not vertically behind the head');}
});
test('single and double kneeling have distinct rear-leg and upright-trunk geometry',()=>{
 const{rig}=make();
 rig.apply(controls('kneel-one'));assert.ok(position(rig,'L_Calf').y>position(rig,'R_Calf').y+.2,'single kneeling must have one raised knee');assert.ok(position(rig,'L_Foot').z>position(rig,'R_Foot').z+.7,'front/rear foot separation');assert.ok(position(rig,'L_Foot').y<.16,'front foot must not float high above its support');
 rig.apply(controls('kneel-two'));
 for(const side of ['L','R']){assert.ok(position(rig,side+'_Calf').y<.07,'double kneeling knees must be low');assert.ok(position(rig,side+'_Foot').z<position(rig,side+'_Calf').z-.35,'shins must fold behind both knees');}
 assert.ok(Math.abs(position(rig,'Head').z-position(rig,'Hip').z)<.08,'double kneeling trunk must remain upright');
});
test('legacy preset upgrades are idempotent and never replace custom authored poses',()=>{
 const exact={...controls('stand')};const custom={...exact,'leftShoulder.pitch':17};const project={objects:[{kind:'character',poseName:'站立',poseControls:exact},{kind:'character',poseName:'站立',poseControls:custom},{kind:'character',poseName:'自定义',poseControls:{_c2:1,'body.pitch':12}}]};
 Rig.upgradePoseControls(project,presets);assert.equal(project.objects[0].poseControls._rigAxes,3);assert.equal(project.objects[1].poseControls._rigAxes,2);assert.equal(project.objects[1].poseControls['leftShoulder.pitch'],17);assert.equal(project.objects[2].poseControls._rigAxes,2);const saved=JSON.stringify(project);Rig.upgradePoseControls(project,presets);assert.equal(JSON.stringify(project),saved);
 const{rig}=make();rig.apply(project.objects[1].poseControls);const q=rig.bones.get('L_Upperarm').quaternion.toArray();rig.apply(project.objects[1].poseControls);assert.deepEqual(rig.bones.get('L_Upperarm').quaternion.toArray(),q);
});
test('reference FK is independent of outer placement, group scale and yaw',()=>{
 const a=make(),b=make();const group=new T.Group();group.position.set(3,2,-5);group.rotation.y=.75;group.scale.setScalar(2);group.add(b.actor);b.actor.rotation.y=-.3;b.actor.scale.setScalar(.8);group.updateMatrixWorld(true);
 for(const id of ['stand','think','kneel-one','kneel-two','wave','reach']){a.rig.apply(controls(id));b.rig.apply(controls(id));for(const name of ['Hip','Waist','R_Upperarm','L_Upperarm','R_Forearm','L_Calf'])assert.deepEqual(a.rig.bones.get(name).quaternion.toArray(),b.rig.bones.get(name).quaternion.toArray(),id+': outer transform leaked into FK');assert.ok(Math.abs(b.rig.bounds().min.y)<1e-5);}
});
test('old authored pose retains the actual pre-upgrade joint orientations',()=>{
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/director-legacy-pose-v2.json','utf8'));
 const project={objects:[{kind:'character',poseName:'自定义',poseControls:fixture.controls}]};Rig.upgradePoseControls(project,presets);
 const {rig}=make();rig.apply(project.objects[0].poseControls);
 for(const[name,expected]of Object.entries(fixture.quaternions))assert.deepEqual(rig.bones.get(name).quaternion.toArray(),expected,name+': custom pose changed during migration');
 const bounds=rig.bounds();for(let i=0;i<3;i++){assert.ok(Math.abs(bounds.min.toArray()[i]-fixture.bounds[0][i])<1e-7);assert.ok(Math.abs(bounds.max.toArray()[i]-fixture.bounds[1][i])<1e-7);}
});
