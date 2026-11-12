const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('director.js','utf8');
test('canvas panorama upload adapter returns only a persisted media URL',async()=>{
  const app=fs.readFileSync('app.js','utf8'),start=app.indexOf('    window.CanvasFlowDirectorUploadPanorama =');
  const scope={window:{},uploadMediaFile:async()=>({url:'/media/saved.png'})};
  vm.runInNewContext(app.slice(start,app.indexOf('    window.CanvasFlowDirectorExport =',start)),scope);
  assert.equal(await scope.window.CanvasFlowDirectorUploadPanorama({}),'/media/saved.png');
  scope.uploadMediaFile=async()=>null;
  await assert.rejects(scope.window.CanvasFlowDirectorUploadPanorama({}),/保存失败/);
});
function setup() {
  const grid = {hidden:true,innerHTML:'',open:false,hasAttribute(){return this.open;},setAttribute(){this.open=true;},removeAttribute(){this.open=false;}};
  const messages=[], loads=[];
  class Color {constructor(value){this.set(value);}set(value){this.value=value;return this;}}
  const S = {open:true,animationEpoch:1,project:{scene:{}},panoramaDome:{userData:{},material:{color:new Color('#ffffff'),map:null},rotation:{},scale:{setScalar(x){this.value=x;}}},el:{shell:{querySelector(selector){return selector==='#dtPanoHistory'?grid:{setAttribute(){}};}}}};
  S.three = {EquirectangularReflectionMapping:303,Color,TextureLoader:class{loadAsync(url){loads.push(url);return Promise.resolve({dispose(){this.disposed=true;}});}}};
  const scope={S,window:{},File:class{},fetch:async()=>({blob:async()=>({type:'image/png'})}),esc:String,pushUndo(){},persist(){},renderInspector(){},refreshPanoHistory(){},toast:m=>messages.push(m)};
  vm.createContext(scope);
  vm.runInContext(source.slice(source.indexOf('  let panoramaRequest = 0;'),source.indexOf('  let panoHistoryDialog = null;')),scope);
  vm.runInContext(source.slice(source.indexOf('  function clearPanorama()'),source.indexOf('  // 当前视角模式下实际参与取景')),scope);
  return {...scope,grid,messages,loads};
}
test('large panorama uses a persisted file reference and remains selectable in history',async()=>{
  const x=setup(),url='data:image/png;base64,'+'a'.repeat(2000000);
  x.window.CanvasFlowDirectorUploadPanorama=async()=>'/media/test.png';
  await x.applyPanoramaData(url,'large.png',{});
  assert.equal(x.S.project.scene.panoramaData,'');assert.equal(x.S.project.scene.panoramaUrl,'/media/test.png');
  assert.equal(x.S.project.scene.panoramaHistory[0].data,'/media/test.png');assert.equal(x.S.panoramaDome.visible,true);
  assert.equal(x.S.project.scene.panoramaHistory[0].name,'large.png');
});
test('failed upload preserves the previously applied panorama',async()=>{
  const x=setup();await x.applyPanoramaData('data:image/png;base64,small','small.png');
  const previous=x.S.panoramaDome.material.map;
  x.window.CanvasFlowDirectorUploadPanorama=async()=>{throw Error('failed');};
  await x.applyPanoramaData('data:image/png;base64,'+'a'.repeat(2000000),'large.png',{});
  assert.equal(x.S.panoramaDome.material.map,previous);assert.equal(x.S.project.scene.panoramaName,'small.png');assert.ok(x.messages.at(-1).includes('失败'));
});
test('clear cancels an inflight import and keeps reusable history',async()=>{
  const x=setup();await x.applyPanoramaData('small','small.png');
  let finish;x.window.CanvasFlowDirectorUploadPanorama=()=>new Promise(r=>finish=r);
  const pending=x.applyPanoramaData('data:image/png;base64,'+'a'.repeat(2000000),'large.png',{});
  await new Promise(r=>setImmediate(r));x.clearPanorama();finish('/media/late.png');await pending;
  assert.equal(x.S.project.scene.panoramaUrl,'');assert.equal(x.S.panoramaDome.visible,false);assert.equal(x.S.project.scene.panoramaHistory.length,1);
});
test('restore reloads a saved file and applies sphere yaw and radius',async()=>{
  const x=setup();x.S.project.scene={panoramaUrl:'/media/saved.png',panoramaYaw:45,panoramaRadius:120};
  x.restorePanorama();await Promise.resolve();
  assert.equal(x.S.panoramaDome.visible,true);assert.equal(x.S.panoramaDome.rotation.y,Math.PI/4);assert.equal(x.S.panoramaDome.scale.value,2);
  x.restorePanorama();assert.equal(x.loads.length,1);
  x.S.project.scene={};x.restorePanorama();assert.equal(x.S.panoramaDome.visible,false);assert.equal(x.S.panoramaDome.material.map,null);
});
test('panorama restore and history reapply retain the chosen sky tint',async()=>{
  const x=setup();x.S.project.scene={panoramaUrl:'/media/saved.png',panoramaTint:'#336699'};
  x.restorePanorama();await Promise.resolve();assert.equal(x.S.panoramaDome.material.color.value,'#336699');
  x.S.project.scene.panoramaTint='#00ff00';x.restorePanorama();assert.equal(x.S.panoramaDome.material.color.value,'#00ff00');assert.equal(x.loads.length,1,'tint change must reuse the texture');
  await x.applyPanoramaData('/media/history.png','history');assert.equal(x.S.panoramaDome.material.color.value,'#00ff00');
});
