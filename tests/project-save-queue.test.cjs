const test=require('node:test'),assert=require('node:assert/strict');
const Queue=require('../project-save-queue.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
test('serializes project saves and coalesces pending edits using the accepted revision',async()=>{
 const first=deferred(),requests=[];
 const queue=Queue.create({send:async(id,payload)=>{requests.push(payload);return requests.length===1?first.promise:{project:{revision:3}};}});
 const a=queue.enqueue('p',{revision:1,title:'first'}),b=queue.enqueue('p',{revision:1,title:'middle'}),c=queue.enqueue('p',{revision:1,title:'latest'});
 assert.equal(requests.length,1);first.resolve({project:{revision:2}});await Promise.all([a,b,c]);
 assert.equal(requests.length,2);assert.equal(requests[1].revision,2);assert.equal(requests[1].title,'latest');
});
test('409 preserves pending local work and never retries against another editor revision',async()=>{
 const request=deferred();let calls=0,conflicts=0;
 const queue=Queue.create({send:()=>{calls++;return request.promise;},onConflict:()=>conflicts++});
 const first=queue.enqueue('p',{revision:1}),second=queue.enqueue('p',{revision:1,title:'latest'});
 request.reject(Object.assign(new Error('conflict'),{status:409,payload:{revision:99}}));await Promise.all([first,second]);
 await queue.enqueue('p',{revision:99});assert.equal(calls,1);assert.equal(conflicts,1);assert.equal(queue.blocked('p'),true);
 assert.equal(queue.reset('p',99),true);assert.equal(queue.blocked('p'),false);
});
test('project queues are independent and snapshots cannot be changed after submission',async()=>{
 const first=deferred(),requests=[];const queue=Queue.create({send:async(id,payload)=>{requests.push({id,payload});return id==='p'?first.promise:{project:{revision:2}};}});
 const payload={revision:1,nodes:[{copy:'original'}]};const p=queue.enqueue('p',payload);payload.nodes[0].copy='changed';
 await queue.enqueue('q',{revision:1});assert.equal(requests[0].payload.nodes[0].copy,'original');assert.equal(requests.length,2);
 first.resolve({project:{revision:2}});await p;
});
test('network failure does not prevent subsequent pending edits from being saved',async()=>{
 const first=deferred();let calls=0;const queue=Queue.create({send:async()=>++calls===1?first.promise:{project:{revision:2}}});
 const a=queue.enqueue('p',{revision:1}),b=queue.enqueue('p',{revision:1,title:'retry'});first.reject(new Error('offline'));
 assert.equal(await a,null);assert.equal((await b).project.revision,2);await tick();assert.equal(queue.blocked('p'),false);
});

test('discarding a deleted project drops queued writes and blocks delayed autosaves',async()=>{
 const first=deferred();let calls=0;
 const queue=Queue.create({send:()=>{calls++;return first.promise;}});
 const running=queue.enqueue('deleted',{revision:1}),pending=queue.enqueue('deleted',{revision:1,title:'late'});
 queue.discard('deleted');assert.equal(await pending,null);
 assert.equal(await queue.enqueue('deleted',{revision:2,title:'after delete'}),null);
 first.resolve({project:{revision:2}});await running;await tick();assert.equal(calls,1);
 assert.equal(queue.blocked('deleted'),true);
});
