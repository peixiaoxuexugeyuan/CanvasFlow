const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('director.js','utf8');
const captureStart = source.indexOf('  function captureNodePreview()');
const captureEnd = source.indexOf('  function toggleFullscreen()', captureStart);
assert.ok(captureStart >= 0 && captureEnd > captureStart, 'Could not locate capture functions');
const body = source.slice(captureStart, captureEnd);
function setup(mode='camera',previs=true){
 const calls=[],draws=[],canvas={width:1200,height:800},S={viewMode:mode,previs:{active:previs},renderer:{domElement:canvas},scene:{},camera:{},rigs:new Map(),nodeEl:{},project:{objects:[],scene:{aspectRatio:'21:9',showLabels:false}}};
 let result;const scope={S,ASPECT_RATIOS:[['21:9',21/9]],cameraAspect:()=>9/16,renderCameraLetterbox:()=>calls.push('camera'),renderCameraScene:()=>calls.push('scene'),document:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage:(...args)=>draws.push(args)}),toDataURL:()=> 'data:image/png;base64,test'})},window:{CanvasFlowDirectorSnapshot:async value=>{result=value;}},toast(){}};
 vm.runInNewContext(body,scope);return{scope,calls,draws,get result(){return result;}};
}
test('portrait camera screenshots and exit covers render the camera letterbox before cropping',async()=>{
 const x=setup();const cover=x.scope.captureNodePreview();assert.deepEqual(x.calls,['camera']);assert.equal(cover.width,450);assert.equal(cover.height,800);assert.deepEqual(x.draws[0].slice(1),[375,0,450,800,0,0,450,800]);
 await x.scope.captureViewport();assert.deepEqual(x.calls,['camera','camera']);assert.equal(x.result.width/x.result.height,9/16);
});
test('scene scheduling screenshots use the whole viewport while director framing remains independent',async()=>{
 const x=setup('director');await x.scope.captureViewport();assert.deepEqual(x.calls,['scene']);assert.equal(x.result.width,1200);assert.equal(x.result.height,800);
 assert.equal(x.scope.captureNodePreview().width,1200);
 const y=setup('director',false);await y.scope.captureViewport();assert.equal(y.result.width,1200);assert.equal(y.result.height,514);
});
