// Isolated sky-color input/rendering regression; Chrome CDP 9337, local server 5173.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const timeout=setTimeout(()=>process.exit(1),60000),targets=await(await fetch('http://127.0.0.1:9337/json')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const send=(method,params={})=>new Promise(r=>{const key=++id;pending.set(key,r);ws.send(JSON.stringify({id:key,method,params}));});
 const ev=async expression=>{const m=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.error||m.result?.exceptionDetails)throw Error(JSON.stringify(m.error||m.result.exceptionDetails));return m.result.result.value;};
 try{
  await send('Page.navigate',{url:'http://127.0.0.1:5173/_director_rig_test.html'});await new Promise(r=>setTimeout(r,500));await send('Runtime.enable');
  await ev(`(async()=>{for(let i=0;i<100;i++){if(window.CanvasFlowDirector){await CanvasFlowDirector.open(document.getElementById('rigNode'));return;}await new Promise(r=>setTimeout(r,100));}throw Error('timeout');})()`);
  assert.equal(await ev(`document.querySelector('[aria-label="天空颜色"]').dataset.dtColor`),'天空颜色');
  const result=await ev(`(()=>{const s=__poseDebug.S;s.envRoot.visible=false;cancelAnimationFrame(s.raf);const input=document.querySelector('[data-dt-color="天空颜色"]'),text=document.querySelector('[data-dt-color-value="天空颜色"]'),samples=[];const read=()=>{const gl=s.renderer.getContext(),p=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p).slice(0,3);};for(const color of ['#ff0000','#00ff00','#0000ff']){input.value=color;input.dispatchEvent(new Event('input',{bubbles:true}));samples.push({color,saved:s.project.scene.backgroundColor,text:text.value,pixel:read()});}text.value='#123456';text.dispatchEvent(new Event('input',{bubbles:true}));return{samples,typed:{saved:s.project.scene.backgroundColor,swatch:input.value,pixel:read()}};})()`);
  for(const [i,sample]of result.samples.entries()){assert.equal(sample.saved,sample.color);assert.equal(sample.text,sample.color);assert.deepEqual(sample.pixel,[[255,0,0],[0,255,0],[0,0,255]][i]);}
  assert.equal(result.typed.saved,'#123456');assert.equal(result.typed.swatch,'#123456');assert.deepEqual(result.typed.pixel,[18,52,86]);
  const reopened=await ev(`(async()=>{CanvasFlowDirector.close();await new Promise(r=>setTimeout(r,250));await CanvasFlowDirector.open(document.getElementById('rigNode'));return {saved:__poseDebug.S.project.scene.backgroundColor,swatch:document.querySelector('[data-dt-color="天空颜色"]').value};})()`);
  assert.equal(reopened.saved,'#123456');assert.equal(reopened.swatch,'#123456');
  const pano=await ev(`(async()=>{
   const s=__poseDebug.S,c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,128,64);ctx.fillStyle='#444444';ctx.fillRect(0,0,128,8);
   const blob=await new Promise(r=>c.toBlob(r,'image/png')),file=new File([blob],'sky-test-panorama.png',{type:'image/png'});
   const create=document.createElement.bind(document);document.createElement=function(tag,...args){const el=create(tag,...args);if(tag==='input')el.click=function(){Object.defineProperty(el,'files',{value:[file]});el.onchange();};return el;};
   try{document.querySelector('[data-dt-panorama-pick]').click();}finally{document.createElement=create;}
   for(let i=0;i<100;i++){if(s.panoramaDome.visible)break;await new Promise(r=>setTimeout(r,25));}if(!s.panoramaDome.visible)throw Error('panorama load failed');
   s.project.objects.forEach(o=>o.visible=false);s.envRoot.children.forEach(o=>o.visible=o===s.panoramaDome);s.transformControl.detach();s.controls.setLookAt(0,1.05,5,0,1.05,0,false);s.controls.update(0);cancelAnimationFrame(s.raf);
   const map=s.panoramaDome.material.map,source=s.project.scene.panoramaData,input=document.querySelector('[data-dt-color="天空颜色"]'),samples=[];
   const read=()=>{const gl=s.renderer.getContext(),p=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p).slice(0,3);};
   for(const color of ['#ff0000','#00ff00','#0000ff']){input.value=color;input.dispatchEvent(new Event('input',{bubbles:true}));samples.push({color,tint:s.panoramaDome.material.color.getHexString(),saved:s.project.scene.panoramaTint,visible:s.panoramaDome.visible,sameMap:map===s.panoramaDome.material.map,sameSource:source===s.project.scene.panoramaData,pixel:read()});}
   return {samples,history:s.project.scene.panoramaHistory.length};
  })()`);
  for(const [i,sample]of pano.samples.entries()){assert.equal(sample.tint,sample.color.slice(1));assert.equal(sample.saved,sample.color);assert.equal(sample.visible,true);assert.equal(sample.sameMap,true);assert.equal(sample.sameSource,true);assert.deepEqual(sample.pixel,[[255,0,0],[0,255,0],[0,0,255]][i]);}
  const tintReopen=await ev(`(async()=>{CanvasFlowDirector.close();await new Promise(r=>setTimeout(r,250));await CanvasFlowDirector.open(document.getElementById('rigNode'));for(let i=0;i<100;i++){if(__poseDebug.S.panoramaDome.visible)break;await new Promise(r=>setTimeout(r,25));}const s=__poseDebug.S;return{visible:s.panoramaDome.visible,tint:s.panoramaDome.material.color.getHexString(),saved:s.project.scene.panoramaTint,connected:!!s.project.scene.panoramaData};})()`);
  assert.equal(tintReopen.visible,true);assert.equal(tintReopen.tint,'0000ff');assert.equal(tintReopen.saved,'#0000ff');assert.equal(tintReopen.connected,true);
  const history=await ev(`(async()=>{document.querySelector('[data-dt-panorama-clear]').click();document.querySelector('[data-dt-sbrail="pano"]').click();document.querySelector('[data-dt-pano-history]').click();await new Promise(r=>setTimeout(r,20));document.querySelector('[data-dt-history-item]').click();document.querySelector('[data-dt-history-confirm]').click();for(let i=0;i<100;i++){if(__poseDebug.S.panoramaDome.visible)break;await new Promise(r=>setTimeout(r,25));}const s=__poseDebug.S;return{visible:s.panoramaDome.visible,tint:s.panoramaDome.material.color.getHexString(),connected:!!s.project.scene.panoramaData};})()`);
  assert.equal(history.visible,true);assert.equal(history.tint,'0000ff');assert.equal(history.connected,true);assert.deepEqual(errors,[]);
  const actorColor=await ev(`(()=>{document.querySelector('[data-dt-select="actor"]').click();const input=document.querySelector('[data-dt-color="角色颜色"]');input.value='#f75353';input.dispatchEvent(new Event('input',{bubbles:true}));const s=__poseDebug.S,colors=[];s.sceneObjects.get('actor').traverse(c=>{if(c.isMesh&&c.material)colors.push(c.material.color.getHexString());});return{saved:s.project.objects.find(o=>o.id==='actor').color,colors,sky:s.project.scene.panoramaTint};})()`);
  assert.equal(actorColor.saved,'#f75353');assert.ok(actorColor.colors.length);assert.ok(actorColor.colors.every(c=>c==='f75353'));assert.equal(actorColor.sky,'#0000ff');
  await ev(`(async()=>{CanvasFlowDirector.close();await new Promise(r=>setTimeout(r,250));await CanvasFlowDirector.open(document.getElementById('rigNode'));for(let i=0;i<100;i++){if(__poseDebug.S.panoramaDome.visible)break;await new Promise(r=>setTimeout(r,25));}document.querySelector('[aria-label="天空颜色"]').scrollIntoView({block:'center'});document.getElementById('rigSettle').click();})()`);
  const out=path.resolve('preview/sky-color-fix-20261008');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({result,reopened,pano,tintReopen,history,actorColor,errors},null,2));
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'tinted-panorama.png'),Buffer.from(shot.result.data,'base64'));console.log('PASS: labeled sky color; input-only GPU preview with and without panorama; texture retained; hex synchronization; reopen and history tint');
 }finally{ws.close();clearTimeout(timeout);}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
