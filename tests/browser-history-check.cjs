// Isolated browser coverage of the panorama generation-history dialog.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const timeout=setTimeout(()=>process.exit(1),60000),targets=await(await fetch('http://127.0.0.1:9337/json')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const send=(method,params={})=>new Promise(r=>{const key=++id;pending.set(key,r);ws.send(JSON.stringify({id:key,method,params}));});
 const ev=async expression=>{const m=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.error||m.result?.exceptionDetails)throw Error(JSON.stringify(m.error||m.result.exceptionDetails));return m.result.result.value;};
 const out=path.resolve('preview/panorama-history-20261009');fs.mkdirSync(out,{recursive:true});
 const ready=`(async()=>{for(let i=0;i<100;i++){const grid=document.querySelector('#dtPanoHistory');if(grid&&grid.getAttribute('aria-busy')==='false')return;await new Promise(r=>setTimeout(r,20));}throw Error('history not ready');})()`;
 const open=async()=>{await ev(`document.querySelector('[data-dt-pano-history]').click()`);await ev(ready);};
 const snapshot=()=>ev(`(()=>{const box=document.querySelector('.dt-history-dialog'),r=box.getBoundingClientRect();return{rect:{x:r.x,y:r.y,width:r.width,height:r.height},count:Number(box.querySelector('[data-dt-history-count]').textContent),names:[...box.querySelectorAll('.dt-history-name')].map(x=>x.textContent),disabled:box.querySelector('[data-dt-history-confirm]').disabled,text:box.textContent};})()`);
 const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.result.data,'base64'));};
 try{
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:852,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5173/_director_rig_test.html'});await new Promise(r=>setTimeout(r,500));await send('Runtime.enable');
  await ev(`(async()=>{for(let i=0;i<100;i++){if(window.CanvasFlowDirector){await CanvasFlowDirector.open(document.getElementById('rigNode'));return;}await new Promise(r=>setTimeout(r,100));}throw Error('timeout');})()`);
  await ev(`document.querySelector('[data-dt-sbrail="pano"]').click();document.getElementById('rigSettle').click();`);
  await open();const empty=await snapshot();assert.equal(empty.count,0);assert.equal(empty.disabled,true);assert.ok(empty.text.includes('暂无历史记录'));assert.ok(empty.rect.width>1100);await shot('empty-history');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  assert.equal(await ev(`!!document.querySelector('.dt-history-dialog')`),false);assert.equal(await ev(`__poseDebug.S.open`),true);
  await ev(`(()=>{const image=color=>{const c=document.createElement('canvas');c.width=300;c.height=150;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,300,150);return c.toDataURL('image/png');};window.historySamples=[{id:'a',data:image('#7894b9'),name:'本画布 · 山间天空',projectIds:['p'],rating:5,createdAt:1000},{id:'b',data:image('#ad837b'),name:'其他画布 · 暮色',projectIds:['q'],rating:3,createdAt:2000},{id:'c',data:image('#82a391'),name:'本画布 · 新全景',projectIds:['p'],rating:0,createdAt:3000}];window.CanvasFlowDirectorGetImageHistory=async()=>({currentProjectId:'p',items:historySamples});window.beforeHistory=JSON.stringify(__poseDebug.S.project.scene);})()`);
  await open();const populated=await snapshot();assert.equal(populated.count,3);assert.equal(populated.names[0],'本画布 · 新全景');
  await ev(`document.querySelector('[data-dt-history-item="0"]').click()`);assert.equal((await snapshot()).disabled,false);assert.equal(await ev(`JSON.stringify(__poseDebug.S.project.scene)===beforeHistory`),true);
  await shot('populated-history');await ev(`document.querySelector('.dt-history-footer [data-dt-history-close]').click()`);assert.equal(await ev(`JSON.stringify(__poseDebug.S.project.scene)===beforeHistory`),true);
  await open();await ev(`document.querySelector('[data-dt-history-scope="current"]').click()`);assert.equal((await snapshot()).count,2);
  await ev(`(()=>{const s=document.querySelector('[data-dt-history-rating]');s.value='5';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);assert.deepEqual((await snapshot()).names,['本画布 · 山间天空']);
  await ev(`(()=>{const s=document.querySelector('[data-dt-history-rating]');s.value='all';s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-dt-history-scope="all"]').click();document.querySelector('[data-dt-history-sort]').click();const size=document.querySelector('[data-dt-history-size]');size.value='260';size.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const sorted=await snapshot();assert.equal(sorted.names[0],'本画布 · 山间天空');assert.equal(await ev(`document.querySelector('.dt-history-grid').style.getPropertyValue('--dt-history-size')`),'260px');
  await ev(`document.querySelector('[data-dt-history-item="1"]').click();document.querySelector('[data-dt-history-scope="current"]').click()`);assert.equal((await snapshot()).disabled,true);
  await ev(`document.querySelector('[data-dt-history-close]').click();window.CanvasFlowDirectorGetImageHistory=async()=>{throw Error('offline')}`);await open();assert.equal(await ev(`document.querySelector('[data-dt-history-error]').hidden`),false);
  await ev(`window.CanvasFlowDirectorGetImageHistory=async()=>({currentProjectId:'p',items:historySamples});document.querySelector('[data-dt-history-retry]').click()`);await ev(ready);assert.equal((await snapshot()).count,3);
  // Trap focus within the modal and prevent editor WASD movement.
  await ev(`document.querySelector('[data-dt-history-confirm]').disabled=false;document.querySelector('[data-dt-history-confirm]').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});assert.equal(await ev(`document.activeElement.hasAttribute('data-dt-history-size')`),true);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});assert.equal(await ev(`__poseDebug.S.keyNudges.size`),0);
  await ev(`__poseDebug.S.project.scene.panoramaTint='#336699';document.querySelector('[data-dt-history-item="0"]').click();document.querySelector('[data-dt-history-confirm]').click()`);
  const applied=await ev(`(async()=>{for(let i=0;i<100;i++){if(!document.querySelector('.dt-history-dialog'))break;await new Promise(r=>setTimeout(r,20));}const s=__poseDebug.S;return{closed:!document.querySelector('.dt-history-dialog'),visible:s.panoramaDome.visible,name:s.project.scene.panoramaName,source:s.project.scene.panoramaData,tint:s.panoramaDome.material.color.getHexString()};})()`);
  assert.equal(applied.closed,true);assert.equal(applied.visible,true);assert.equal(applied.name,'本画布 · 新全景');assert.equal(applied.tint,'336699');assert.ok(applied.source.startsWith('data:image/png'));
  await ev(`window.CanvasFlowDirectorGetImageHistory=async()=>({currentProjectId:'p',items:[{id:'broken',data:'/missing-history-image.png',name:'失效图片',projectIds:['p'],createdAt:Date.now()+1000,rating:0}]});`);await open();
  await ev(`document.querySelector('[data-dt-history-item="0"]').click();document.querySelector('[data-dt-history-confirm]').click()`);
  const failed=await ev(`(async()=>{for(let i=0;i<100;i++){if(!document.querySelector('[data-dt-history-confirm]').disabled)break;await new Promise(r=>setTimeout(r,20));}return{open:!!document.querySelector('.dt-history-dialog'),error:document.querySelector('[data-dt-history-error]').textContent,source:__poseDebug.S.project.scene.panoramaData};})()`);
  assert.equal(failed.open,true);assert.ok(failed.error.includes('图片应用失败'));assert.equal(failed.source,applied.source);await ev(`document.querySelector('[data-dt-history-close]').click();window.CanvasFlowDirectorGetImageHistory=async()=>({currentProjectId:'p',items:historySamples});`);await open();
  await ev(`(()=>{const s=__poseDebug.S,p=s.three.TextureLoader.prototype,original=p.loadAsync,texture=s.panoramaDome.material.map.clone();window.cancelledTextureDisposed=false;texture.dispose=()=>window.cancelledTextureDisposed=true;p.loadAsync=()=>new Promise(r=>window.finishApply=()=>{p.loadAsync=original;r(texture)});document.querySelector('[data-dt-history-item="1"]').click();document.querySelector('[data-dt-history-confirm]').click();document.querySelector('[data-dt-history-close]').click();window.finishApply();})()`);
  await new Promise(r=>setTimeout(r,20));assert.equal(await ev(`__poseDebug.S.project.scene.panoramaData`),applied.source);assert.equal(await ev(`cancelledTextureDisposed`),true);
  await ev(`window.CanvasFlowDirectorGetImageHistory=()=>new Promise(r=>window.finishHistory=r);document.querySelector('[data-dt-pano-history]').click();document.querySelector('[data-dt-history-close]').click();window.finishHistory({currentProjectId:'elsewhere',items:[]});`);
  assert.equal(await ev(`!!document.querySelector('.dt-history-dialog')`),false);
  await ev(`window.CanvasFlowDirectorGetImageHistory=async()=>({currentProjectId:'p',items:historySamples});`);await open();
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});const mobile=await snapshot();assert.ok(mobile.rect.x>=0);assert.ok(mobile.rect.x+mobile.rect.width<=390);assert.ok(mobile.rect.y+mobile.rect.height<=844);await shot('mobile-history');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({empty,populated,sorted,applied,failed,mobile,errors},null,2));console.log('PASS: empty/modal layout, scope/rating/sort/density, single selection, cancel, confirm, sky tint, retry, failed images, cancelled applications, focus, Escape, stale requests, mobile bounds');
 }finally{ws.close();clearTimeout(timeout);}
}
main().catch(e=>{console.error(e);process.exit(1);});
