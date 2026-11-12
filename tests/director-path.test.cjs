const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('../director-animation.js');
const near=(a,b)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-8,`${a} != ${b}`);
test('reference presets begin at the actor, follow its yaw and cover the whole sequence',()=>{
 for(const type of ['circle','line','rectangle'])for(const yaw of [0,90,-60]){const p=A.pathPreset(type,[3,2,-1],yaw,10),points=A.pathPoints(p);near(points[0],[3,2,-1]);assert.equal(p.duration,10);assert.equal(p.startFrame,0);assert.ok(points.flat().every(Number.isFinite));if(type!=='line')near(points.at(-1),points[0]);else near(points.at(-1),[3+4*Math.sin(yaw*Math.PI/180),2,-1+4*Math.cos(yaw*Math.PI/180)]);}
});
test('cubic circle has the reference two metre radius and paired tangent handles',()=>{
 const p=A.pathPreset('circle',[0,0,0],0);assert.equal(p.anchors.length,5);near(p.origin,[-2,0,0]);const pts=A.pathPoints(p);assert.equal(pts.length,129);for(const q of pts)assert.ok(Math.abs(Math.hypot(q[0]+2,q[2])-2)<.001);near(p.anchors[0].out.map((v,i)=>v-p.anchors[0].point[i]),[0,0,1.1045694996]);
});
test('all three rotations and nonuniform scaling transform cubic geometry invertibly',()=>{
 const p=A.pathPreset('line',[2,3,4],30);p.rotation=[22,-61,75];p.scale3=[2,.5,3];p.scale=1.7;for(const q of [[0,0,0],[3,-2,7],[-5,4,1]])near(A.pathToLocal(p,A.pathToWorld(p,q)),q);
});
test('pen uses explicit cubic handles rather than smoothing through unrelated anchors',()=>{
 const p=A.pathFromAnchors('pen',[{point:[0,0,0],out:[0,2,0],mode:'asymmetric'},{point:[4,0,0],in:[4,2,0],mode:'asymmetric'}]);const points=A.pathPoints(p);near(points[16],[2,1.5,0]);near(points[0],[0,0,0]);near(points.at(-1),[4,0,0]);
});
test('moving an anchor carries its handles and synchronizes a closed endpoint',()=>{
 const p=A.pathPreset('circle',[0,0,0],0),before=A.pathToWorld(p,p.anchors[0].out);A.editPathAnchor(p,0,'point',[1,2,3]);near(A.pathToWorld(p,p.anchors[0].out),before.map((v,i)=>v+[1,2,3][i]));assert.deepEqual(p.anchors.at(-1),p.anchors[0]);
});
test('symmetric and asymmetric handles maintain their chosen tangent relationships',()=>{
 const p=A.pathPreset('circle',[0,0,0],0);A.editPathAnchor(p,1,'out',[2,0,4]);let a=p.anchors[1];near(a.in,a.out.map((v,i)=>2*a.point[i]-v));A.setAnchorMode(p,1,'asymmetric');const length=Math.hypot(...a.in.map((v,i)=>v-a.point[i]));A.editPathAnchor(p,1,'out',[4,2,5]);a=p.anchors[1];assert.ok(Math.abs(Math.hypot(...a.in.map((v,i)=>v-a.point[i]))-length)<1e-8);const x=a.in.map((v,i)=>v-a.point[i]),y=a.out.map((v,i)=>v-a.point[i]);assert.ok(x.reduce((s,v,i)=>s+v*y[i],0)<0);
});
test('corner mode removes smoothing and can become a curve again',()=>{
 const p=A.pathPreset('circle',[0,0,0],0);A.setAnchorMode(p,1,'vertex');assert.equal(p.anchors[1].in,undefined);assert.equal(p.anchors[1].out,undefined);A.setAnchorMode(p,1,'symmetric');assert.ok(p.anchors[1].in&&p.anchors[1].out);
});
test('legacy paths upgrade once without moving their visible geometry or timing',()=>{
 const p={type:'pen',points:[[0,0,0],[1,0,2],[3,1,4]],origin:[8,2,7],yaw:42,scale:2,duration:6,startFrame:24,follow:false},before=A.pathPoints(p);A.upgradePath(p);assert.equal(p.startFrame,24);const after=A.pathPoints(p);assert.equal(after.length,before.length);after.forEach((v,i)=>near(v,before[i]));assert.deepEqual(A.upgradePath(p),p);
});
test('path edits drive sampled playback and exports, and follow orientation can be removed',()=>{
 const obj={kind:'character',transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}},t={channels:{}},p=A.pathPreset('line',[0,0,0],90,10,true);p.origin[1]=2;A.bakePath(t,p,24,240);near(A.sampleObject(obj,t,0).transform.position,[0,2,0]);near(A.sampleObject(obj,t,239).transform.position,[4,2,0]);assert.ok(Math.abs(A.sampleObject(obj,t,120).transform.rotation[1]-90)<1e-8);const plan=A.exportPlan({fps:24},[0,239],60);assert.ok(A.sampleObject(obj,t,plan.frameAt(100)).transform.position[0]>0);p.follow=false;A.bakePath(t,p,24,240);assert.equal(t.channels['rotation.y'].length,0);assert.deepEqual(A.migrate({objects:[obj],objectAnimationTracks:[JSON.parse(JSON.stringify(t))],sequence:{fps:24,durationFrames:240}}).objectAnimationTracks[0].path,p);
});
test('retired motion tracks cannot play after reopening, while authored pose and transforms survive',()=>{
 const pose={'head.pitch':15},p={objects:[{id:'actor',kind:'character',poseMode:'animation',poseControls:pose,transform:{position:[2,0,0],rotation:[0,0,0],scale:[1,1,1]}}],characterTracks:[{characterId:'actor',clips:[{motionId:'walk',startFrame:0,endFrame:240}]}]};A.migrate(p);assert.equal(p.characterTracks,undefined);assert.equal(p.objects[0].poseMode,'static');assert.deepEqual(p.objects[0].poseControls,pose);assert.equal(p.removedMotionTracks[0].clips[0].motionId,'walk');const saved=JSON.stringify(p);A.migrate(p);assert.equal(JSON.stringify(p),saved);
});
test('the inspector checkbox changes follow mode and deletes generated orientation keys',()=>{
 const vm=require('node:vm'),source=require('node:fs').readFileSync('director-timeline.js','utf8'),p=A.pathPreset('line',[0,0,0],0),t={channels:{},path:p};A.bakePath(t,p,24,240);let writes=0;
 const scope={S:{recording:false,selectedId:'actor',el:{inspector:{querySelectorAll:()=>[]}}},A,writable:()=>({id:'actor'}),trackOf:()=>t,pushUndo(){},commitPath(){A.bakePath(t,t.path,24,240);writes++;}};
 vm.runInNewContext(source.slice(source.indexOf('function pathChange('),source.indexOf('function clearLines(')),scope);
 scope.pathChange({target:{dataset:{dtlPathFollow:''},value:'on',checked:false}});assert.equal(t.path.follow,false);assert.equal(t.channels['rotation.y'].length,0);assert.equal(writes,1);
 scope.pathChange({target:{dataset:{dtlPathFollow:''},value:'on',checked:true}});assert.equal(t.path.follow,true);assert.ok(t.channels['rotation.y'].length>0);assert.equal(writes,2);
});
