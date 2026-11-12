import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as T from '../vendor/three/three.module.js';
const A=createRequire(import.meta.url)('../director-animation.js');
const source=fs.readFileSync(new URL('../director.js',import.meta.url),'utf8');
const transform=(position=[0,0,0],rotation=[0,0,0])=>({position,rotation,scale:[1,1,1]});
const camera=()=>({id:'cam',kind:'camera',name:'机位',target:[0,1.2,0],fov:50,targetMode:'manual',transform:transform([0,2.2,10])});
const actor=(id='actor')=>({id,kind:'character',transform:transform()});
const close=(a,b)=>assert.ok(new T.Vector3(...a).distanceTo(new T.Vector3(...b))<1e-7,`${a} ≠ ${b}`);
function setup(objects=[camera(),actor()]){
 const S={three:T,scene:new T.Scene(),envRoot:new T.Group(),sceneObjects:new Map(),sampledObjects:new Map(),rigs:new Map(),el:{inspector:{querySelector:()=>null,querySelectorAll:()=>[]}},project:{objects,cameras:[],cameraTrack:{clips:[]},scene:{},sequence:{fps:30},objectAnimationTracks:[]},selectedId:'cam',playhead:0};
 S.scene.add(S.envRoot);
 const timeline={trackOf:id=>S.project.objectAnimationTracks.find(t=>t.objectId===id),sampled:obj=>A.sampleObject(obj,timeline.trackOf(obj.id),S.playhead||0),edit(obj,label){const t=timeline.trackOf(obj.id);for(const ch of A.GROUPS[{'旋转':'rotation','注视坐标':'target'}[label]]||[])if(t?.channels[ch]?.length)A.putKey(t,ch,S.playhead||0,A.read(obj,ch));}};
 const scope={S,timeline,Animation:A,POSE_PRESETS:[{controls:{}}],Crowd:{inherited:()=>false,descendants:(_,id)=>new Set([id])},applyPoseControls(){},updateCameraFrustum(){},syncObjectGizmo(){},pushUndo(){},pushUndoLite(){},persist(){},renderInspector(){},refreshTracks(){},refreshTree(){},toast(){},round3:v=>Math.round(v*1000)/1000};
 for(const name of ['orientCameraGizmo','syncRenderCameraFromGizmo','applyTransform','cameraTargetPoint','cameraFollowDelta','resolveCameraBindings','cameraInspectorValue','shiftCameraPosition','freezeCameraDirection','prepareCameraManualRotation','changeCameraBinding','sampleAtFrame','removeObject','onAxisInput']){
  const body=source.match(new RegExp('  function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}'))?.[0];assert.ok(body,name);vm.runInNewContext(body,scope);
 }
 scope.selectObject=id=>{S.selectedId=id;};
 for(const obj of objects){const mesh=new T.Group();S.sceneObjects.set(obj.id,mesh);(S.sceneObjects.get(obj.parentId)||S.envRoot).add(mesh);}
 scope.sampleAtFrame(0);
 const bind=(kind,value)=>scope.changeCameraBinding({dataset:{dtCameraBinding:kind},value});
 const sample=f=>{S.playhead=f;scope.sampleAtFrame(f);return S.sampledObjects.get('cam');};
 const render=()=>{const c=new T.PerspectiveCamera();scope.syncRenderCameraFromGizmo(c,S.project.objects.find(o=>o.id==='cam'));return c;};
 return {S,scope,bind,sample,render,cam:objects.find(o=>o.id==='cam')};
}
function motion(s,id='actor',end=[4,0,0]){
 const track={objectId:id,channels:{}};s.S.project.objectAnimationTracks.push(track);
 for(const [i,ch] of A.GROUPS.position.entries()){A.putKey(track,ch,0,0);A.putKey(track,ch,30,end[i]);}
 A.putKey(track,'rotation.y',0,0);A.putKey(track,'rotation.y',30,90);return track;
}
test('third-person binding preserves framing and follows current sampled target regardless of object order',()=>{
 const s=setup();motion(s);s.sample(15);const before=s.render().position.toArray();s.bind('follow','actor');close(s.render().position.toArray(),before);
 const base=JSON.stringify(s.cam);close(s.sample(30).transform.position,[2,2.2,10]);close(s.sample(7.5).transform.position,[-1,2.2,10]);
 assert.equal(JSON.stringify(s.cam),base,'sampling must never rewrite authored offsets');
});
test('follow and gaze are independent: gaze alone leaves camera position fixed',()=>{
 const s=setup();motion(s);s.bind('look','actor');s.sample(30);const c=s.render();close(c.position.toArray(),[0,2.2,10]);
 close(c.getWorldDirection(new T.Vector3()).toArray(),new T.Vector3(4,1.2,0).sub(c.position).normalize().toArray());
 s.bind('follow','actor');s.sample(0);close(s.render().position.toArray(),[-4,2.2,10]);
 close(s.render().getWorldDirection(new T.Vector3()).toArray(),new T.Vector3(0,1.2,0).sub(s.render().position).normalize().toArray());
});
test('camera can follow one character while gazing at another',()=>{
 const b=actor('b');b.transform.position=[-2,0,5];const s=setup([camera(),actor(),b]);motion(s);s.bind('follow','actor');s.bind('look','b');s.sample(30);
 const c=s.render();close(c.position.toArray(),[4,2.2,10]);close(c.getWorldDirection(new T.Vector3()).toArray(),new T.Vector3(-2,1.2,5).sub(c.position).normalize().toArray());
});
test('first-person camera follows root rotation and 1.2 m eye offset',()=>{
 const s=setup();motion(s);s.bind('follow','actor');s.bind('view','firstPerson');s.sample(30);
 close(s.render().position.toArray(),[4,1.2,0]);close(s.render().getWorldDirection(new T.Vector3()).toArray(),[1,0,0]);
 s.bind('follow','');const c=s.render();close(c.position.toArray(),[4,1.2,0]);close(c.getWorldDirection(new T.Vector3()).toArray(),[1,0,0]);
});
test('manual rotation and manual coordinates retain current optical direction when switching modes',()=>{
 const s=setup();s.cam.transform.rotation=[15,23,19];s.sample(0);const before=s.render().getWorldDirection(new T.Vector3()).toArray();
 s.bind('look','__rotation__');close(s.render().getWorldDirection(new T.Vector3()).toArray(),before);
 s.bind('look','');close(s.render().getWorldDirection(new T.Vector3()).toArray(),before);
});
test('disabling follow freezes visible position without destroying existing camera path motion',()=>{
 const s=setup();motion(s);const t=motion(s,'cam',[2,2.2,10]);t.path={version:2,origin:[0,0,0]};
 s.sample(0);s.bind('follow','actor');s.sample(15);const p=s.render().position.toArray();s.bind('follow','');close(s.render().position.toArray(),p);
 close(s.sample(30).transform.position,[4,2.2,10]);assert.equal(t.path.origin[0],2);
});
test('group parents and scene transforms are respected in follow offsets and gaze points',()=>{
 const group={id:'group',kind:'group',transform:transform([3,0,-2],[0,30,0])};const a=actor();a.parentId='group';const s=setup([group,camera(),a]);
 s.S.envRoot.rotation.y=.4;s.S.envRoot.scale.setScalar(2);s.scope.sampleAtFrame(0);s.bind('follow','actor');const before=s.render().position.clone();
 a.transform.position=[2,0,0];s.scope.sampleAtFrame(0);
 const delta=new T.Vector3(2,0,0).applyAxisAngle(new T.Vector3(0,1,0),Math.PI/6+.4).multiplyScalar(2);
 close(s.render().position.toArray(),before.add(delta).toArray());
 s.bind('look','actor');const p=s.scope.cameraTargetPoint(s.cam,'actor',true),world=s.S.envRoot.localToWorld(new T.Vector3(...p));
 const root=s.S.sceneObjects.get('actor').getWorldPosition(new T.Vector3());close(world.toArray(),root.add(new T.Vector3(0,1.2,0)).toArray());
});
test('binding fields persist across JSON migration and seek produces same optical pose',()=>{
 const s=setup();motion(s);s.bind('follow','actor');s.bind('look','actor');s.sample(12.25);const p=s.render().position.toArray(),d=s.render().getWorldDirection(new T.Vector3()).toArray();
 const restored=A.migrate(JSON.parse(JSON.stringify(s.S.project))),r=setup(restored.objects);r.S.project.objectAnimationTracks=restored.objectAnimationTracks;r.sample(12.25);
 close(r.render().position.toArray(),p);close(r.render().getWorldDirection(new T.Vector3()).toArray(),d);
});
test('gaze and manual mode transitions remain optically correct under nonuniform camera-parent scale',()=>{
 const group={id:'group',kind:'group',transform:{...transform([2,0,0],[0,35,15]),scale:[2,3,.7]}};
 const cam=camera();cam.parentId='group';const s=setup([group,cam,actor()]);s.bind('look','actor');
 const c=s.render(),target=s.S.sceneObjects.get('actor').getWorldPosition(new T.Vector3()).add(new T.Vector3(0,1.2,0));
 const direction=target.sub(c.position).normalize().toArray();close(c.getWorldDirection(new T.Vector3()).toArray(),direction);
 s.bind('look','__rotation__');close(s.render().getWorldDirection(new T.Vector3()).toArray(),direction);
 s.bind('look','');close(s.render().getWorldDirection(new T.Vector3()).toArray(),direction);
});
test('editing follow offset at a nonzero frame applies exactly once, including when bound mid-motion',()=>{
 const s=setup();motion(s);s.sample(15);s.bind('follow','actor');s.sample(30);
 s.scope.onAxisInput({dataset:{dtAxis:'X',dtProp:'位置'},value:'3'});
 close(s.render().position.toArray(),[7,2.2,10]);assert.equal(s.cam.followOffset[0],3);
 assert.equal(s.scope.cameraInspectorValue(s.cam).transform.position[0],3);
});
test('switching a legacy camera with rotation keys to manual rotation converts the old offset convention',()=>{
 const s=setup(),t={objectId:'cam',channels:{}};s.S.project.objectAnimationTracks.push(t);
 A.putKey(t,'rotation.y',0,0);A.putKey(t,'rotation.y',30,90);
 s.sample(30);const expected=s.render().getWorldDirection(new T.Vector3()).toArray();s.sample(0);s.bind('look','__rotation__');
 s.sample(30);close(s.render().getWorldDirection(new T.Vector3()).toArray(),expected);
});
test('deleting a bound target clears both bindings and keeps current camera pose finite',()=>{
 const s=setup();motion(s);s.bind('follow','actor');s.bind('look','actor');s.sample(21);const c=s.render(),p=c.position.toArray(),d=c.getWorldDirection(new T.Vector3()).toArray();
 s.scope.removeObject('actor');close(s.render().position.toArray(),p);close(s.render().getWorldDirection(new T.Vector3()).toArray(),d);
 assert.equal(s.cam.followTargetId,undefined);assert.equal(s.cam.lookAtTargetId,undefined);assert.equal(s.cam.targetMode,'rotation');
});
test('deleting a first-person target cannot reactivate unrelated authored camera rotation keys',()=>{
 const s=setup();motion(s);const track={objectId:'cam',channels:{}};s.S.project.objectAnimationTracks.push(track);
 A.putKey(track,'rotation.y',0,0);A.putKey(track,'rotation.y',30,60);
 s.bind('follow','actor');s.bind('view','firstPerson');s.sample(21);const before=s.render().getWorldDirection(new T.Vector3()).toArray();
 s.scope.removeObject('actor');close(s.render().getWorldDirection(new T.Vector3()).toArray(),before);
});
