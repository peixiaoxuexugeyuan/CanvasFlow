const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const acorn=require('../tools/release/node_modules/acorn');
const source=fs.readFileSync(path.join(__dirname,'../director.js'),'utf8');
let definition;
function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id.name==='openBlenderTools')definition=source.slice(node.start,node.end);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
walk(acorn.parse(source,{ecmaVersion:'latest'}));
function setup(){
  const obj={id:'desk',name:'My desk',kind:'geometry',local:true,modelUrl:'old.glb',blenderJobId:'old-job',transform:{position:[2,0,3],rotation:[0,30,0],scale:[2,2,2]}};
  const tracks=[{objectId:'desk',channels:{'position.x':[{frame:0,value:2},{frame:24,value:5}]}}];
  const S={open:true,viewportReady:true,readOnly:false,recording:false,selectedId:'desk',animationEpoch:1,project:{objects:[obj],objectAnimationTracks:tracks},modelProtos:{}};
  const calls={undo:0,rebuilt:0,saves:0};let options,resolve;
  const scope={S,Crowd:{inherited:()=>false},timeline:{trackOf:()=>({locked:false})},window:{openCanvasFlowBlender:o=>{options=o;}},
    addStoredAsset:()=>{},loadStoredPrototype:()=>new Promise(r=>{resolve=r;}),pushUndo:()=>calls.undo++,rebuildObjectMesh:()=>calls.rebuilt++,persist:()=>calls.saves++,refreshTree:()=>{},selectObject:()=>{},toast:()=>{}};
  vm.createContext(scope);vm.runInContext(definition,scope);scope.openBlenderTools();
  return{S,obj,tracks,calls,options,scope,resolve:()=>resolve({scene:'new mesh'})};
}
const asset={object:{modelUrl:'new.glb',blenderJobId:'new-job'}};
test('updating a Blender revision preserves transforms, authored name and animation channels',async()=>{
  const x=setup(),before=JSON.stringify({transform:x.obj.transform,tracks:x.tracks});
  const promise=x.options.replaceAsset(asset);x.resolve();await promise;
  assert.equal(x.obj.modelUrl,'new.glb');assert.equal(x.obj.blenderJobId,'new-job');assert.equal(x.obj.name,'My desk');
  assert.equal(JSON.stringify({transform:x.obj.transform,tracks:x.tracks}),before);assert.deepEqual(x.calls,{undo:1,rebuilt:1,saves:1});
});
test('switching projects while a replacement loads cannot overwrite the new scene',async()=>{
  const x=setup(),promise=x.options.replaceAsset(asset);x.S.project={objects:[]};x.resolve();await assert.rejects(promise,/场景已切换/);
  assert.equal(x.obj.modelUrl,'old.glb');assert.equal(x.calls.undo,0);
});
test('locked objects and animation tracks cannot be replaced',async()=>{
  const x=setup();x.scope.timeline.trackOf=()=>({locked:true});
  await assert.rejects(x.options.replaceAsset(asset),/解锁/);assert.equal(x.obj.modelUrl,'old.glb');assert.equal(x.calls.saves,0);
});
test('locking an object while its replacement loads prevents the late mutation',async()=>{
  const x=setup(),promise=x.options.replaceAsset(asset);x.scope.timeline.trackOf=()=>({locked:true});x.resolve();
  await assert.rejects(promise,/解锁/);assert.equal(x.obj.modelUrl,'old.glb');assert.equal(x.calls.undo,0);
});
test('read-only or uninitialized scenes cannot open modelling tools',()=>{
  const x=setup();let opens=0;x.scope.window.openCanvasFlowBlender=()=>opens++;x.S.viewportReady=false;x.scope.openBlenderTools();
  x.S.viewportReady=true;x.S.readOnly=true;x.scope.openBlenderTools();assert.equal(opens,0);
});
