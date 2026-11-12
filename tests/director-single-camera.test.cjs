const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const director=fs.readFileSync('director.js','utf8'),timeline=fs.readFileSync('director-timeline.js','utf8');
function setup(){
 const actor={id:'actor',kind:'character'},a={id:'a',kind:'camera'},b={id:'b',kind:'camera'};
 const S={viewMode:'director',playhead:0,previewCameraId:'a',project:{activeCameraId:'b',objects:[actor,a,b],cameraTrack:{clips:[{cameraId:'a',startFrame:0,endFrame:48},{cameraId:'b',startFrame:48,endFrame:96}]},objectAnimationTracks:[{objectId:'actor'},{objectId:'a'},{objectId:'b'}]}};
 const scope={S};const start=director.indexOf('  function activeCameraObj('),end=director.indexOf('\n  }',start)+4;vm.runInNewContext(director.slice(start,end),scope);
 scope.h={activeCameraObj:scope.activeCameraObj};scope.trackOf=id=>S.project.objectAnimationTracks.find(t=>t.objectId===id);
 const ts=timeline.indexOf('function timelineObjects('),te=timeline.indexOf('\n}',ts)+2;vm.runInNewContext(timeline.slice(ts,te),scope);
 return {S,scope,a,b};
}
test('inspector-selected camera stays the source at every frame, during playback and during export',()=>{
 const x=setup();for(const viewMode of ['director','camera','compare'])for(const phase of ['paused','playing','recording'])for(const frame of [0,47,48,95]){
  Object.assign(x.S,{viewMode,playhead:frame,playing:phase==='playing',recording:phase==='recording'});assert.equal(x.scope.activeCameraObj().id,'b');
 }
 x.S.project.activeCameraId='a';assert.equal(x.scope.activeCameraObj().id,'a');
});
test('timeline includes one selected camera while retaining other cameras authored animation data',()=>{
 const x=setup(),saved=JSON.stringify(x.S.project.objectAnimationTracks);
 assert.deepEqual(Array.from(x.scope.timelineObjects(),o=>o.id),['actor','b']);
 x.S.project.activeCameraId='a';assert.deepEqual(Array.from(x.scope.timelineObjects(),o=>o.id),['actor','a']);
 assert.equal(JSON.stringify(x.S.project.objectAnimationTracks),saved);assert.equal(x.S.project.cameraTrack.clips.length,2);
});
test('deleted or unavailable camera falls back safely, and a project without cameras has no camera row',()=>{
 const x=setup();x.S.project.objects=x.S.project.objects.filter(o=>o.id!=='b');assert.equal(x.scope.activeCameraObj().id,'a');
 x.S.project.objects=x.S.project.objects.filter(o=>o.kind!=='camera');assert.equal(x.scope.activeCameraObj(),null);assert.deepEqual(Array.from(x.scope.timelineObjects(),o=>o.id),['actor']);
});
