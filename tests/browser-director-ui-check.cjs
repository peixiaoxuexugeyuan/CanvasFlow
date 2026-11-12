// Chrome CDP on 9337, local server on 5173. Isolated fixture; no user project writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const timeout=setTimeout(()=>{console.error('Browser verification timed out');process.exit(1);},60000);
 const targets=await(await fetch('http://127.0.0.1:9337/json')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const send=(method,params={})=>new Promise(r=>{const key=++id;pending.set(key,r);ws.send(JSON.stringify({id:key,method,params}));});
 const ev=async expression=>{const m=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.error||m.result?.exceptionDetails)throw Error(JSON.stringify(m.error||m.result.exceptionDetails));return m.result.result.value;};
 const click=async selector=>{
  const point=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
 };
 const out=path.resolve('preview/director-ui-fix-20261008');fs.mkdirSync(out,{recursive:true});
 try{
  await send('Page.navigate',{url:'http://127.0.0.1:5173/_director_rig_test.html'});await new Promise(r=>setTimeout(r,500));await send('Runtime.enable');
  await ev(`(async()=>{for(let i=0;i<100;i++){if(window.CanvasFlowDirector){window.DirectorRig=undefined;window.DirectorCrowd={};await CanvasFlowDirector.open(document.getElementById('rigNode'));return;}await new Promise(r=>setTimeout(r,100));}throw Error('timeout');})()`);
  assert.equal(await ev(`__poseDebug.S.rigs.get('actor').bones.size`),41);
  const blue=await ev(`(()=>{const s=__poseDebug.S;return [...s.sceneObjects.get('actor').children].flatMap(x=>{const colors=[];x.traverse(c=>{if(c.isMesh&&c.material)colors.push(c.material.color?.getHexString());});return colors;});})()`);
  assert.ok(blue.length>0);assert.ok(blue.every(c=>c==='4f8ef7'));
  await click('[data-dt-sbrail="addchar"]');
  const added=[];
  for(const type of ['sam','female','muscular','slim','teen','child','broad','chibi']){
   const count=await ev(`__poseDebug.S.project.objects.length`);await click(`[data-dt-addchar="${type}"]`);
   const result=await ev(`(async()=>{for(let i=0;i<100;i++){if(__poseDebug.S.project.objects.length>${count})break;await new Promise(r=>setTimeout(r,25));}const s=__poseDebug.S,o=s.project.objects.at(-1),r=s.rigs.get(o.id),colors=[];s.sceneObjects.get(o.id)?.traverse(c=>{if(c.isMesh&&c.material)colors.push(c.material.color?.getHexString());});return{type:o.bodyType,color:o.color,bones:r?.bones.size,colors,count:s.project.objects.length};})()`);
   assert.equal(result.count,count+1);assert.equal(result.type,type);assert.equal(result.bones,41);assert.ok(result.colors.length);assert.ok(result.colors.every(c=>c===result.color.slice(1)));added.push(result);
  }
  await click('[data-dt-addcrowd]');await click('[data-crowd-confirm]');
  await ev(`(async()=>{for(let i=0;i<100;i++){if(__poseDebug.S.project.objects.some(o=>o.kind==='group'))return;await new Promise(r=>setTimeout(r,25));}throw Error('crowd add failed');})()`);
  await ev(`(()=>{const s=__poseDebug.S;s.project.objects.forEach((o,i)=>{if(o.kind==='character')o.transform.position[0]=(i-4)*.7;});__poseDebug.step(0);s.controls.setLookAt(6,4,10,0,1,0,false);s.controls.update(0);__poseDebug.step(0);})()`);
  let shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'actors.png'),Buffer.from(shot.result.data,'base64'));
  const reopen=await ev(`(async()=>{const before=__poseDebug.S.project.objects.filter(o=>o.kind==='character').map(o=>[o.id,o.color]);CanvasFlowDirector.close();await new Promise(r=>setTimeout(r,250));await CanvasFlowDirector.open(document.getElementById('rigNode'));return before.every(([id,color])=>{let valid=true;__poseDebug.S.sceneObjects.get(id).traverse(c=>{if(c.isMesh&&c.material&&c.material.color.getHexString()!==color.slice(1))valid=false;});return valid;});})()`);
  assert.equal(reopen,true);
  await click('[data-dt-sbrail="addchar"]');
  const localImport=await ev(`(async()=>{
   const s=__poseDebug.S,count=s.project.objects.length,blob=await(await fetch('assets3d/models/sam-female.glb')).blob(),file=new File([blob],'local-female.glb',{type:'model/gltf-binary'});
   const create=document.createElement.bind(document);document.createElement=function(tag,...args){const el=create(tag,...args);if(tag==='input')el.click=function(){Object.defineProperty(el,'files',{value:[file]});el.onchange();};return el;};
   try{document.querySelector('[data-dt-localmodel]').click();}finally{document.createElement=create;}
   for(let i=0;i<100;i++){if(s.project.objects.length>count)break;await new Promise(r=>setTimeout(r,25));}
   const o=s.project.objects.at(-1);return {count:s.project.objects.length,expected:count+1,local:o.local,name:o.name,bones:s.rigs.get(o.id)?.bones.size};
  })()`);
  assert.equal(localImport.count,localImport.expected);assert.equal(localImport.local,true);assert.equal(localImport.name,'local-female');assert.equal(localImport.bones,41);
  await ev(`(()=>{const s=__poseDebug.S;s.project.objects.forEach(o=>o.visible=false);s.project.scene.backgroundColor='#808080';s.scene.background=new s.three.Color('#808080');s.transformControl.detach();s.grid.visible=false;s.groundPlane?.visible&&(s.groundPlane.visible=false);s.envRoot.visible=false;})()`);
  await click('[data-dt-sbrail="aspect"]');
  const aspects=[];
  for(const label of ['21:9','16:9','4:3','1:1','3:4','9:16','自适应']){
   await click(`[data-dt-setaspect="${label}"]`);
   const result=await ev(`(()=>{const s=__poseDebug.S;__poseDebug.step(0);const gl=s.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;const pixel=(x,y)=>{const p=new Uint8Array(4);gl.readPixels(Math.floor(x),Math.floor(y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return p[0];};return{label:s.project.scene.aspectRatio,dpr:s.renderer.getPixelRatio(),width:w,height:h,center:pixel(w/2,h/2),top:pixel(w/2,h-2),bottom:pixel(w/2,1),left:pixel(1,h/2),right:pixel(w-2,h/2)};})()`);
   assert.equal(result.label,label);assert.equal(result.center,128);
   if(label==='自适应'){assert.equal(result.top,128);assert.equal(result.bottom,128);assert.equal(result.left,128);assert.equal(result.right,128);}
   else{const [a,b]=label.split(':').map(Number),ratio=a/b,marginX=(result.width-result.height*ratio)/2,marginY=(result.height-result.width/ratio)/2;
    // A one-pixel margin can fall before the sampled pixel; verify only samples inside the actual mask.
    if(marginY>=4){assert.ok(result.top<100);assert.ok(result.bottom<100);assert.equal(result.left,128);assert.equal(result.right,128);}
    if(marginX>=4){assert.ok(result.left<100);assert.ok(result.right<100);assert.equal(result.top,128);assert.equal(result.bottom,128);}}
   aspects.push(result);
  }
  await click('[data-dt-setaspect="16:9"]');await click('[data-dt-mode="camera"]');
  const camera=await ev(`(()=>{__poseDebug.step(0);const s=__poseDebug.S,gl=s.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;const pixel=(x,y)=>{const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return p[0];};return{aspect:s.camera.aspect,center:pixel(Math.floor(w/2),Math.floor(h/2)),top:pixel(Math.floor(w/2),h-2),bottom:pixel(Math.floor(w/2),1)};})()`);
  assert.equal(camera.aspect,16/9);assert.equal(camera.center,128);assert.equal(camera.top,0);assert.equal(camera.bottom,0);
  await click('[data-dt-mode="director"]');
  const restoredAspect=await ev(`(()=>{__poseDebug.step(0);const s=__poseDebug.S;return{aspect:s.camera.aspect,expected:s.renderer.domElement.clientWidth/s.renderer.domElement.clientHeight};})()`);
  assert.equal(restoredAspect.aspect,restoredAspect.expected);
  await ev(`(()=>{const s=__poseDebug.S;s.envRoot.visible=true;s.project.objects.forEach(o=>o.visible=true);s.controls.setLookAt(6,4,10,0,1,0,false);s.controls.update(0);__poseDebug.step(0);})()`);
  await click('[data-dt-setaspect="9:16"]');await ev('__poseDebug.step(0)');
  shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'portrait.png'),Buffer.from(shot.result.data,'base64'));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({blue,added,reopen,localImport,aspects,camera,restoredAspect,errors},null,2));console.log('PASS: helper recovery, eight body types, actor colors, crowd, reopen, local GLB, all aspect masks at DPR '+aspects[0].dpr);
 }finally{ws.close();clearTimeout(timeout);}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
