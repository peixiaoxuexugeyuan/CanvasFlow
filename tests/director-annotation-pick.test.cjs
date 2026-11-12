const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('director.js','utf8');const start=src.indexOf('  function pickAnnotationObject('),end=src.indexOf('  function bindViewportEvents()',start);
function fixture(){
 const objects=[{id:'actor',name:'角色A',kind:'character'},{id:'cam',name:'机位01',kind:'camera'},{id:'locked',kind:'geometry',locked:true},{id:'hidden',kind:'geometry',visible:false},{id:'group',kind:'group'}];
 const leaves=Object.fromEntries(objects.map(o=>[o.id,{isMesh:true,parent:{userData:{dtObjectId:o.id}},userData:{}}]));let visited=[],rendered=0,selected='',ndc;
 const S={recording:false,previs:{mode:'scene'},project:{objects},scene:{updateMatrixWorld(){}},camera:{updateMatrixWorld(){}},sceneObjects:new Map(objects.map(o=>[o.id,{traverse(fn){fn(leaves[o.id]);}}])),three:{Vector2:class{constructor(x,y){this.x=x;this.y=y;}},Raycaster:class{setFromCamera(v){ndc=v;}intersectObjects(meshes){visited=meshes;return meshes.filter(m=>m===leaves.cam).map(object=>({object}));}}}};
 const ctx={S,Crowd:{inherited(project,id,field){const o=objects.find(o=>o.id===id);return field==='visible'?o.visible!==false:!!o.locked;}},selectObject(id){selected=id;},stepFrame(){rendered++;}};vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);
 return{ctx,S,pick:ctx.pickAnnotationObject,state:()=>({visited,rendered,selected,ndc}),leaves};
}
test('annotation select reaches visible unlocked scene meshes and resolves camera parent ids',()=>{
 const f=fixture();assert.equal(f.pick(150,100,{left:100,top:50,width:100,height:100}),'机位01');const result=f.state();assert.equal(result.selected,'cam');assert.equal(result.rendered,1);assert.equal(result.visited.length,2);assert.equal(result.visited[0],f.leaves.actor);assert.equal(result.visited[1],f.leaves.cam);assert.equal(result.ndc.x,0);assert.equal(result.ndc.y,0);
});
test('recording and finished-film annotation cannot select or mutate underlying scene objects',()=>{
 const f=fixture(),rect={left:0,top:0,width:100,height:100};f.S.recording=true;assert.equal(f.pick(50,50,rect),'');f.S.recording=false;f.S.previs.mode='film';assert.equal(f.pick(50,50,rect),'');assert.equal(f.state().rendered,0);assert.equal(f.state().selected,'');
});
