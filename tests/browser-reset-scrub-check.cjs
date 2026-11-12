const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const timeout=setTimeout(()=>process.exit(1),65000),targets=await(await fetch('http://127.0.0.1:9337/json')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const send=(method,params={})=>new Promise(r=>{const key=++id;pending.set(key,r);ws.send(JSON.stringify({id:key,method,params}));});
 const ev=async expression=>{const m=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.error||m.result?.exceptionDetails)throw Error(JSON.stringify(m.error||m.result.exceptionDetails));return m.result.result.value;};
 const out=path.resolve('preview/reset-scrub-20261009');fs.mkdirSync(out,{recursive:true});
 const mouse=(type,x,y,extra={})=>send('Input.dispatchMouseEvent',{type,x,y,...extra});
 const point=selector=>ev(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 const drag=async(selector,dx,shift=false)=>{const p=await point(selector),modifiers=shift?8:0;await mouse('mousePressed',p.x,p.y,{button:'left',buttons:1,clickCount:1,modifiers});await mouse('mouseMoved',p.x+dx/2,p.y,{buttons:1,modifiers});await mouse('mouseMoved',p.x+dx,p.y,{buttons:1,modifiers});await mouse('mouseReleased',p.x+dx,p.y,{button:'left',clickCount:1,modifiers});};
 const state=()=>ev(`({frame:__poseDebug.S.playhead,text:document.querySelector('#dtTimecodeInput').value,y:__poseDebug.S.sceneObjects.get('actor').position.y,playing:__poseDebug.S.playing,duration:__poseDebug.S.project.sequence.durationFrames,undos:__poseDebug.S.undoStack.length,batch:__poseDebug.S.batchDepth,cursor:document.body.style.cursor})`);
 try{
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:852,deviceScaleFactor:1,mobile:false});await send('Runtime.enable');errors.length=0;await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Page.navigate',{url:'http://127.0.0.1:5173/_director_rig_test.html'});await new Promise(r=>setTimeout(r,400));
  await ev(`(async()=>{for(let i=0;i<100;i++){if(window.CanvasFlowDirector){const n=document.getElementById('rigNode'),p=JSON.parse(n.dataset.directorProject);p.objectAnimationTracks=[{objectId:'actor',channels:{'position.y':[{frame:0,value:0},{frame:48,value:2}]}}];n.dataset.directorProject=JSON.stringify(p);await CanvasFlowDirector.open(n);document.getElementById('rigTools').hidden=true;document.getElementById('rigTools').style.display='none';return;}await new Promise(r=>setTimeout(r,100));}throw Error('timeout');})()`);
  assert.equal(await ev(`document.getElementById('dtTimeline').classList.contains('is-open')`),false);await ev(`document.querySelector('[data-dock-timeline]').click()`);await new Promise(r=>setTimeout(r,120));
  const scrub=[];await drag('#dtTimecodeInput',48);scrub.push(await state());assert.equal(scrub.at(-1).frame,24);assert.equal(scrub.at(-1).text,'1.00');assert.equal(scrub.at(-1).y,1);
  await drag('#dtTimecodeInput',10,true);scrub.push(await state());assert.equal(scrub.at(-1).frame,25);
  await ev(`document.querySelector('[data-dtl-unit]').click()`);await drag('#dtTimecodeInput',-2*1.5);scrub.push(await state());assert.equal(scrub.at(-1).frame,24);assert.equal(scrub.at(-1).text,'1000');
  await ev(`document.querySelector('[data-dtl-unit]').click()`);await drag('#dtTimecodeInput',12);scrub.push(await state());assert.equal(scrub.at(-1).frame,30);assert.equal(scrub.at(-1).text,'30');
  await drag('#dtTimecodeInput',-100);assert.equal((await state()).frame,0);await drag('#dtTimecodeInput',1000);assert.equal((await state()).frame,239);
  await drag('#dtTimecodeInput',0);await send('Input.insertText',{text:'48'});await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.equal((await state()).frame,48);
  const before=await state();await drag('#dtDurationSec',48);const duration=await state();assert.equal(duration.duration,264);assert.equal(duration.undos,before.undos+1);assert.equal(duration.batch,0);assert.equal(duration.cursor,'');
  await ev(`document.querySelector('[data-dt-play]').click()`);await drag('#dtTimecodeInput',10);assert.equal((await state()).playing,false);
  const original=await ev(`JSON.stringify(__poseDebug.S.project.objects)`);
  await ev(`(()=>{const s=__poseDebug.S;s.controls.setLookAt(100,80,-60,40,20,10,false);s.controls.setFocalOffset(2,3,0,false);s.camera.fov=100;s.controls.update(0);s.camera.updateProjectionMatrix();document.getElementById('dtResetView').click();})()`);
  const readView=`(()=>{const s=__poseDebug.S;return{position:s.camera.position.toArray(),target:s.controls.getTarget().toArray(),fov:s.camera.fov,up:s.camera.up.toArray(),focal:s.controls.getFocalOffset().toArray(),mode:s.viewMode};})()`;
  const reset=await ev(readView);assert.equal(reset.fov,50);assert.deepEqual(reset.up,[0,1,0]);assert.deepEqual(reset.focal,[0,0,0]);assert.ok(Math.abs(reset.position[0]-reset.target[0])<1e-8);assert.ok(Math.abs(reset.position[1]-reset.target[1])<1e-8);assert.ok(reset.position[2]>reset.target[2]);assert.equal(await ev(`JSON.stringify(__poseDebug.S.project.objects)`),original);
  await ev(`document.querySelector('[data-dt-mode="camera"]').click();document.getElementById('dtResetView').click()`);const fromCamera=await ev(readView);assert.equal(fromCamera.mode,'director');assert.deepEqual(fromCamera.position,reset.position);assert.equal(await ev(`JSON.stringify(__poseDebug.S.project.objects)`),original);
  await ev(`document.getElementById('dtResetView').click()`);assert.deepEqual(await ev(readView),fromCamera);
  await ev(`document.querySelector('[data-dt-seek="start"]').click();document.getElementById('dtResetView').click();__poseDebug.step(0);document.querySelectorAll('.director-toast').forEach(x=>x.remove());document.getElementById('rigStatus').style.display='none'`);const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'reset-view-and-time-scrub.png'),Buffer.from(shot.result.data,'base64'));
  // Closing while dragging must release capture/listeners and finish the undo batch.
  const p=await point('#dtDurationSec');await mouse('mousePressed',p.x,p.y,{button:'left',buttons:1,clickCount:1});await mouse('mouseMoved',p.x+10,p.y,{buttons:1});await ev(`CanvasFlowDirector.close()`);assert.equal(await ev(`document.body.style.cursor`),'');assert.equal(await ev(`__poseDebug.S.batchDepth`),0);await mouse('mouseReleased',p.x+10,p.y,{button:'left',clickCount:1});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({scrub,duration,reset,fromCamera,errors},null,2));console.log('PASS: left-drag frame preview, Shift precision, seconds/milliseconds/frames, bounds, typing, duration undo batch, reset front view/FOV/pan, camera unchanged, idempotence, drag disposal');
 }finally{ws.close();clearTimeout(timeout);}
}
main().catch(e=>{console.error(e);process.exit(1);});
