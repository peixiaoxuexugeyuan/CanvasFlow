const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../director-animation.js');

test('30/60 fps export preserves a 24 fps project and samples smooth fractional frames',()=>{
 const sequence={fps:24,durationFrames:240},original=JSON.stringify(sequence);
 const t={channels:{}};A.putKey(t,'position.x',0,0);A.putKey(t,'position.x',239,10);
 for(const rate of [30,60]){
  const p=A.exportPlan(sequence,[0,239],rate);
  assert.equal(p.count,10*rate);assert.equal(p.seconds,10);
  assert.equal(p.frameAt(1),24/rate);
  assert.ok(Math.abs(A.sampleKeys(t.channels['position.x'],p.frameAt(1))-10*24/rate/239)<1e-12);
  assert.ok(p.frameAt(p.count-1)<240);
 }
 assert.equal(JSON.stringify(sequence),original);
});
test('export uses the inclusive work area while preserving its start time',()=>{
 const p=A.exportPlan({fps:24,durationFrames:240},[24,71],60);
 assert.equal(p.seconds,2);assert.equal(p.count,120);assert.equal(p.frameAt(0),24);
 assert.ok(p.frameAt(119)>71&&p.frameAt(119)<72);
});
test('empty tracks have no animation range; authored transform keys define real bounds',()=>{
 const t={channels:{}};assert.equal(A.trackRange(t),null);
 A.putKey(t,'position.x',24,0);A.putKey(t,'rotation.y',72,90);
 assert.deepEqual(A.trackRange(t),{start:24,end:72});
 assert.deepEqual(A.trackRange(t,[{startFrame:48,endFrame:120}]),{start:24,end:72});
 assert.equal(A.trackRange(null,[{startFrame:12,endFrame:24}]),null);
});
test('long 60 fps sequences retain their duration when reopening',()=>{
 const p=A.migrate({sequence:{fps:60,durationFrames:216000}});
 assert.equal(p.sequence.durationFrames,216000);assert.deepEqual(p.sequence.workArea,[0,215999]);
});

test('director exports sampled frames atomically and restores preview state on completion or cancellation',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync('director.js','utf8');
 const section=source.slice(source.indexOf('  async function toggleRecording('),source.indexOf('  function stopRecording()')).replace(/await import\('\.\/director-video-export\.mjs\?v=[^']+'\)/,'await getEncoder()');
 for(const mode of ['done','cancel','render-error']){
  const cancel=mode==='cancel',failed=mode==='render-error';
  const exports=[],samples=[],hidden={userData:{directorHelper:true},visible:true};let disposed=0;
  const button={classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}};
  class Renderer{constructor(){this.domElement={width:1280,height:720,toDataURL:()=> 'data:image/jpeg;base64,first-frame'};}setPixelRatio(){}setSize(){}setScissorTest(){}setViewport(){}setScissor(){}setClearColor(){}clear(){}render(){assert.equal(hidden.visible,false);if(failed)throw new Error('render failed');}dispose(){disposed++;}forceContextLoss(){}}
  const S={open:true,animationEpoch:1,playhead:5.4,renderer:{},workArea:[0,11],project:{sequence:{fps:24,durationFrames:12},timeline:{exportFps:60},scene:{aspectRatio:'16:9'},objects:[]},el:{recordBtn:button,taskOverlay:{hidden:true,querySelector:()=>button},taskText:{},holder:{clientWidth:1280,clientHeight:720}},three:{WebGLRenderer:Renderer,PerspectiveCamera:class{updateProjectionMatrix(){}}},scene:{traverse:f=>f(hidden)},sceneObjects:new Map()};
  const scope={S,Animation:A,ASPECT_RATIOS:[['16:9',16/9]],VideoEncoder:class{},Blob,toast(){},setPlaying(){},activeCameraObj:()=>({id:'camera'}),syncRenderCameraFromGizmo(){},setPlayhead:(f,opts)=>{S.playhead=f;samples.push({f,fractional:opts?.fractional});},timeline:{renderPaths(){}},window:{CanvasFlowDirectorExport:async data=>exports.push(data)},getEncoder:async()=>({encodeCanvasVideo:async({plan,renderFrame,isCancelled})=>{for(let i=0;i<plan.count;i++){renderFrame(plan.frameAt(i));if(cancel){S.exportState.cancelled=true;assert.equal(isCancelled(),true);throw Object.assign(new Error('cancel'),{name:'AbortError'});}}return {blob:new Blob(['video']),extension:'.mp4',duration:plan.seconds};}})};
  for(const name of ['cameraAspect','renderExportCameraFrame']){const start=source.indexOf('  function '+name+'('),end=source.indexOf('\n  }',start)+4;vm.runInNewContext(source.slice(start,end),scope);}
  vm.runInNewContext(section,scope);await scope.toggleRecording();
  assert.equal(exports.length,cancel||failed?0:1);
  if(!cancel&&!failed){assert.equal(exports[0].posterDataUrl,'data:image/jpeg;base64,first-frame');assert.equal(exports[0].fps,60);assert.equal(exports[0].duration,.5);assert.ok(exports[0].name.endsWith('.mp4'));assert.equal(samples.slice(0,-1).filter(s=>s.fractional).length,30);}
  assert.equal(S.recording,false);assert.equal(S.playhead,5.4);assert.equal(samples.at(-1).fractional,true);assert.equal(hidden.visible,true);assert.equal(disposed,1);assert.equal(S.el.taskOverlay.hidden,true);
 }
});
