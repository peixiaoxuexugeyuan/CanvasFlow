// Isolated Chrome CDP on 9337; project server on 5173. Does not touch user projects.
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
 const out=path.resolve('preview/panorama-fix-20261008');fs.mkdirSync(out,{recursive:true});
 try{
  await send('Page.navigate',{url:'http://127.0.0.1:5173/_director_rig_test.html'});
  await new Promise(r=>setTimeout(r,500));
  await send('Runtime.enable');
  await ev(`(async()=>{for(let i=0;i<100;i++){if(window.CanvasFlowDirector){await CanvasFlowDirector.open(document.getElementById('rigNode'));return;}await new Promise(r=>setTimeout(r,100));}throw Error('timeout');})()`);
  await ev(`(async()=>{for(let i=0;i<100;i++){if(__poseDebug.S.panoramaDome && __poseDebug.S.rigs.has('actor'))return;await new Promise(r=>setTimeout(r,50));}throw Error('viewport initialization failed');})()`);
  console.log('Editor ready');
  const empty=await ev(`(async()=>{document.querySelector('[data-dt-sbrail="pano"]').click();document.querySelector('[data-dt-pano-history]').click();await new Promise(r=>setTimeout(r,20));return {visible:!!document.querySelector('.dt-history-dialog'),text:document.getElementById('dtPanoHistory').textContent};})()`);
  assert.equal(empty.visible,true);assert.ok(empty.text.includes('暂无历史记录'));
  console.log('Empty history opens');await ev(`document.querySelector('[data-dt-history-close]').click()`);
  const length=await ev(`(()=>{const c=document.createElement('canvas');c.width=1024;c.height=1024;const ctx=c.getContext('2d'),p=ctx.createImageData(c.width,c.height);let seed=71;for(let i=0;i<p.data.length;i+=4){for(let k=0;k<3;k++){seed=(Math.imul(seed,1664525)+1013904223)|0;p.data[i+k]=seed>>>24;}p.data[i+3]=255;}ctx.putImageData(p,0,0);window.testPanoData=c.toDataURL('image/png');return testPanoData.length;})()`);
  assert.ok(length>2000000);let data='';for(let offset=0;offset<length;offset+=65536)data+=await ev(`testPanoData.slice(${offset},${offset+65536})`);
  fs.writeFileSync(path.join(out,'large.png'),Buffer.from(data.split(',')[1],'base64'));
  await ev(`window.CanvasFlowDirectorUploadPanorama=async file=>{window.testUploadedSize=file.size;return '/preview/panorama-fix-20261008/large.png';};`);
  const imported=await ev(`(async()=>{
   const blob=await(await fetch(testPanoData)).blob(),file=new File([blob],'large-panorama.png',{type:'image/png'});
   const create=document.createElement.bind(document);document.createElement=function(tag,...args){const el=create(tag,...args);if(tag==='input')el.click=function(){Object.defineProperty(el,'files',{value:[file]});el.onchange();};return el;};
   try{document.querySelector('[data-dt-pano-local]').click();}finally{document.createElement=create;}
   for(let i=0;i<200;i++){if(__poseDebug.S.project.scene.panoramaUrl)break;await new Promise(r=>setTimeout(r,25));}
   const s=__poseDebug.S;return {url:s.project.scene.panoramaUrl,history:s.project.scene.panoramaHistory?.length,status:document.getElementById('dtInspector').textContent,thumb:!!document.querySelector('.dt-pano-current'),size:window.testUploadedSize,visible:s.panoramaDome.visible};
  })()`);
  assert.equal(imported.url,'/preview/panorama-fix-20261008/large.png');assert.equal(imported.history,1);assert.ok(imported.status.includes('已连接全景图'));assert.equal(imported.thumb,true);assert.equal(imported.visible,true);assert.ok(imported.size>1500000);
  await ev(`document.querySelector('[data-dt-panorama-clear]').click();`);
  assert.equal(await ev(`__poseDebug.S.panoramaDome.visible`),false);
  await ev(`(async()=>{document.querySelector('[data-dt-pano-history]').click();await new Promise(r=>setTimeout(r,20));document.querySelector('[data-dt-history-item]').click();document.querySelector('[data-dt-history-confirm]').click();})()`);
  await ev(`(async()=>{for(let i=0;i<100;i++){if(__poseDebug.S.panoramaDome.visible)return;await new Promise(r=>setTimeout(r,25));}throw Error('history failed');})()`);
  const saved=await ev(`(async()=>{__poseDebug.S.project.scene.panoramaYaw=45;__poseDebug.S.project.scene.panoramaRadius=120;CanvasFlowDirector.close();await new Promise(r=>setTimeout(r,250));await CanvasFlowDirector.open(document.getElementById('rigNode'));for(let i=0;i<100;i++){if(__poseDebug.S.panoramaDome.visible)break;await new Promise(r=>setTimeout(r,25));}const s=__poseDebug.S;document.querySelector('[data-dt-sbrail="pano"]').click();document.querySelector('[data-dt-pano-history]').click();await new Promise(r=>setTimeout(r,20));return {visible:s.panoramaDome.visible,url:s.project.scene.panoramaUrl,history:document.querySelectorAll('[data-dt-history-item]').length,status:document.getElementById('dtInspector').textContent,yaw:s.panoramaDome.rotation.y,radius:s.panoramaDome.scale.x};})()`);
  assert.equal(saved.visible,true);assert.equal(saved.url,imported.url);assert.equal(saved.history,1);assert.ok(saved.status.includes('已连接全景图'));assert.equal(saved.yaw,Math.PI/4);assert.equal(saved.radius,2);
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'reopened.png'),Buffer.from(shot.result.data,'base64'));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({empty,imported,saved,errors},null,2));console.log('PASS: large import, connected thumbnail, empty history, history reapply, saved reopen, yaw/radius');
 }finally{ws.close();clearTimeout(timeout);}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
