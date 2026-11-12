const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const body=source.slice(source.indexOf('    function agentApplyImageEffect('),source.indexOf('    function agentApplyEffects('));
test('exported media URLs use the persistent image path without a second binary upload',()=>{
  const calls=[],context={setMediaNodeImageUrl:(...args)=>calls.push(['url',...args]),setMediaNodeImage:(...args)=>calls.push(['data',...args]),attachMediaToImageNode:(...args)=>calls.push(['upload',...args])};
  vm.runInNewContext(body,context);
  context.agentApplyImageEffect('node',{image:'/media/fixture.png',imageName:'Frame',assetId:'asset-1'});
  assert.deepEqual(calls,[['url','node','/media/fixture.png','Frame','asset-1','成片导出']]);
  calls.length=0;
  context.agentApplyImageEffect('node',{image:'data:image/png;base64,ZmFrZQ==',imageName:'Generated'});
  assert.deepEqual(calls.map(c=>c[0]),['data','upload']);
});
