// Run against an isolated headless Chrome: CDP_URL=http://127.0.0.1:9337
// and a local static server on PORT (default 5173). No account or user project needed.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
async function main() {
  const timeout = setTimeout(() => { console.error('Browser verification timed out'); process.exit(1); },60000);
  const targets = await (await fetch((process.env.CDP_URL || 'http://127.0.0.1:9337') + '/json')).json();
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const key = ++id; pending.set(key, resolve); ws.send(JSON.stringify({id:key,method,params}));
  });
  const evaluate = async expression => {
    const m = await send('Runtime.evaluate', {expression,awaitPromise:true,returnByValue:true});
    if (m.error || m.result?.exceptionDetails) throw new Error(JSON.stringify(m.error || m.result.exceptionDetails));
    return m.result.result.value;
  };
  try {
    await send('Page.navigate', {url:`http://127.0.0.1:${process.env.PORT || 5173}/_director_rig_test.html`});
    await new Promise(resolve=>setTimeout(resolve,500));
    await send('Runtime.enable');
    await evaluate(`(async()=>{for(let i=0;i<100;i++){if(window.CanvasFlowDirector){await CanvasFlowDirector.open(document.getElementById('rigNode'));return true;}await new Promise(r=>setTimeout(r,100));}throw Error('editor unavailable');})()`);
    const report = await evaluate(`(async()=>{
      const results=[];
      const snapshot=()=>{const s=__poseDebug.S,r=s.rigs.get('actor');s.scene.updateMatrixWorld(true);return {controls:s.project.objects.find(o=>o.id==='actor').poseControls,bones:r.bones.size,joints:Object.fromEntries([...r.bones].map(([name,b])=>[name,{position:b.getWorldPosition(new s.three.Vector3()).toArray(),rotation:b.quaternion.toArray()}]))};};
      for(const id of ['stand','think','kneel-one','kneel-two','wave','reach']){
        document.querySelector('[data-dt-select="actor"]').click();
        document.querySelector('[data-dt-ctab="pose"]').click();
        const button=document.querySelector('[data-dt-pose="'+id+'"]');
        if(!button)throw Error('preset button unavailable: '+id);
        button.click();const before=snapshot();
        CanvasFlowDirector.close();await new Promise(resolve=>setTimeout(resolve,250));await CanvasFlowDirector.open(document.getElementById('rigNode'));
        const after=snapshot();results.push({id,bonesBefore:before.bones,bonesAfter:after.bones,sameControls:JSON.stringify(before.controls)===JSON.stringify(after.controls),sameJoints:JSON.stringify(before.joints)===JSON.stringify(after.joints),axes:after.controls._rigAxes});
      }
      document.getElementById('rigSide').click();
      return results;
    })()`);
    for (const result of report) {
      assert.equal(result.bonesBefore,41,result.id); assert.equal(result.bonesAfter,41,result.id);
      assert.equal(result.axes,3,result.id); assert.equal(result.sameControls,true,result.id);
      assert.equal(result.sameJoints,true,result.id);
    }
    assert.deepEqual(errors,[],'browser exceptions');
    const out = path.resolve('preview/pose-fix-20261008'); fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'save-reopen.json'),JSON.stringify(report,null,2));
    for (const {id} of report) for (const side of ['Front','Side']) {
      await evaluate(`(()=>{document.querySelector('[data-dt-select="actor"]').click();document.querySelector('[data-dt-ctab="pose"]').click();document.querySelector('[data-dt-pose="${id}"]').click();document.getElementById('rig${side}').click();document.getElementById('rigSettle').click();const s=__poseDebug.S;s.renderer.render(s.scene,s.camera);})()`);
      const screenshot = await send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(out,`${id}-${side.toLowerCase()}.png`),Buffer.from(screenshot.result.data,'base64'));
    }
    assert.deepEqual(errors,[],'browser exceptions during screenshots');
    console.log(JSON.stringify(report,null,2));
  } finally { ws.close(); clearTimeout(timeout); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
