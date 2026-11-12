const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('director.js','utf8');
const ratios=[['自适应',0],['21:9',21/9],['16:9',16/9],['4:3',4/3],['1:1',1],['3:4',3/4],['9:16',9/16]];
function setup(){
 const a={id:'a',kind:'camera',aspectRatio:'16:9'},b={id:'b',kind:'camera',aspectRatio:'1:1'};
 const S={project:{scene:{aspectRatio:'21:9'},objects:[a,b],cameras:[{...a},{...b}]},selectedId:'a',el:{holder:{clientWidth:900,clientHeight:600}}};
 const history=[],saved=[];
 const scope={S,ASPECT_RATIOS:ratios,activeCameraObj:()=>a,pushUndo:()=>history.push(JSON.stringify(S.project)),persist:()=>saved.push(JSON.stringify(S.project)),updateAspectFrame(){},syncAspectFrameLabel(){},syncAspectGrid(){},renderCamPreview(){},toast(){}};
 for(const name of ['migrateCameraAspects','cameraAspect','setAspect','setCameraAspect','renderExportCameraFrame']){
  const start=source.indexOf('  function '+name+'('),end=source.indexOf('\n  }',start)+4;
  vm.runInNewContext(source.slice(start,end),scope);
 }
 return {S,a,b,scope,history,saved};
}
test('director framing and each camera ratio are independent, including saved project and undo snapshots',()=>{
 const x=setup();x.scope.setCameraAspect('9:16');
 assert.equal(x.a.aspectRatio,'9:16');assert.equal(x.b.aspectRatio,'1:1');assert.equal(x.S.project.scene.aspectRatio,'21:9');
 assert.equal(JSON.parse(x.saved.at(-1)).cameras[0].aspectRatio,'9:16');
 assert.equal(JSON.parse(x.history[0]).objects[0].aspectRatio,'16:9');
 x.scope.setAspect('3:4');assert.equal(x.a.aspectRatio,'9:16');assert.equal(x.b.aspectRatio,'1:1');
 assert.equal(x.scope.cameraAspect(x.a),9/16);assert.equal(x.scope.cameraAspect(x.b),1);
 x.S.selectedId='b';x.scope.setCameraAspect('4:3');assert.equal(x.a.aspectRatio,'9:16');assert.equal(x.b.aspectRatio,'4:3');
 x.scope.setCameraAspect('invalid');assert.equal(x.b.aspectRatio,'4:3');
 x.b.aspectRatio='自适应';assert.equal(x.scope.cameraAspect(x.b),1.5);x.scope.setAspect('1:1');assert.equal(x.scope.cameraAspect(x.b),1.5);
});
test('old shared output ratios migrate once without overwriting existing per-camera settings',()=>{
 const x=setup(),project={scene:{aspectRatio:'3:4'},objects:[{kind:'camera',id:'old'},{kind:'camera',id:'custom',aspectRatio:'9:16'},{kind:'character',id:'actor'}],cameras:[{id:'old'}]};
 x.scope.migrateCameraAspects(project);assert.equal(project.objects[0].aspectRatio,'3:4');assert.equal(project.cameras[0].aspectRatio,'3:4');assert.equal(project.objects[1].aspectRatio,'9:16');assert.equal(project.objects[2].aspectRatio,undefined);
 project.scene.aspectRatio='21:9';x.scope.migrateCameraAspects(project);assert.equal(project.objects[0].aspectRatio,'3:4');
});
test('video cuts keep each camera projection and fit their frame into fixed output dimensions',()=>{
 const x=setup(),calls=[];const renderer={setScissorTest:v=>calls.push(['scissor',v]),setViewport:(...a)=>calls.push(['viewport',...a]),setScissor:(...a)=>calls.push(['frame',...a]),setClearColor(){},clear(){},render(scene,camera){assert.equal(camera.aspect,9/16);}};
 const camera={updateProjectionMatrix(){}};x.a.aspectRatio='9:16';x.scope.renderExportCameraFrame(renderer,camera,x.a,1280,720);
 assert.deepEqual(calls.find(c=>c[0]==='frame'),['frame',437.5,0,405,720]);assert.deepEqual(calls.at(-1),['viewport',0,0,1280,720]);assert.deepEqual(calls.at(-2),['scissor',false]);
 renderer.render=()=>{throw Error('GPU failure')};assert.throws(()=>x.scope.renderExportCameraFrame(renderer,camera,x.b,720,1280),/GPU failure/);assert.deepEqual(calls.at(-1),['viewport',0,0,720,1280]);
});
