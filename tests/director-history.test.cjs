const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const History=require('../director-history.js');
test('history merges cross-canvas image references and excludes other media',()=>{
 const items=History.collect({currentProjectId:'a',currentNodes:[{id:'live',previewMedia:'/media/shared.png',rating:4,imageHistory:'["old"]'}],
  projects:[{id:'a',nodes:[{id:'stale',previewMedia:'/media/stale.png'}]},{id:'b',nodes:[{id:'shared',previewMedia:'/media/shared.png',rating:4},{type:'audio',previewMedia:'/media/audio.wav'},{videoUrl:'/media/movie.webm'}]}],
  assets:[{id:'old',kind:'image',mediaId:'old.png',createdAt:10},{id:'v',kind:'video',mediaId:'v.webm'}],
  jobs:[{id:'ok',kind:'image',status:'completed',projectId:'b',imageUrl:'/media/job.png',createdAt:20},{id:'fail',kind:'image',status:'failed',imageUrl:'/media/fail.png'}]});
 assert.equal(items.length,3);assert.deepEqual(items.find(i=>i.data==='/media/shared.png').projectIds,['a','b']);
 assert.equal(History.filter(items,{scope:'current',projectId:'a'}).length,2);
 assert.equal(History.filter(items,{scope:'current',projectId:'b'}).length,2);
 assert.equal(History.filter(items,{rating:4}).length,1);
 assert.equal(History.filter(items,{order:'desc'})[0].data,'/media/job.png');
 assert.equal(History.filter(items,{order:'asc'})[0].data,'/media/shared.png');
});
test('history includes director panorama imports and tolerates malformed legacy history',()=>{
 const items=History.collect({projects:[{id:'a',nodes:[{imageHistory:'broken',directorProject:JSON.stringify({scene:{panoramaHistory:[{data:'/media/pano.png',name:'全景',ts:123}]}})},{directorProject:'bad'}]}]});
 assert.equal(items.length,1);assert.equal(items[0].name,'全景');assert.deepEqual(items[0].projectIds,['a']);
});
test('current canvas rating wins after deduplication, with source files and older panoramas included',()=>{
 const items=History.collect({currentProjectId:'current',currentNodes:[{previewMedia:'/media/shared.png',rating:5,imageHistory:'["shared"]'},{fileAsset:'file'},{directorProject:JSON.stringify({scene:{panoramaUrl:'/media/legacy.png',panoramaName:'旧全景'}})}],projects:[{id:'other',nodes:[{previewMedia:'/media/shared.png',rating:1}]},{id:'current',nodes:[]}],assets:[{id:'shared',kind:'image',mediaId:'shared.png',data:'data:image/png;base64,old'},{id:'file',kind:'image',mediaId:'file.png'}]});
 assert.equal(items.length,3);assert.equal(items.find(i=>i.data==='/media/shared.png').rating,5);
 assert.equal(History.filter(items,{scope:'current',projectId:'current'}).length,3);
 assert.equal(items.find(i=>i.data==='/media/legacy.png').name,'旧全景');
});
test('canvas history adapter reads every page, current unsaved nodes, and workspace-only assets',async()=>{
 const app=fs.readFileSync('app.js','utf8'),start=app.indexOf('    window.CanvasFlowDirectorGetImageHistory =');
 const calls=[],scope={window:{DirectorHistory:History},state:{projectId:'current'},nodeSnapshot:()=>[{id:'live',previewMedia:'/media/unsaved.png',rating:5}],api:async url=>{
  calls.push(url);if(url==='/api/projects')return{projects:[{id:'other',nodes:[]}]};
  if(url==='/api/assets')return{workspaceId:'w',assets:[{id:'excluded',workspaceId:'elsewhere',kind:'image',url:'/media/excluded.png'}]};
  const offset=Number(new URL(url,'http://localhost').searchParams.get('offset'));
  return {total:205,jobs:Array.from({length:Math.min(200,205-offset)},(_,i)=>({id:String(i+offset),kind:'image',status:'completed',projectId:'other',imageUrl:'/media/job'+(i+offset)+'.png'}))};
 }};
 vm.runInNewContext(app.slice(start,app.indexOf('    window.CanvasFlowDirectorUploadPanorama =',start)),scope);
 const result=await scope.window.CanvasFlowDirectorGetImageHistory();assert.equal(result.items.length,206);
 assert.equal(result.currentProjectId,'current');assert.equal(result.items.find(i=>i.rating===5).data,'/media/unsaved.png');
 assert.ok(calls.some(u=>u.endsWith('offset=200')));assert.ok(!result.items.some(i=>i.data.includes('excluded')));
 scope.api=async()=>{scope.state.projectId='changed';return{jobs:[],total:0};};
 await assert.rejects(scope.window.CanvasFlowDirectorGetImageHistory(),/画布已切换/);
});
