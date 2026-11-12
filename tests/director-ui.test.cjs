const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('director.js','utf8');
test('browser helpers also publish window APIs in a CommonJS host',()=>{
 for(const [file,key] of [['director-rig.js','DirectorRig'],['director-crowd.js','DirectorCrowd'],['director-animation.js','DirectorAnimation']]){
  const scope={module:{exports:{}}};scope.window=scope;vm.runInNewContext(fs.readFileSync(file,'utf8'),scope);
  assert.equal(scope[key],scope.module.exports,key);
 }
});
function setup(){
 let finish;const messages=[],created=[];
 const S={open:true,animationEpoch:1,project:{objects:[],scene:{},characterTracks:[]},loadSamBody:()=>new Promise(r=>finish=r)};
 const scope={S,SAM_MODELS:{sam:{scale:1.03},female:{scale:.94}},Crowd:{COLORS:['#4f8ef7']},Rig:{AXES_VERSION:3},POSE_PRESETS:[{id:'stand',controls:{_c2:1}}],defaultTransform:()=>({position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}),pushUndo(){},uid:()=>String(created.length),nextName:()=>String(created.length),createSceneObject:o=>created.push(o),persist(){},refreshTree(){},selectObject(){},toast:m=>messages.push(m)};
 vm.runInNewContext(source.slice(source.indexOf('  const CHARACTER_PALETTE ='),source.indexOf('  function showCrowdDialog(')),scope);
 return{...scope,created,messages,resolve:v=>finish(v)};
}
test('add body waits for its prototype, then creates the correct colored actor',async()=>{
 const x=setup(),pending=x.addCharacter('female');assert.equal(x.S.project.objects.length,0);x.resolve({scene:{}});await pending;
 assert.equal(x.created.length,1);assert.equal(x.created[0].bodyType,'female');assert.equal(x.created[0].color,'#4f8ef7');assert.equal(x.created[0].transform.scale[0],.94);assert.equal(x.S.project.characterTracks.length,0);
});
test('failed model load creates no placeholder actor and can be retried',async()=>{
 const x=setup(),pending=x.addCharacter('sam');x.resolve(null);await pending;assert.equal(x.created.length,0);assert.ok(x.messages[0].includes('模型加载失败'));
 const retry=x.addCharacter('sam');x.resolve({scene:{}});await retry;assert.equal(x.created.length,1);
});
test('closed editor cannot receive an actor from an old load request',async()=>{
 const x=setup(),pending=x.addCharacter('sam');x.S.open=false;x.S.animationEpoch++;x.resolve({scene:{}});await pending;assert.equal(x.created.length,0);
});
