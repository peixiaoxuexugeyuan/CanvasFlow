// Reference camera appearance and optical frame checks in an isolated fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const dpr=Number(process.env.DIRECTOR_TEST_DPR||1);
 const timeout=setTimeout(()=>process.exit(1),60000),targets=await(await fetch('http://127.0.0.1:9337/json')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const send=(method,params={})=>new Promise(r=>{const key=++id;pending.set(key,r);ws.send(JSON.stringify({id:key,method,params}));});
 const ev=async expression=>{const m=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.error||m.result?.exceptionDetails)throw Error(JSON.stringify(m.error||m.result.exceptionDetails));return m.result.result.value;};
 const out=path.resolve('preview/camera-reference-20261009',dpr===1?'.':'dpr-'+dpr);fs.mkdirSync(out,{recursive:true});
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.result.data,'base64'));};
 try{
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:852,deviceScaleFactor:dpr,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5173/_director_rig_test.html'});await new Promise(r=>setTimeout(r,500));await send('Runtime.enable');
  await ev(`(async()=>{for(let i=0;i<100;i++){if(window.CanvasFlowDirector){const n=document.getElementById('rigNode'),p=JSON.parse(n.dataset.directorProject);p.scene.aspectRatio='16:9';p.scene.backgroundColor='#06090f';p.objects[0].visible=false;const cam=p.objects.find(o=>o.kind==='camera');cam.name='机位1';cam.transform.position=[0,1.5,0];cam.target=[0,1.5,5];cam.transform.scale=[1,1,1];n.dataset.directorProject=JSON.stringify(p);await CanvasFlowDirector.open(n);return;}await new Promise(r=>setTimeout(r,100));}throw Error('timeout');})()`);
  await ev(`(()=>{const s=__poseDebug.S;s.controls.setLookAt(-5.5,2.8,-3.5,0,1.45,1,false);s.controls.update(0);document.querySelector('[data-dt-sbcollapse]').click();document.querySelector('[data-dt-timeline-collapse]').click();document.getElementById('rigTools').style.display='none';document.getElementById('rigStatus').style.display='none';document.getElementById('rigSettle').click();__poseDebug.step(0);})()`);
  await new Promise(r=>setTimeout(r,250));await ev(`document.getElementById('rigSettle').click();__poseDebug.step(0);`);await shot('camera-and-frame');
  const appearance=await ev(`(()=>{const s=__poseDebug.S,g=s.sceneObjects.get('camera');return{selected:s.selectedId,bodyMeshes:g.getObjectByName('dt-camera-body').children.length,bodyColor:g.getObjectByName('dt-camera-body').children[0].material.color.getHexString(),frameVisible:g.getObjectByName('dt-frustum').visible,frameColor:g.userData.frustumLines[0].material.color.getHexString()};})()`);
  assert.equal(appearance.bodyColor,'f0a817');assert.equal(appearance.frameVisible,true);assert.equal(appearance.selected,'');
  const point=await ev(`(()=>{const s=__poseDebug.S,g=s.sceneObjects.get('camera'),p=g.localToWorld(new s.three.Vector3(0,-.02*.35,-.8*.35)).project(s.camera),r=s.renderer.domElement.getBoundingClientRect();return{x:r.x+(p.x*.5+.5)*r.width,y:r.y+(-p.y*.5+.5)*r.height};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
  assert.equal(await ev(`__poseDebug.S.selectedId`),'camera');
  await ev(`document.querySelector('[data-dt-sbrail="aspect"]').click();`);
  const ratios=[];
  for(const label of ['21:9','16:9','4:3','1:1','3:4','9:16','自适应']){
   await ev(`document.querySelector('[data-dt-setaspect="${label}"]').click();__poseDebug.step(0);`);
   const data=await ev(`(()=>{const s=__poseDebug.S,g=s.sceneObjects.get('camera'),a=g.userData.frustumLines[4].geometry.attributes.position.array;return{label:s.project.scene.aspectRatio,ratio:Math.abs((a[3]-a[0])/(a[1]*2)),expected:s.project.scene.aspectRatio==='自适应'?s.el.holder.clientWidth/s.el.holder.clientHeight:({ '21:9':21/9,'16:9':16/9,'4:3':4/3,'1:1':1,'3:4':3/4,'9:16':9/16 })[s.project.scene.aspectRatio],visible:g.getObjectByName('dt-frustum').visible};})()`);
   assert.ok(Math.abs(data.ratio-data.expected)<1e-6);assert.equal(data.visible,true);ratios.push(data);
   if(label==='9:16'){await ev(`document.getElementById('rigSettle').click();`);await shot('portrait-frame');}
  }
  await ev(`document.querySelector('[data-dt-sbrail="scene"]').click();document.querySelector('[data-dt-select="camera"]').click();`);
  const fovs=[];
  for(const value of [25,75]){
   const data=await ev(`(()=>{const input=document.querySelector('[data-dt-range="视野角度 (FOV)"]');input.value='${value}';input.dispatchEvent(new Event('input',{bubbles:true}));__poseDebug.step(0);const s=__poseDebug.S,a=s.sceneObjects.get('camera').userData.frustumLines[0].geometry.attributes.position.array;return{fov:s.project.objects.find(o=>o.id==='camera').fov,frameFov:2*Math.atan(a[4]/a[5])*180/Math.PI,previewAspect:s.camPreviewCamera.aspect,viewportAspect:s.el.holder.clientWidth/s.el.holder.clientHeight};})()`);
   assert.equal(data.fov,value);assert.ok(Math.abs(data.frameFov-value)<1e-5);assert.ok(Math.abs(data.previewAspect-data.viewportAspect)<1e-8);fovs.push(data);
  }
  // The animated FOV and roll must drive both the frame and the preview.
  const animated=await ev(`(()=>{const s=__poseDebug.S;s.project.objectAnimationTracks=[{id:'cam-optics',objectId:'camera',channels:{fov:[{id:'f1',frame:0,value:30},{id:'f2',frame:48,value:90}], 'rotation.z':[{id:'r1',frame:0,value:0},{id:'r2',frame:48,value:40}]}}];s.playhead=24;__poseDebug.step(0);const a=s.sceneObjects.get('camera').userData.frustumLines[0].geometry.attributes.position.array;return{fov:s.sampledObjects.get('camera').fov,frameFov:2*Math.atan(a[4]/a[5])*180/Math.PI,previewFov:s.camPreviewCamera.fov};})()`);
  assert.equal(animated.fov,60);assert.ok(Math.abs(animated.frameFov-60)<1e-5);assert.equal(animated.previewFov,60);
  await ev(`(()=>{const s=__poseDebug.S;window.cameraRenderChecks=[];const renderer=s.renderer,original=renderer.render;renderer.render=function(scene,camera){cameraRenderChecks.push({cameras:[...s.sceneObjects.entries()].filter(([id])=>s.project.objects.find(o=>o.id===id)?.kind==='camera').map(([id,g])=>({id,visible:g.visible})),controls:s.transformControl.visible});return original.call(this,scene,camera);};document.querySelector('[data-dt-mode="camera"]').click();__poseDebug.step(0);renderer.render=original;})()`);
  const helperChecks=await ev('cameraRenderChecks');assert.ok(helperChecks.length);assert.ok(helperChecks.every(x=>x.cameras.every(c=>!c.visible)&&!x.controls));
  await ev(`document.querySelector('[data-dt-mode="director"]').click();__poseDebug.step(0);`);assert.equal(await ev(`__poseDebug.S.sceneObjects.get('camera').getObjectByName('dt-frustum').visible`),true);
  const reopened=await ev(`(async()=>{const s=__poseDebug.S;s.project.objectAnimationTracks=[];s.playhead=0;document.querySelector('[data-dt-sbrail="aspect"]').click();document.querySelector('[data-dt-setaspect="9:16"]').click();__poseDebug.step(0);const before=Array.from(s.sceneObjects.get('camera').userData.frustumLines[0].geometry.attributes.position.array);CanvasFlowDirector.close();await new Promise(r=>setTimeout(r,250));await CanvasFlowDirector.open(document.getElementById('rigNode'));__poseDebug.step(0);const g=__poseDebug.S.sceneObjects.get('camera');return{before,after:Array.from(g.userData.frustumLines[0].geometry.attributes.position.array),body:g.getObjectByName('dt-camera-body').children[0].material.color.getHexString(),aspect:__poseDebug.S.project.scene.aspectRatio};})()`);
  assert.deepEqual(reopened.after,reopened.before);assert.equal(reopened.aspect,'9:16');assert.equal(reopened.body,'f0a817');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({dpr,appearance,ratios,fovs,animated,helperChecks,reopened,errors},null,2));console.log('PASS: solid reference camera, unselected frame, all ratios, live/animated FOV, adaptive preview, helper isolation, save/reopen; DPR '+dpr);
 }finally{ws.close();clearTimeout(timeout);}
}
main().catch(e=>{console.error(e);process.exit(1);});
