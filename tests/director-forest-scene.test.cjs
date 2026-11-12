const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../director-animation.js'),Agent=require('../director-scene-agent.js');
const scene=JSON.parse(fs.readFileSync('tests/fixtures/director-forest-scene.json','utf8'));
const hero=scene.objects.find(o=>o.id==='forest-hero'),camera=scene.objects.find(o=>o.id==='forest-camera');
const ht=scene.objectAnimationTracks.find(t=>t.objectId===hero.id),ct=scene.objectAnimationTracks.find(t=>t.objectId===camera.id);
test('forest shot holds frontal camera until the glance and then matches actor velocity and direction',()=>{
 assert.equal(A.sampleObject(camera,ct,0).transform.position[2],A.sampleObject(camera,ct,96).transform.position[2]);
 for(const frame of [96,108,144,200,230]){
  const actorDelta=A.sampleObject(hero,ht,frame+1).transform.position.map((v,i)=>v-A.sampleObject(hero,ht,frame).transform.position[i]);
  const cameraDelta=A.sampleObject(camera,ct,frame+1).transform.position.map((v,i)=>v-A.sampleObject(camera,ct,frame).transform.position[i]);
  actorDelta.forEach((v,i)=>assert.ok(Math.abs(v-cameraDelta[i])<1e-10));
 }
 assert.equal(camera.lookAtTargetId,hero.id);assert.equal(camera.followTargetId,undefined);
});
test('head and torso glance overlays the walk without changing root facing or authored pose',()=>{
 const before=JSON.stringify(hero),early=A.sampleObject(hero,ht,96),turn=A.sampleObject(hero,ht,106),reset=A.sampleObject(hero,ht,132);
 assert.equal(early.poseControls['head.yaw'],0);assert.equal(turn.poseControls['head.yaw'],82);assert.equal(turn.poseControls['torso.yaw'],47);
 assert.equal(reset.poseControls['head.yaw'],0);assert.equal(turn.transform.rotation[1],early.transform.rotation[1]);
 assert.equal(A.samplePathWalk(hero,ht,106,24).action,'walk');assert.equal(JSON.stringify(hero),before);
 A.migrate(scene);assert.equal(ht.channels['pose.head.yaw'].length,6);
});
test('pose tool rejects non-character targets, invalid joints and out-of-range head twists',()=>{
 assert.throws(()=>Agent.apply(scene,{operations:[{op:'keyframes',id:camera.id,keys:[{time:1,poseControls:{'head.yaw':30}}]}]},A),/仅适用于角色/);
 assert.throws(()=>Agent.parse({operations:[{op:'keyframes',id:hero.id,keys:[{time:1,poseControls:{'head.yaw':200}}]}]}),/超出范围/);
 assert.throws(()=>Agent.parse({operations:[{op:'keyframes',id:hero.id,keys:[{time:1,poseControls:{'unknown.joint':10}}]}]}),/不支持的姿态/);
});
