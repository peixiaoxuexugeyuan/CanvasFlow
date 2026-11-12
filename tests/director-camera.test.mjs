import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
const source=fs.readFileSync(new URL('../director.js',import.meta.url),'utf8');
function setup(){const S={three:T,sceneObjects:new Map(),sampledObjects:new Map(),project:{scene:{scale:1,position:[0,0,0]}}};const scope={S};for(const name of ['orientCameraGizmo','syncRenderCameraFromGizmo']){const body=source.match(new RegExp('  function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}'))[0];vm.runInNewContext(body,scope);}return{S,scope};}
function optics(){const {S,scope}=setup();S.el={holder:{clientWidth:900,clientHeight:600}};S.viewMode='director';scope.ASPECT_RATIOS=[['自适应',0],['21:9',21/9],['16:9',16/9],['4:3',4/3],['1:1',1],['3:4',3/4],['9:16',9/16]];vm.runInNewContext(source.slice(source.indexOf('  // Camera body and lens'),source.indexOf('  function makeGeometry(')),scope);return{S,scope};}
const object=()=>({id:'camera',fov:50,target:[0,0,0],transform:{position:[0,0,5],rotation:[0,0,0],scale:[1,1,1]}});
test('render camera follows the camera gizmo with correct forward-axis conversion',()=>{const{S,scope}=setup(),obj=object(),g=new T.Group();g.position.fromArray(obj.transform.position);S.sceneObjects.set(obj.id,g);scope.orientCameraGizmo(g,obj);g.updateMatrixWorld(true);const cam=new T.PerspectiveCamera();scope.syncRenderCameraFromGizmo(cam,obj);const v=cam.getWorldDirection(new T.Vector3());assert.ok(v.distanceTo(new T.Vector3(0,0,-1))<1e-8);assert.deepEqual(cam.position.toArray(),[0,0,5]);});
test('camera rotation Y channel really changes lens direction',()=>{const{S,scope}=setup(),obj=object(),g=new T.Group();obj.transform.rotation[1]=90;g.position.fromArray(obj.transform.position);S.sceneObjects.set(obj.id,g);scope.orientCameraGizmo(g,obj);g.updateMatrixWorld(true);const cam=new T.PerspectiveCamera();scope.syncRenderCameraFromGizmo(cam,obj);assert.ok(cam.getWorldDirection(new T.Vector3()).distanceTo(new T.Vector3(-1,0,0))<1e-8);});
test('animated FOV is used instead of the authored static FOV',()=>{const{S,scope}=setup(),obj=object(),g=new T.Group();S.sceneObjects.set(obj.id,g);S.sampledObjects.set(obj.id,{...obj,fov:75});g.updateMatrixWorld(true);const cam=new T.PerspectiveCamera();scope.syncRenderCameraFromGizmo(cam,obj);assert.equal(cam.fov,75);assert.equal(obj.fov,50);});

test('yellow camera body and dark lens share resources; each frustum has independent buffers',()=>{
 const{S,scope}=optics(),obj=object(),a=scope.makeCameraGizmo(T,obj),b=scope.makeCameraGizmo(T,{...obj,id:'other'});
 const body=a.getObjectByName('dt-camera-body');assert.ok(body.children.length>=8);assert.equal(body.children[0].material.color.getHexString(),'f0a817');
 assert.ok(body.children.some(m=>m.geometry.type==='CylinderGeometry'&&m.material.color.getHexString()==='22252b'));
 assert.equal(body.children[0].geometry,b.getObjectByName('dt-camera-body').children[0].geometry);
 assert.notEqual(a.userData.frustumLines[0].geometry,b.userData.frustumLines[0].geometry);
 assert.equal(a.getObjectByName('dt-frustum').visible,true,'scene selection must not hide the frame');
 S.viewMode='camera';scope.updateCameraFrustum(a,obj);assert.equal(a.getObjectByName('dt-frustum').visible,false);
});
test('every frustum corner projects to the actual render-camera boundary for all aspect ratios and FOVs',()=>{
 const{S,scope}=optics(),obj=object(),g=scope.makeCameraGizmo(T,obj),root=new T.Group();root.add(g);g.position.fromArray(obj.transform.position);S.sceneObjects.set(obj.id,g);
 for(const [label,ratio] of scope.ASPECT_RATIOS)for(const fov of [25,50,95]){
  S.project.scene.aspectRatio=label==='9:16'?'21:9':'9:16';obj.aspectRatio=label;obj.fov=fov;obj.transform.rotation=[14,25,33];g.scale.set(1.5,.8,2);root.scale.set(2,3,4);root.rotation.set(.1,.4,0);
  scope.orientCameraGizmo(g,obj);scope.updateCameraFrustum(g,obj);root.updateMatrixWorld(true);
  const cam=new T.PerspectiveCamera(fov,ratio||1.5,.01,2000);scope.syncRenderCameraFromGizmo(cam,obj);cam.updateMatrixWorld(true);
  for(const line of g.userData.frustumLines.slice(0,4)){
   const p=new T.Vector3().fromArray(line.geometry.attributes.position.array,3).applyMatrix4(line.matrixWorld).project(cam);
   assert.ok(Math.abs(Math.abs(p.x)-1)<1e-6,label+' FOV '+fov+' horizontal '+p.x);assert.ok(Math.abs(Math.abs(p.y)-1)<1e-6,label+' FOV '+fov+' vertical '+p.y);
  }
 }
 const attr=g.userData.frustumLines[0].geometry.attributes.position;const version=attr.version;scope.updateCameraFrustum(g,obj);assert.equal(attr.version,version,'unchanged optics reuse the GPU buffer');
});
test('camera preview hides all camera helpers during render and restores visibility even after a render error',()=>{
 const{S,scope}=optics(),scene=S.scene=new T.Scene(),a=new T.Group(),b=new T.Group(),controls=new T.Group();scene.add(a,b,controls);b.visible=false;
 S.project.objects=[{id:'a',kind:'camera'},{id:'b',kind:'camera'}];S.sceneObjects.set('a',a);S.sceneObjects.set('b',b);S.transformControl=controls;
 vm.runInNewContext(source.match(/  function renderCameraScene\([^)]*\) \{[\s\S]*?\n  \}/)[0],scope);
 assert.throws(()=>scope.renderCameraScene({render(){assert.equal(a.visible,false);assert.equal(b.visible,false);assert.equal(controls.visible,false);throw Error('render');}},{}),/render/);
 assert.equal(a.visible,true);assert.equal(b.visible,false);assert.equal(controls.visible,true);
});
