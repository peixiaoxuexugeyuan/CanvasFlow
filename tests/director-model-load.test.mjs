import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Exercise the production load gate with deferred GLTF loads, without network/DOM mocks.
const source=fs.readFileSync('director.js','utf8');
const start=source.indexOf('    const samLoads = new Map();');
const end=source.indexOf('\n    bindViewportEvents();',start);
assert.ok(start>0&&end>start);
function setup(objects){
 const requests=[],rebuilt=[],messages=[];
 const S={open:true,animationEpoch:7,project:{objects},modelProtos:{},sceneObjects:new Map()};
 const scope={S,viewportEpoch:7,base:'/',SAM_MODELS:{sam:{file:'sam.glb'},female:{file:'female.glb'},child:{file:'child.glb'}},loader:{loadAsync(url){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});requests.push({url,resolve,reject});return promise;}},rebuildObjectMesh:o=>rebuilt.push(o.id),toast:x=>messages.push(x),console:{warn(){}}};
 const run=vm.runInNewContext('(async()=>{'+source.slice(start,end)+'})',scope);
 return{S,requests,rebuilt,messages,run,resolve(key){requests.findLast(r=>r.url===`/${key}.glb?v=sam1`).resolve({body:key});}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('scene open waits for authored SAM bodies but not unused background body types',async()=>{
 const x=setup([{id:'male',kind:'character',bodyType:'sam'},{id:'female',kind:'character',bodyType:'female'}]);
 let settled=false;const ready=x.run().then(()=>{settled=true;});
 assert.equal(x.requests.length,1);x.resolve('sam');await tick();assert.equal(settled,false);assert.equal(x.requests.length,2);
 x.resolve('female');await ready;assert.equal(settled,true);assert.equal(x.S.modelProtos.sam.body,'sam');assert.equal(x.S.modelProtos.female.body,'female');assert.equal(x.messages.length,0);assert.deepEqual(x.rebuilt,[],'must not create objects before the initial parent-first rebuild');
 await tick();x.resolve('child');await tick();assert.equal(x.messages.length,1);
});
test('new empty scene also waits for SAM before adding its default actor',async()=>{
 const x=setup([]);let settled=false;const ready=x.run().then(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);
 x.resolve('sam');await ready;assert.equal(x.S.modelProtos.sam.body,'sam');await tick();x.resolve('female');await tick();x.resolve('child');await tick();
});
test('inflight body loads are deduplicated and stale editor epochs cannot replace rigs',async()=>{
 const x=setup([{id:'a',kind:'character',bodyType:'sam'}]);const ready=x.run();const pending=x.S.loadSamBody('sam');assert.equal(pending,x.S.loadSamBody('sam'));assert.equal(x.requests.length,1);
 x.S.sceneObjects.set('a',{});x.S.animationEpoch++;x.S.open=false;
 x.resolve('sam');await ready;await pending;await tick();assert.equal(x.requests.length,1);assert.equal(Object.keys(x.S.modelProtos).length,0);assert.deepEqual(x.rebuilt,[]);assert.deepEqual(x.messages,[]);
});
test('failed body loads can be explicitly retried, with no false all-bodies-ready message',async()=>{
 const x=setup([{id:'a',kind:'character',bodyType:'sam'}]);const ready=x.run();x.requests[0].reject(new Error('temporary load failure'));await ready;
 assert.equal(x.requests.length,2,'background queue retries a failed required model');x.requests[1].reject(new Error('still unavailable'));await tick();x.resolve('female');await tick();x.resolve('child');await tick();assert.equal(x.messages.length,0);
 const retry=x.S.loadSamBody('sam');assert.equal(x.requests.filter(r=>r.url.includes('sam.glb')).length,3);x.resolve('sam');await retry;assert.equal(x.S.modelProtos.sam.body,'sam');
});
