import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import * as SkeletonUtils from '../vendor/three/addons/utils/SkeletonUtils.js';
import Ground from '../director-ground.js';
import Rig from '../director-rig.js';
import {loadRig} from './rig-fixture.mjs';
test('precise skinned contact respects scene tilt, group transforms, actor rotation and nonuniform scale',async()=>{
 const scene=new T.Group(),plane=new T.Group(),parent=new T.Group();scene.add(plane);plane.add(parent);
 plane.position.set(3,.7,-2);plane.rotation.set(.3,.5,-.2);plane.scale.setScalar(2.4);
 parent.position.set(.3,.2,1);parent.rotation.set(-.4,.2,.5);parent.scale.set(1.3,.8,1.7);
 const {actor,rig}=Rig.cloneActor(T,SkeletonUtils.clone,await loadRig('assets3d/models/sam-male.glb'),{bodyType:'sam'});parent.add(actor);
 actor.position.set(1,-1.178,0);actor.rotation.set(.2,1.5,.1);actor.scale.set(.97,1.3,.8);rig.apply({'rightElbow.bend':130,'body.pitch':18,_rigAxes:3});
 const before=Ground.bounds(T,actor,plane),height=.8,delta=Ground.localDisplacement(T,plane,parent,height-before.min.y);
 actor.position.add(new T.Vector3(...delta));const after=Ground.bounds(T,actor,plane);
 assert.ok(Math.abs(after.min.y-height)<1e-7);assert.ok(Math.abs(after.min.x-before.min.x)<1e-7);assert.ok(Math.abs(after.min.z-before.min.z)<1e-7);
 assert.deepEqual(actor.rotation.toArray().slice(0,3),[.2,1.5,.1]);
});
test('ground followers keep their offset and move in plane normal through a rotated group',()=>{
 const plane=new T.Group(),parent=new T.Group(),actor=new T.Mesh(new T.BoxGeometry(1,2,1),new T.MeshBasicMaterial());plane.add(parent);parent.add(actor);parent.rotation.set(0,0,Math.PI/3);parent.scale.set(2,.5,1);
 const before=Ground.bounds(T,actor,plane),delta=Ground.localDisplacement(T,plane,parent,.6);actor.position.add(new T.Vector3(...delta));const after=Ground.bounds(T,actor,plane);
 assert.ok(Math.abs(after.min.y-before.min.y-.6)<1e-8);assert.ok(Math.abs(after.min.x-before.min.x)<1e-8);
});
test('floor change translates all authored position keys and path origin, preserving jumps and other channels',()=>{
 const obj={transform:{position:[2,3,4]}},track={channels:{'position.y':[{frame:0,value:1},{frame:24,value:3},{frame:48,value:1}],'rotation.y':[{frame:0,value:40}]},path:{origin:[2,1,4],points:[[0,0,0],[1,0,1]]}};
 Ground.translateMotion(obj,track,[0,.8,0]);assert.deepEqual(obj.transform.position,[2,3.8,4]);assert.deepEqual(track.channels['position.y'].map(k=>k.value),[1.8,3.8,1.8]);assert.deepEqual(track.path.origin,[2,1.8,4]);assert.equal(track.channels['rotation.y'][0].value,40);assert.deepEqual(track.path.points,[[0,0,0],[1,0,1]]);
});
test('floor snapping moves every staged agent path once without changing its shape',()=>{
 const obj={transform:{position:[0,1,0]}},shared={origin:[1,2,3],points:[[0,0,0],[1,0,0]]};
 const track={path:shared,agentPaths:[{path:shared},{path:{origin:[5,6,7],points:[[0,0,0],[2,0,0]]}}]};
 Ground.translateMotion(obj,track,[0,.5,0]);assert.deepEqual(shared.origin,[1,2.5,3]);
 assert.deepEqual(track.agentPaths[1].path.origin,[5,6.5,7]);assert.deepEqual(shared.points,[[0,0,0],[1,0,0]]);
});
