import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import * as SU from '../vendor/three/addons/utils/SkeletonUtils.js';
import Rig from '../director-rig.js';
import Editor from '../director-pose-editor.js';
import {loadRig} from './rig-fixture.mjs';
const source=fs.readFileSync('director.js','utf8');
const groups=JSON.parse(source.split('const POSE_AXIS_GROUPS = ')[1].split(';')[0].replaceAll("'",'"').replace(/\b(g|rows|sides):/g,'"$1":').replace(/,\s*([\]}])/g,'$1'));
const limits=Object.fromEntries(groups.flatMap(g=>g.rows||g.sides.flatMap(s=>s[1])).map(([k,,min,max])=>[k,[min,max]]));
const presets=JSON.parse(source.split('const POSE_PRESETS = ')[1].split(';')[0]);
const model=await loadRig('assets3d/models/sam-male.glb');
test('reference semantic proxy orders and signs are independent of GLB bind axes',()=>{
 const examples=[['body',{pitch:12,yaw:20,roll:5},[12,20,5],'YXZ'],['head',{pitch:-10,yaw:30,roll:-5},[-10,30,-5],'YXZ'],['leftShoulder',{pitch:40,twist:20,spread:30},[-40,20,-30],'ZXY'],['rightShoulder',{pitch:40,twist:20,spread:30},[-40,-20,30],'ZXY'],['leftHip',{pitch:25,twist:10,spread:20},[-25,10,-20],'ZXY'],['rightHip',{pitch:25,twist:10,spread:20},[-25,-10,20],'ZXY'],['leftElbow',{bend:45},[-45,0,0],'XYZ'],['rightKnee',{bend:60},[60,0,0],'XYZ']];
 for(const [joint,values,expected,order] of examples){const c=Object.fromEntries(Object.entries(values).map(([k,v])=>[joint+'.'+k,v])),e=Editor.poseEuler(T,joint,c);assert.equal(e.order,order);[e.x,e.y,e.z].forEach((v,i)=>assert.ok(Math.abs(v*180/Math.PI-expected[i])<1e-9));}
});
test('all shipped poses round-trip through actual quaternion/Euler updates without changing canonical or legacy rig poses',()=>{
 const {rig}=Rig.cloneActor(T,SU.clone,model,{bodyType:'sam'});
 for(const preset of presets)for(const version of [2,3])for(const [joint] of Editor.JOINTS){
  const previous={...preset.controls,_rigAxes:version};
  const e=Editor.poseEuler(T,joint,previous),q=new T.Quaternion().setFromEuler(e),decoded=new T.Euler().setFromQuaternion(q,e.order);
  const actual=Editor.controlsFromEuler(joint,decoded,previous,limits);
  for(const [key,value] of Object.entries(actual))assert.equal(value,previous[key],`${preset.id}, ${joint}, ${version}, ${key}`);
  assert.ok(rig.localRotation(joint,{...previous,...actual}).angleTo(rig.localRotation(joint,previous))<.001);
 }
});
test('raised arms remain continuous across ninety degrees and Euler wrapping',()=>{
 for(const side of ['left','right'])for(const pitch of [89,91,130,145,179]){
  const joint=side+'Shoulder',previous={[joint+'.pitch']:pitch-1,[joint+'.spread']:30,[joint+'.twist']:-15};
  const desired={...previous,[joint+'.pitch']:pitch},e=Editor.poseEuler(T,joint,desired);
  const decoded=new T.Euler().setFromQuaternion(new T.Quaternion().setFromEuler(e),e.order);
  assert.deepEqual(Editor.controlsFromEuler(joint,decoded,previous,limits),Object.fromEntries(Object.entries(desired)));
 }
});
test('hinges keep anatomical limits and emit only their own parameter',()=>{
 for(const joint of ['leftElbow','rightElbow','leftKnee','rightKnee']){
  const sign=joint.endsWith('Elbow')?-1:1;
  assert.deepEqual(Editor.controlsFromEuler(joint,new T.Euler(sign*175*Math.PI/180,.2,.1),{[joint+'.bend']:140},limits),{[joint+'.bend']:150});
  assert.deepEqual(Editor.controlsFromEuler(joint,new T.Euler(sign*-10*Math.PI/180,.2,.1),{[joint+'.bend']:5},limits),{[joint+'.bend']:0});
 }
});
