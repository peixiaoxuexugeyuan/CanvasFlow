import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import Agent from '../director-scene-agent.js';
import A from '../director-animation.js';
import Rig from '../director-rig.js';
import * as T from '../vendor/three/three.module.js';
const copy=v=>JSON.parse(JSON.stringify(v));
function project(){return A.migrate({version:3,scene:{groundHeight:0},objects:[{id:'actor',name:'演员',kind:'character',bodyType:'sam',visible:true,transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}},{id:'cam',kind:'camera',name:'机位',visible:true,target:[0,1.2,0],fov:50,transform:{position:[0,2,8],rotation:[0,0,0],scale:[1,1,1]}}],activeCameraId:'cam',sequence:{fps:24,durationFrames:240},objectAnimationTracks:[]});}
const execute=(p,operations)=>Agent.apply(p,{operations},A);
test('every whitebox recipe creates real finite geometry with a floor origin',()=>{
 for(const type of Agent.RECIPES){
  const parameters={size:[4,3,6],outline:[[-2,-3],[2,-3],[2,3],[-2,3]],vertices:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]};
  const mesh=Agent.meshFor(T,{type,parameters});mesh.updateMatrixWorld(true);let vertices=0;
  mesh.traverse(o=>{if(o.isMesh){vertices+=o.geometry.attributes.position.count;for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n),type);}});
  const bounds=new T.Box3().setFromObject(mesh);assert.ok(vertices>=3,type);assert.ok(bounds.min.y>=-.001,type+' penetrates ground');assert.ok(bounds.max.y<=3.01,type+' exceeds height');
 }
});
test('scene transaction creates compound models and motion without changing its input',()=>{
 const p=project(),before=JSON.stringify(p),r=execute(p,[{op:'create',id:'house',kind:'geometry',name:'房屋',position:[-5,0,0],recipe:{type:'building',parameters:{size:[4,5,6],floors:2}}},{op:'sequence',duration:15},{op:'motion',id:'actor',points:[[0,0,0],[0,0,10]],duration:15,action:'run'},{op:'camera',id:'cam',lookAtId:'actor',active:true},{op:'keyframes',id:'cam',keys:[{time:0,position:[0,2,8]},{time:15,position:[0,2,4]}]}]);
 assert.equal(JSON.stringify(p),before);assert.equal(r.project.objects.length,3);assert.equal(r.project.sequence.durationFrames,360);assert.equal(r.project.objects.find(o=>o.id==='house').whitebox.type,'building');
 const t=r.project.objectAnimationTracks.find(t=>t.objectId==='actor');assert.ok(A.sampleObject(p.objects[0],t,179).transform.position[2]>4);assert.equal(A.samplePathWalk(p.objects[0],t,179,24).action,'run');
 assert.equal(r.project.activeCameraId,'cam');assert.equal(r.project.cameraTrack.clips.length,1);
});
test('partial whitebox edits preserve dimensions and architecture not mentioned by the user',()=>{
 let p=execute(project(),[{op:'create',id:'house',kind:'geometry',recipe:{type:'building',parameters:{size:[4,5,6],roof:'gable',floors:2}}}]).project;
 p=execute(p,[{op:'update',id:'house',recipe:{parameters:{floors:3}}}]).project;
 assert.deepEqual(p.objects.at(-1).whitebox,{type:'building',parameters:{size:[4,5,6],roof:'gable',floors:3}});
 p=execute(p,[{op:'update',id:'house',position:[-6,0,0]}]).project;assert.deepEqual(p.objects.at(-1).whitebox.parameters.size,[4,5,6]);
});
test('a conversational reply without tools preserves every authored scene and animation field',()=>{
 const p=project();p.cameraTrack.clips=[{id:'authored-clip',cameraId:'cam',startFrame:0,endFrame:240}];p.cameraTrack.custom='preserve';p.scene.groundHeight=2;
 const r=Agent.apply(p,{message:'可以继续描述要修改的地方',operations:[]},A);
 assert.deepEqual(r.project,p);assert.equal(r.operations,0);
});
test('phased motion keeps earlier keys and deterministic walk/run actions after save and seek',()=>{
 const p=execute(project(),[{op:'sequence',duration:10},{op:'motion',id:'actor',points:[[0,0,0],[0,0,3]],start:0,duration:5,action:'walk'},{op:'motion',id:'actor',points:[[0,0,3],[0,0,12]],start:5,duration:5,action:'run'}]).project;
 const t=p.objectAnimationTracks[0],o=p.objects[0];assert.equal(t.agentPaths.length,2);assert.ok(A.sampleObject(o,t,60).transform.position[2]<3);
 assert.equal(A.samplePathWalk(o,t,60,24).action,'walk');assert.equal(A.samplePathWalk(o,t,180,24).action,'run');assert.deepEqual(A.samplePathWalk(o,t,180.5,24),A.samplePathWalk(o,copy(t),180.5,24));
 assert.ok(Rig.runControls(.5)['leftElbow.bend']>50);A.bakePath(t,A.pathPreset('line',[0,0,0],0,10,true),24,240);assert.equal(t.agentPaths,undefined);
});
test('moving an animated actor shifts all keys and staged paths; unrelated camera keys remain',()=>{
 let p=execute(project(),[{op:'motion',id:'actor',points:[[0,0,0],[0,0,5]],duration:10},{op:'keyframes',id:'cam',keys:[{time:0,fov:40},{time:8,fov:60}]}]).project;
 const camera=JSON.stringify(p.objectAnimationTracks.find(t=>t.objectId==='cam'));
 p=execute(p,[{op:'update',id:'actor',position:[2,0,0]}]).project;const t=p.objectAnimationTracks.find(t=>t.objectId==='actor');assert.equal(t.channels['position.x'][0].value,2);assert.equal(t.agentPaths[0].origin[0],2);assert.equal(JSON.stringify(p.objectAnimationTracks.find(t=>t.objectId==='cam')),camera);
});
test('bad operations and inherited locks cannot partially edit the current project',()=>{
 for(const bad of [{op:'update',id:'missing',position:[1,0,0]},{op:'motion',id:'actor',points:[[0,0,0]],duration:2},{op:'create',kind:'script',id:'execute'},{op:'create',kind:'geometry',id:'bad',recipe:{type:'mesh',parameters:{vertices:[0,0,0,1,0,0,0,1,0],indices:[0,1,9]}}}]){
  const p=project(),before=JSON.stringify(p);assert.throws(()=>execute(p,[{op:'update',id:'actor',position:[2,0,0]},bad]));assert.equal(JSON.stringify(p),before);
 }
 const p=project();p.objects.push({id:'group',kind:'group',locked:true,transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}});p.objects[0].parentId='group';assert.throws(()=>execute(p,[{op:'update',id:'actor',position:[3,0,0]}]),/解锁/);assert.throws(()=>execute(p,[{op:'remove',id:'group'}]),/解锁/);
 assert.throws(()=>Agent.parse({operations:[{op:'update',id:'__proto__'}]}));assert.throws(()=>Agent.parse({operations:Array(181).fill({op:'sequence',duration:15})}));
});
test('deleting a camera target clears bindings and tracks but keeps a single valid active camera',()=>{
 let p=execute(project(),[{op:'camera',id:'cam',lookAtId:'actor',followId:'actor'}]).project;
 p=execute(p,[{op:'remove',id:'actor'}]).project;assert.equal(p.objects.length,1);assert.equal(p.objects[0].lookAtTargetId,undefined);assert.equal(p.objects[0].followTargetId,undefined);assert.equal(p.activeCameraId,'cam');assert.equal(p.cameraTrack.clips.length,1);
});
test('spatial inspection finds crossing paths and does not mutate an intentionally elevated model',()=>{
 const p=execute(project(),[{op:'create',kind:'geometry',id:'wall',name:'墙',recipe:{type:'wall',parameters:{size:[4,3,1]}},position:[0,0,3]},{op:'motion',id:'actor',points:[[0,0,0],[0,0,6]],duration:10}]).project;
 assert.ok(Agent.inspect(p,A).issues.some(i=>i.code==='path-obstacle'));p.objects.at(-1).transform.position[1]=2;const before=JSON.stringify(p);Agent.inspect(p,A);assert.equal(JSON.stringify(p),before);
});
test('inspection includes earlier motion stages when the last stage is clear',()=>{
 const p=execute(project(),[{op:'create',kind:'geometry',id:'wall',name:'墙',recipe:{type:'wall',parameters:{size:[4,3,1]}},position:[0,0,3]},{op:'motion',id:'actor',points:[[0,0,0],[0,0,6]],duration:5},{op:'motion',id:'actor',points:[[0,0,6],[0,0,9]],start:5,duration:5}]).project;
 assert.ok(Agent.inspect(p,A).issues.some(i=>i.code==='path-obstacle'));
});
test('unsupported vision review is recorded rather than reported as a successful check',async()=>{
 const r=await Agent.run({project:project(),prompt:'move',animation:A,preview:()=>({image:'screenshot'}),buildScene:async args=>{if(args.feedback){args.feedback.visualReviewUnavailable='模型不支持图像';return{operations:[]};}return{operations:[{op:'update',id:'actor',position:[1,0,0]}]};}});
 assert.ok(r.report.issues.some(i=>i.code==='review-unavailable'&&i.message.includes('不支持图像')));
});
test('agent rejects a malformed first response, repairs once, and retains conversation with current scene data',async()=>{
 const p=project(),calls=[];
 const r=await Agent.run({project:p,prompt:'把人物移到左边',animation:A,buildScene:async args=>{calls.push(args);return calls.length===1?'broken':JSON.stringify({message:'已移到左边',operations:[{op:'update',id:'actor',position:[-1,0,0]}]});}});
 assert.equal(calls.length,2);assert.equal(calls[1].feedback.issues[0].code,'invalid-command');assert.deepEqual(r.project.objects[0].transform.position,[-1,0,0]);assert.equal(p.aiConversation,undefined);assert.equal(r.project.aiConversation.length,2);
 const prompt=Agent.request({project:r.project,prompt:'再远一点',selectedId:'actor'});assert.match(prompt,/已移到左边/);assert.match(prompt,/selectedId/);assert.match(prompt,/\[-1,0,0\]/);
});
test('cancelled or stale runs never return edits; review failures retain valid work with a visible warning',async()=>{
 let active=true;const p=project();await assert.rejects(Agent.run({project:p,prompt:'move',animation:A,current:()=>active,buildScene:async()=>{active=false;return{operations:[{op:'update',id:'actor',position:[1,0,0]}]};}}),/场景已改变/);assert.equal(p.objects[0].transform.position[0],0);
 let calls=0;const r=await Agent.run({project:p,prompt:'move',animation:A,preview:()=>({image:'screenshot'}),buildScene:async()=>{if(++calls===2)throw Error('模型暂不可用');return{operations:[{op:'update',id:'actor',position:[1,0,0]}]};}});
 assert.equal(r.project.objects[0].transform.position[0],1);assert.ok(r.report.issues.some(i=>i.code==='review-unavailable'));assert.equal(calls,2);
});
test('production model adapter sends selected model, tools, history, scene and rendered review',async()=>{
 const source=fs.readFileSync('app.js','utf8'),calls=[],p=project();p.aiConversation=[{role:'user',content:'搭一个街道'},{role:'assistant',content:'已创建街道'}];
 const scope={state:{projectId:'origin'},window:{DirectorSceneAgent:Agent,CanvasFlowDirectorModels:async()=>[{id:'chosen',enabled:true,supportsScene:true}]},textModelId:()=> 'global',api:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return url.includes('image-to-text')?{description:'人物在镜头中间'}:{text:'{"operations":[]}'};}};
 vm.createContext(scope);vm.runInContext(source.match(/window\.CanvasFlowDirectorBuildScene = async [\s\S]*?\n    \};/)[0],scope);
 await scope.window.CanvasFlowDirectorBuildScene({prompt:'跟拍人物',project:p,scene:p.objects,selectedId:'actor',modelId:'chosen',previs:true,feedbackImage:'data:image/jpeg;base64,test',feedback:{issues:[]}});
 assert.equal(calls[0].body.modelId,'chosen');assert.equal(calls[1].body.modelId,'chosen');assert.equal(calls[1].body.purpose,'scene_agent');assert.match(calls[1].body.prompt,/已创建街道/);assert.match(calls[1].body.prompt,/人物在镜头中间/);assert.match(calls[1].body.prompt,/"op":"motion"/);assert.match(calls[1].body.prompt,/"selectedId":"actor"/);
});


test('long director requirements survive history persistence and the next model request',()=>{
 const p=project(),prompt='场景详细要求。'.repeat(2500)+'最后的场景要求';
 Agent.remember(p,prompt,'已处理',{issues:[],operations:0});
 assert.equal(p.aiConversation[0].content,prompt);
 const reloaded=JSON.parse(JSON.stringify(p));
 assert.equal(Agent.history(reloaded)[0].content,prompt);
 assert.ok(Agent.request({prompt:'继续',project:reloaded}).includes(prompt));
});
