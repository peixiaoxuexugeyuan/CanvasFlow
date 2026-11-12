/* Local modelling tools; this panel never invokes a language-model API. */
(() => {
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let layer=null;
  window.openCanvasFlowBlender=async ({addAsset,replaceAsset,selectedJobId='',current=()=>true}={})=>{
    if(layer)return;
    const api=(path,options)=>window.CanvasFlowBlenderRequest(path,options);
    const box=document.createElement('div');layer=box;box.className='blender-backdrop';
    box.innerHTML=`<section class="blender-panel" role="dialog" aria-modal="true" aria-label="Blender 本地建模">
      <header><div><h2>Blender 本地建模</h2><p>工具模式 · 在本机执行建模，不调用 AI 接口</p></div><button data-b-close aria-label="关闭 Blender 建模">×</button></header>
      <div class="blender-layout"><form class="blender-editor"><p role="status" data-b-status>正在检测 Blender…</p>
      <details><summary>连接设置</summary><label>Blender 可执行文件<input name="executable" placeholder="自动检测，或填写 blender.exe 的绝对路径"></label><button type="button" data-b-connect>保存并检测连接</button></details>
      <label>模型名称<input name="name" value="我的 Blender 模型" maxlength="120" required></label>
      <label>源工程版本<select name="source"><option value="">新建模型</option></select></label>
      <div class="blender-examples"><button type="button" data-b-example="table">载入书桌示例</button><button type="button" data-b-example="refine">载入书桌修改示例</button></div>
      <fieldset><legend>添加建模操作</legend><label>操作<select name="tool"><option value="create">创建部件</option><option value="update">调整部件</option><option value="bevel">倒角</option><option value="material">材质</option><option value="subdivide">细分</option><option value="smooth">平滑着色</option><option value="boolean">布尔运算</option><option value="remove">移除部件</option></select></label>
      <div class="blender-pair"><label>部件 ID<input name="objectId" value="part-1" list="blender-object-ids"></label><label>形状<select name="shape"><option value="box">方体</option><option value="cylinder">圆柱</option><option value="sphere">球体</option><option value="torus">圆环</option></select></label></div>
      <datalist id="blender-object-ids"></datalist><div class="blender-pair"><label>尺寸：宽、高、深（米）<input name="size" value="1, 1, 1"></label><label>中心位置：X、Y、Z（米）<input name="position" value="0, 0.5, 0"></label></div>
      <div class="blender-pair"><label>颜色<input name="color" type="color" value="#91623e"></label><label>倒角宽度（米）<input name="bevel" type="number" value="0.02" min="0.0001" max="2" step="any"></label></div>
      <label>布尔切割部件 ID<input name="cutter" list="blender-object-ids" placeholder="布尔操作时填写"></label>
      <button type="button" data-b-add>＋ 添加到操作列表</button></fieldset>
      <details class="blender-advanced"><summary>高级工具指令 · <span data-b-count>0</span> 项操作</summary><textarea name="operations" aria-label="Blender 工具指令" spellcheck="false">[]</textarea><p>只接受声明的建模工具，不执行输入的代码。修改时只提交需要变化的部件。</p></details>
      <button class="blender-primary" type="submit" data-b-run disabled>执行建模</button><p data-b-message role="status" aria-live="polite"></p>
      </form><aside class="blender-results"><h3>模型版本</h3><div data-b-jobs>正在加载…</div></aside></div></section>`;
    document.body.appendChild(box);const form=box.querySelector('form'),fields=form.elements;
    const message=box.querySelector('[data-b-message]'),jobsBox=box.querySelector('[data-b-jobs]');
    let jobs=[],examples={},connected=false,loading=false,timer=null;
    const close=()=>{clearTimeout(timer);box.remove();if(layer===box)layer=null;};
    const writeOps=ops=>{fields.operations.value=JSON.stringify(ops,null,2);box.querySelector('[data-b-count]').textContent=ops.length;};
    const sourceChanged=()=>{const job=jobs.find(j=>j.id===fields.source.value);box.querySelector('datalist').innerHTML=(job?.result?.objects||[]).map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');};
    const paint=()=>{
      const source=fields.source.value;fields.source.innerHTML='<option value="">新建模型</option>'+jobs.filter(j=>j.status==='succeeded').map(j=>`<option value="${j.id}">${esc(j.name)}</option>`).join('');fields.source.value=source;sourceChanged();
      jobsBox.innerHTML=jobs.map(job=>`<article class="blender-job"><header><strong>${esc(job.name)}</strong><span>${({queued:'排队中',running:'建模中',succeeded:'已完成',failed:'失败'})[job.status]||esc(job.status)}</span></header>${job.asset?.thumbnail?`<img src="${esc(job.asset.thumbnail)}" alt="${esc(job.name)}模型预览">`:''}${job.error?`<p class="blender-error">${esc(job.error)}</p>`:''}${job.result?`<p>${job.result.objectCount} 个部件 · ${job.result.triangles.toLocaleString()} 个三角面</p>`:''}${job.status==='succeeded'?`<div class="blender-job-actions"><button data-b-source="${job.id}">继续编辑此版本</button>${addAsset?`<button data-b-insert="${job.id}">加入场景</button>`:''}${replaceAsset&&job.sourceJobId===selectedJobId?`<button data-b-replace="${job.id}">更新选中模型</button>`:''}<a href="/api/blender/jobs/${job.id}/download?format=blend&workspace=${encodeURIComponent(job.workspaceId)}" download>下载源工程</a><a href="/api/blender/jobs/${job.id}/download?format=glb&workspace=${encodeURIComponent(job.workspaceId)}" download>下载 GLB</a></div>`:''}</article>`).join('')||'<p>还没有建模任务。完成后会自动保存到素材管理。</p>';
    };
    const refresh=async()=>{
      if(loading||layer!==box)return;loading=true;
      try{const data=await api('/api/blender/jobs');if(layer!==box)return;jobs=data.jobs||[];paint();}
      catch(error){message.textContent=error.message;}
      finally{loading=false;if(layer===box&&jobs.some(j=>['queued','running'].includes(j.status)))timer=setTimeout(refresh,1500);}
    };
    const detect=async()=>{
      try{const status=await api('/api/blender/status');connected=!!status.available;fields.executable.value=status.executable||'';box.querySelector('[data-b-status]').textContent=connected?'已连接 '+status.version:status.error;}
      catch(error){connected=false;box.querySelector('[data-b-status]').textContent=error.message;}
      box.querySelector('[data-b-run]').disabled=!connected;
    };
    box.addEventListener('click',async e=>{
      if(e.target===box||e.target.closest('[data-b-close]')){close();return;}
      const b=e.target.closest('button');if(!b||b.disabled)return;
      try{
        if(b.matches('[data-b-connect]')){b.disabled=true;await api('/api/blender/settings',{method:'PUT',body:JSON.stringify({executable:fields.executable.value})});await detect();}
        if(b.dataset.bExample){const plan=examples[b.dataset.bExample];if(!plan)throw Error('示例尚未加载');if(b.dataset.bExample==='refine'&&!fields.source.value)throw Error('请先选择已完成的书桌源版本');fields.name.value=plan.name;writeOps(plan.operations);message.textContent='示例已载入，点击执行建模开始。';}
        if(b.matches('[data-b-add]')){
          const op={op:fields.tool.value,id:fields.objectId.value.trim()},vec=name=>fields[name].value.split(/[,，\s]+/).filter(Boolean).map(Number);
          if(op.op==='create')Object.assign(op,{shape:fields.shape.value,size:vec('size'),position:vec('position'),color:fields.color.value});
          if(op.op==='update')Object.assign(op,{size:vec('size'),position:vec('position')});
          if(op.op==='bevel')Object.assign(op,{width:Number(fields.bevel.value),segments:5});
          if(op.op==='material')Object.assign(op,{color:fields.color.value,roughness:.45,metallic:0});
          if(op.op==='subdivide')op.levels=1;
          if(op.op==='boolean')Object.assign(op,{toolId:fields.cutter.value.trim(),operation:'DIFFERENCE'});
          const ops=JSON.parse(fields.operations.value);ops.push(op);writeOps(ops);message.textContent='已添加 '+op.op+'：'+op.id;
        }
        if(b.dataset.bSource){fields.source.value=b.dataset.bSource;sourceChanged();writeOps([]);fields.name.value=jobs.find(j=>j.id===b.dataset.bSource).name+' · 修改';message.textContent='源版本已选择，只添加需要修改的操作。';}
        const job=jobs.find(j=>j.id===(b.dataset.bInsert||b.dataset.bReplace));
        if(job){if(!current())throw Error('预演台已切换，请重新打开建模面板');b.disabled=true;await (b.dataset.bReplace?replaceAsset:addAsset)(job.asset);window.dispatchEvent(new Event('canvasflow:3d-assets-changed'));message.textContent=b.dataset.bReplace?'选中模型已更新':'模型已加入场景';}
      }catch(error){message.textContent=error.message;}
      finally{if(b.isConnected)b.disabled=false;}
    });
    fields.source.onchange=sourceChanged;
    form.onsubmit=async e=>{e.preventDefault();const button=box.querySelector('[data-b-run]');if(button.disabled)return;button.disabled=true;
      try{const operations=JSON.parse(fields.operations.value);await api('/api/blender/jobs',{method:'POST',body:JSON.stringify({name:fields.name.value,sourceJobId:fields.source.value,operations})});message.textContent='任务已提交，模型完成后自动保存到素材管理。';clearTimeout(timer);await refresh();}
      catch(error){message.textContent=error.message;}finally{button.disabled=!connected;}
    };
    box.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const list=[...box.querySelectorAll('button:not(:disabled),input,select,textarea,a[href],summary')].filter(el=>el.getClientRects().length);const i=list.indexOf(document.activeElement);if(list.length&&(e.shiftKey?i<=0:i===list.length-1)){e.preventDefault();list[e.shiftKey?list.length-1:0].focus();}}});
    box.querySelector('[data-b-close]').focus();
    await Promise.all([detect(),refresh(),api('/api/blender/examples').then(data=>{examples=data;}).catch(error=>{message.textContent=error.message;})]);
    if(selectedJobId&&jobs.some(j=>j.id===selectedJobId)){fields.source.value=selectedJobId;sourceChanged();}
  };
})();
