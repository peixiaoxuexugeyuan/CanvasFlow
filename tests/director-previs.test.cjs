const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={window:{}};vm.runInNewContext(fs.readFileSync('director-previs.js','utf8'),scope);
const M=scope.window.DirectorPrevisMath;
test('preview scrubbing clamps fractional pointer positions to valid animation frames',()=>{
 const rect={left:20,width:1200};assert.equal(M.frameAt(-100,rect,360),0);assert.equal(M.frameAt(620,rect,360),180);assert.equal(M.frameAt(9999,rect,360),359);assert.equal(M.frameAt(0,{left:0,width:0},2),0);
});
test('preview ticks stay readable for subsecond, fifteen-second and long zoomed timelines',()=>{
 assert.equal(M.tickStep(15,1200),2);for(const seconds of [.1,1,15,3600])for(const width of [300,1200,7200]){const step=M.tickStep(seconds,width);assert.ok(step>0);assert.ok(seconds/step<=Math.max(2,width/110)+1);}
 assert.equal(M.timecode(15),'00:15');assert.equal(M.timecode(75.999),'01:15');assert.equal(M.timecode(-1),'00:00');
});
const director=fs.readFileSync('director.js','utf8'),start=director.indexOf('  function stepFrame('),end=director.indexOf('  function animate()',start);
function playback(rate,recording=false){const S={playing:true,recording,playhead:0,playbackRate:rate,viewMode:'director',loopWorkArea:false,project:{sequence:{fps:24,durationFrames:360}},el:{},clock:{getDelta:()=>.05}};const ctx={S,window:{},lastPlayheadFloat:0,timeline:{syncPathVisibility(){}},setPlaying:on=>S.playing=on,setPlayhead:f=>S.playhead=f};for(const n of ['sampleAtFrame','renderCompareView','renderCameraLetterbox','renderPrevisFilm','renderDirectorWithAspect','renderCamPreview','syncViewportFields','updateRoleLabels','drawAxisCompass'])ctx[n]=()=>{};vm.runInNewContext(director.slice(start,end),ctx);return{S,ctx};}
test('preview playback rates change wall-clock playback only, with export retaining exact sampled time',()=>{
 for(const rate of M.SPEEDS){const {S,ctx}=playback(rate);ctx.stepFrame(.5);assert.equal(S.playhead,Math.floor(12*rate));}
 const {S,ctx}=playback(2,true);ctx.stepFrame(.5);assert.equal(S.playhead,0);assert.equal(ctx.lastPlayheadFloat,0);
});
test('preview playback stops at the end, or wraps to the work area when looping',()=>{
 const a=playback(2);a.ctx.lastPlayheadFloat=359;a.ctx.stepFrame(.5);assert.equal(a.S.playhead,359);assert.equal(a.S.playing,false);
 const b=playback(2);b.S.loopWorkArea=true;b.S.workArea=[48,95];b.ctx.lastPlayheadFloat=95;b.ctx.stepFrame(.5);assert.equal(b.S.playhead,71);assert.equal(b.S.playing,true);
});
