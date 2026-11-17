const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const landing={window:{}};vm.runInNewContext(fs.readFileSync('box3d-hub.js','utf8'),landing);
const hub=landing.window.CanvasFlowBox3D;
test('project dates reflect the local day instead of the UTC substring',()=>{
 assert.equal(hub.projectDate('2026-11-15T20:31:00+00:00','Asia/Shanghai'),'2026-11-16');
 assert.equal(hub.projectDate('2026-11-16T01:00:00Z','America/Los_Angeles'),'2026-11-15');
 assert.equal(hub.projectDate('invalid'),'—');assert.equal(hub.projectDate(''),'—');
});
test('3D library filters ordinary canvases and sorts by last update without mutation',()=>{
 const projects=[{id:'old',updatedAt:'2026-01-01',nodes:[{type:'director'}]},{id:'text',nodes:[{type:'text'}]},{id:'new',updatedAt:'2026-10-01',nodes:[{type:'director'}]}];
 assert.equal(hub.listProjects(projects).map(p=>p.id).join(','),'new,old');assert.equal(projects[0].id,'old');
});
test('scene requests retain user intent and selected timing, with reference-only fallback',()=>{
 assert.match(hub.buildPrompt('环绕产品','9:16',12),/环绕产品[\s\S]*9:16[\s\S]*12 秒/);
 assert.match(hub.buildPrompt('','invalid',0),/参考图片[\s\S]*16:9[\s\S]*自动/);
});
const source=fs.readFileSync('app.js','utf8'),flow=source.slice(source.indexOf('    let box3DStarting=false;'),source.indexOf('    function openView(viewName)',source.indexOf('    let box3DStarting=false;')));
function setup(){
 const events=[],node={dataset:{node:'director'}};let options;
 const c={state:{projectId:'old',projectCreationPending:false},agentState:{},navigationEpoch:1,workspace:'a',clearTimeout(){},$(){return{}},$$(){return[node]},workspaceHeader(){return{workspace:c.workspace}},async newProject(){events.push('new');c.state.projectId='new';return'new'},addNode(){events.push('node');return node},async saveProject(){events.push('save');return true},async openProject(id){events.push('open');c.state.projectId=id},openView(v){events.push(v)},window:{CanvasFlowDirector:{async open(n,o){events.push('editor');options=o},sceneStatus(){return{ready:true}}}}};
 vm.createContext(c);vm.runInContext(flow,c);return{c,events,options:()=>options};
}
test('new 3D canvas is persisted before editor opens and launch options are forwarded',async()=>{
 const {c,events,options}=setup();assert.equal(await c.box3DCreate({prompt:'scene',aspect:'9:16',duration:12,modelId:'chosen'}),true);
 assert.deepEqual(events,['new','node','save','editor']);assert.equal(options().prompt,'scene');assert.equal(options().modelId,'chosen');assert.equal(options().workspace,'previs');
 await options().onClose();assert.equal(events.at(-1),'box3d');
});
test('failed save never opens the editor',async()=>{const {c,events}=setup();c.saveProject=async()=>false;await assert.rejects(c.box3DCreate(),/尚未保存/);assert.ok(!events.includes('editor'));});
test('navigation changes during create/save do not steal focus',async()=>{const{c,events}=setup();c.saveProject=async()=>{c.navigationEpoch++;return true};assert.equal(await c.box3DCreate(),false);assert.ok(!events.includes('editor'));});
test('duplicate create is ignored while first project is being saved',async()=>{const{c,events}=setup();let resolve;c.saveProject=()=>new Promise(r=>resolve=r);const first=c.box3DCreate();await Promise.resolve();assert.equal(await c.box3DCreate(),false);resolve(true);await first;assert.equal(events.filter(v=>v==='new').length,1);});
test('existing canvas save failure prevents switching project',async()=>{const{c,events}=setup();c.saveProject=async()=>false;await assert.rejects(c.box3DOpen('another'),/尚未保存/);assert.ok(!events.includes('open'));});
test('return callback respects a workspace changed during save',async()=>{const{c,events,options}=setup();await c.box3DCreate();c.saveProject=async()=>{c.workspace='other';return true};await options().onClose();assert.ok(!events.includes('box3d'));});
