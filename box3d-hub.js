/* 3D-BOX landing page. Project ownership and persistence stay with the canvas. */
(function () {
  'use strict';
  const ASPECTS = ['16:9', '9:16', '4:3', '3:4', '21:9', '1:1'];
  const SUGGESTIONS = ['预演一段城市街头的警匪追车戏', '环绕香水瓶运镜，预演产品广告', '用多个镜头预演古装庭院对峙戏'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const icons = {
    plus: icon('<path d="M12 5v14M5 12h14"/>'),
    box: icon('<path d="m12 3 8 5v8l-8 5-8-5V8Zm-8 5 8 5 8-5M12 13v8"/>'),
    ratio: icon('<rect x="3" y="6" width="18" height="12" rx="2"/>'),
    clock: icon('<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'),
    spark: icon('<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>'),
    upload: icon('<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>'),
    image: icon('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>'),
    more: icon('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>')
  };
  const drafts = new Map();
  let mounted;
  function projectNode(project) { return (project.nodes || []).find(node => node.type === 'director'); }
  function projectDate(value, timeZone) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('sv-SE', timeZone ? {timeZone} : undefined);
  }
  function listProjects(projects) { return projects.filter(projectNode).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))); }
  function buildPrompt(prompt, aspect, duration) {
    return `${prompt.trim() || '根据参考图片搭建可编辑的 3D 场景，并设计镜头运动。'}\n\n预演要求：画幅 ${ASPECTS.includes(aspect)?aspect:'16:9'}；${duration?`总时长 ${duration} 秒`:'请根据内容自动安排合适的镜头时长'}。生成可编辑的场景、角色动作和摄像机运镜。`;
  }
  function unmount() { mounted?.(); mounted = null; }
  function mount(ctx) {
    unmount();
    const draft = drafts.get(ctx.workspaceId) || {prompt:'', aspect:'16:9', duration:0, manualDuration:10, modelId:'', reference:null};
    drafts.set(ctx.workspaceId, draft);
    let listEpoch=0, modelEpoch=0;
    let alive=true, busy=false, models=[], popover=null, anchor=null, dialog=null;
    const host=ctx.host;
    host.innerHTML=`<div class="b3-hub"><header class="b3-top"><span>CanvasFlow 3D-BOX</span><button type="button" data-settings>模型设置</button></header>
      <section class="b3-hero" aria-labelledby="b3-title"><div class="b3-grid-floor" aria-hidden="true"></div>
      <div class="b3-showcase" aria-label="3D 预演展示">${['场景搭建','太空驾驶','电影调度','角色动作','街景预演'].map((name,i)=>`<button type="button" data-showcase="${i}" aria-label="查看${name}示例"><img src="assets/3d-box/showcase-${[3,4,5,1,2][i]}.webp" alt="${name}"/><span>${name} ↗</span></button>`).join('')}</div>
      <h1 id="b3-title">CanvasFlow 3D-BOX · 你的专业影视空间</h1><p class="b3-subtitle">Agent 轻松搭景，精准调度站位，手绘轨迹实现大片级运镜</p>
      <div class="b3-composer-wrap"><form class="b3-composer"><div class="b3-reference" hidden></div><textarea aria-label="描述场景、人物动作和镜头怎么动" placeholder="描述场景、人物动作和镜头怎么动，AI 帮你生成 3D 动画预演" maxlength="12000">${esc(draft.prompt)}</textarea>
      <div class="b3-controls"><div class="b3-tools"><button type="button" class="b3-round" data-pop="attach" aria-label="添加附件" title="添加附件">${icons.plus}</button><button type="button" class="b3-pill b3-model" data-pop="model" aria-label="选择模型">${icons.box}<span>选择模型</span><small>⌄</small></button><button type="button" class="b3-pill" data-pop="aspect" aria-label="画面比例">${icons.ratio}<span>${esc(draft.aspect)}</span></button><button type="button" class="b3-pill" data-pop="duration" aria-label="时长">${icons.clock}<span>${draft.duration?draft.duration+' 秒':'自动'}</span></button></div><button class="b3-generate" type="submit">${icons.spark}<span>生成</span></button></div><div class="b3-status" role="status" hidden></div></form>
      <ul class="b3-suggestions">${SUGGESTIONS.map((text,i)=>`<li><button type="button" data-suggest="${i}"><span aria-hidden="true">↳</span>${text}</button></li>`).join('')}</ul></div></section>
      <section class="b3-library" aria-labelledby="b3-projects-title"><header><h2 id="b3-projects-title">我的 3D-BOX</h2><button type="button" data-refresh aria-label="刷新 3D-BOX 项目">↻</button></header><div class="b3-projects"></div><p class="b3-list-status" role="status">正在读取项目…</p></section></div>`;
    const input=host.querySelector('textarea'),send=host.querySelector('.b3-generate'),status=host.querySelector('.b3-status');
    function report(message) { if(!alive)return;status.textContent=message;status.hidden=!message; }
    function sync() {
      const model=models.find(m=>m.id===draft.modelId);
      host.querySelector('.b3-model span').textContent=model?.name||'选择模型';
      host.querySelector('[data-pop=aspect] span').textContent=draft.aspect;
      host.querySelector('[data-pop=duration] span').textContent=draft.duration?draft.duration+' 秒':'自动';
      send.disabled=busy||!(draft.prompt.trim()||draft.reference);send.querySelector('span').textContent=busy?'正在打开…':'生成';
      const ref=host.querySelector('.b3-reference');ref.hidden=!draft.reference;
      ref.innerHTML=draft.reference?`<img src="${esc(draft.reference.url)}" alt="参考图片"/><span>${esc(draft.reference.name)}</span><button type="button" aria-label="移除参考图片">×</button>`:'';
      if(draft.reference)ref.querySelector('button').onclick=()=>{draft.reference=null;sync();};
    }
    function closePop(focus=false) { popover?.remove();popover=null;anchor?.setAttribute('aria-expanded','false');if(focus)anchor?.focus();anchor=null; }
    function showPop(button,html,kind) {
      if(anchor===button){closePop();return null;}closePop();
      anchor=button;button.setAttribute('aria-expanded','true');popover=document.createElement('div');popover.className='b3-popover b3-pop-'+kind;popover.setAttribute('role','dialog');popover.setAttribute('aria-label',button.getAttribute('aria-label')||'项目操作');popover.innerHTML=html;document.body.append(popover);
      const r=button.getBoundingClientRect(),p=popover.getBoundingClientRect();let top=r.bottom+9;if(top+p.height>innerHeight-12&&r.top>p.height+12)top=r.top-p.height-9;
      popover.style.left=Math.max(12,Math.min(r.left,innerWidth-p.width-12))+'px';popover.style.top=Math.max(12,Math.min(top,innerHeight-p.height-12))+'px';return popover;
    }
    function openDialog(title,content) {
      dialog?.remove();dialog=document.createElement('dialog');dialog.className='b3-dialog';dialog.setAttribute('aria-label',title);dialog.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" aria-label="关闭">×</button></header>${content}`;document.body.append(dialog);dialog.querySelector('header button').onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();dialog=null;};dialog.showModal();return dialog;
    }
    async function loadModels() {
      const epoch=++modelEpoch;
      try {const result=await ctx.listModels();if(!alive||epoch!==modelEpoch)return;models=result.filter(m=>m.checked!==false);if(!models.some(m=>m.id===draft.modelId&&m.enabled&&m.supportsScene))draft.modelId=models.find(m=>m.enabled&&m.supportsScene)?.id||'';sync();}
      catch(error){report('模型读取失败：'+error.message);}
    }
    async function refresh() {
      const epoch=++listEpoch;
      const message=host.querySelector('.b3-list-status');message.textContent='正在读取项目…';
      try {const projects=listProjects(await ctx.listProjects());if(!alive||epoch!==listEpoch)return;
        host.querySelector('.b3-projects').innerHTML=`<article class="b3-project b3-new"><button type="button" data-new aria-label="新建空白 3D-BOX"><div class="b3-project-art b3-blank">${icons.plus}</div><strong>新建空白 3D-BOX</strong></button></article>`+projects.map(p=>{const node=projectNode(p),cover=p.cover||p.coverUrl||node.previewMedia||node.previewData||'';return `<article class="b3-project" data-project-id="${esc(p.id)}"><button type="button" data-open="${esc(p.id)}"><div class="b3-project-art">${cover?`<img src="${esc(cover)}" alt="${esc(p.projectName)}"/>`:`<div class="b3-empty-scene">${icons.box}</div>`}</div><strong>${esc(p.projectName||'未命名 3D-BOX')}</strong><time>${esc(projectDate(p.updatedAt))}</time></button><button type="button" class="b3-more" data-more="${esc(p.id)}" aria-label="${esc(p.projectName)}的更多操作">${icons.more}</button></article>`;}).join('');
        message.textContent=projects.length?'没有更多了':'创建你的第一个 3D 预演项目';
        host.querySelector('[data-new]').onclick=()=>start(true);
        host.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>open(b.dataset.open));
        host.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>{
          const project=projects.find(p=>p.id===b.dataset.more),pop=showPop(b,'<button type="button" data-action="open">打开</button><button type="button" data-action="rename">重命名</button><button type="button" data-action="delete" class="b3-danger">删除</button>','project');if(!pop)return;
          pop.querySelectorAll('[data-action]').forEach(action=>action.onclick=async()=>{closePop();try{if(action.dataset.action==='open')return open(project.id);if(action.dataset.action==='rename')await ctx.rename(project);else await ctx.remove(project);if(alive)await refresh();}catch(error){report(error.message);}});
        });
      }catch(error){if(alive)message.textContent='项目读取失败：'+error.message+'，点击右侧刷新重试';}
    }
    async function open(id) {if(busy)return;busy=true;sync();try{await ctx.open(id);}catch(error){report(error.message);ctx.toast(error.message,'×');}finally{busy=false;if(alive)sync();}}
    async function start(blank=false) {
      if(busy)return;
      if(!blank&&!models.some(m=>m.id===draft.modelId&&m.enabled&&m.supportsScene)){report('请先在模型设置中勾选并启用一个场景调度模型');ctx.settings();return;}
      busy=true;report('');sync();
      try {const success=await ctx.create(blank?{aspect:draft.aspect,duration:draft.duration}:{prompt:buildPrompt(draft.prompt,draft.aspect,draft.duration),title:draft.prompt.trim().slice(0,36),aspect:draft.aspect,duration:draft.duration,modelId:draft.modelId,reference:draft.reference});if(success){draft.prompt='';draft.reference=null;}}
      catch(error){report(error.message);ctx.toast(error.message,'×');}finally{busy=false;if(alive)sync();}
    }
    async function upload(file) {
      if(!file)return;busy=true;sync();report('正在读取参考图片…');
      try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('请选择 10 MB 以内的 PNG、JPEG 或 WebP 图片');const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file);});if(alive){draft.reference={name:file.name,url};report('');}}
      catch(error){report(error.message);}finally{busy=false;if(alive)sync();}
    }
    async function history() {
      closePop();const modal=openDialog('从生成历史选择','<div class="b3-history"><p>正在读取图片…</p></div>');
      try{const materials=await ctx.listMaterials();if(!alive||dialog!==modal)return;const list=modal.querySelector('.b3-history');list.innerHTML=materials.length?materials.map((m,i)=>`<button type="button" data-material="${i}"><img src="${esc(m.thumbnail||m.url||'')}" alt="${esc(m.name)}"/><span>${esc(m.name)}</span></button>`).join(''):'<p>当前工作区还没有图片素材</p>';list.querySelectorAll('button').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const material=await ctx.resolveMaterial(materials[Number(b.dataset.material)]);if(!alive||dialog!==modal)return;if(!material?.url)throw Error('图片已不可用');draft.reference={name:material.name,url:material.url};modal.close();sync();}catch(error){b.disabled=false;ctx.toast(error.message,'×');}});}catch(error){if(dialog===modal)modal.querySelector('.b3-history').textContent=error.message;}
    }
    host.querySelectorAll('[data-pop]').forEach(button=>button.onclick=()=>{
      const kind=button.dataset.pop;let html='';
      if(kind==='attach')html=`<button type="button" data-local>${icons.upload}本地上传</button><button type="button" data-history>${icons.image}从生成历史选择</button>`;
      if(kind==='model')html='<h3>选择模型</h3>'+models.map(m=>`<button type="button" data-model="${esc(m.id)}" ${!m.enabled||!m.supportsScene?'disabled':''}>${icons.box}<span>${esc(m.name)}<small>${esc(m.provider||'')}${!m.enabled?' · 未启用':!m.supportsScene?' · 不支持场景调度':''}</small></span><b>${m.id===draft.modelId?'✓':''}</b></button>`).join('')+(!models.length?'<p>尚未配置预演模型</p>':'')+'<button type="button" data-settings>模型设置 ↗</button>';
      if(kind==='aspect')html='<h3>画面比例</h3><div class="b3-ratios">'+ASPECTS.map(a=>`<button type="button" data-ratio="${a}" aria-pressed="${draft.aspect===a}"><i style="aspect-ratio:${a.replace(':','/')}"></i>${a}</button>`).join('')+'</div>';
      if(kind==='duration')html=`<h3>时长 <output>${draft.duration?draft.duration+' 秒':'自动'}</output></h3><input type="range" aria-label="预演时长（秒）" min="1" max="60" step="1" value="${draft.manualDuration}" ${draft.duration?'':'disabled'}/><div class="b3-auto"><span>Agent 自动匹配</span><button type="button" role="switch" aria-label="Agent 自动匹配" aria-checked="${!draft.duration}"></button></div>`;
      const pop=showPop(button,html,kind);if(!pop)return;
      pop.querySelector('[data-local]')?.addEventListener('click',()=>{closePop();const picker=document.createElement('input');picker.type='file';picker.accept='image/png,image/jpeg,image/webp';picker.onchange=()=>upload(picker.files[0]);picker.click();});
      pop.querySelector('[data-history]')?.addEventListener('click',history);
      pop.querySelector('[data-settings]')?.addEventListener('click',()=>{closePop();ctx.settings();});
      pop.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>{draft.modelId=b.dataset.model;sync();closePop(true);});
      pop.querySelectorAll('[data-ratio]').forEach(b=>b.onclick=()=>{draft.aspect=b.dataset.ratio;sync();closePop(true);});
      const range=pop.querySelector('input[type=range]'),toggle=pop.querySelector('[role=switch]');
      if(range){range.oninput=()=>{draft.duration=draft.manualDuration=Number(range.value);pop.querySelector('output').textContent=draft.duration+' 秒';sync();};toggle.onclick=()=>{draft.duration=draft.duration?0:draft.manualDuration;toggle.setAttribute('aria-checked',String(!draft.duration));range.disabled=!draft.duration;pop.querySelector('output').textContent=draft.duration?draft.duration+' 秒':'自动';sync();};}
    });
    input.oninput=()=>{draft.prompt=input.value;sync();};
    host.querySelector('form').onsubmit=e=>{e.preventDefault();if(draft.prompt.trim()||draft.reference)void start();};
    host.querySelectorAll('[data-suggest]').forEach(b=>b.onclick=()=>{input.value=draft.prompt=SUGGESTIONS[Number(b.dataset.suggest)];sync();input.focus();});
    host.querySelectorAll('[data-showcase]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.showcase);openDialog('3D 预演展示',`<img class="b3-demo" src="assets/3d-box/showcase-${[3,4,5,1,2][i]}.webp" alt="3D 预演展示"/><p class="b3-demo-caption">参考展示 · LibTV</p>`);});
    host.querySelector('[data-settings]').onclick=ctx.settings;host.querySelector('[data-refresh]').onclick=refresh;
    const outside=e=>{if(popover&&!popover.contains(e.target)&&!anchor?.contains(e.target))closePop();};
    const escape=e=>{if(e.key==='Escape'&&popover){e.stopPropagation();closePop(true);}};
    const reposition=e=>{if(popover&&!popover.contains(e.target))closePop();};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);window.addEventListener('resize',closePop);host.addEventListener('scroll',reposition,true);
    window.addEventListener('canvasflow:previs-models-changed',loadModels);window.addEventListener('canvasflow:models-changed',loadModels);
    mounted=()=>{alive=false;closePop();dialog?.remove();dialog=null;document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);window.removeEventListener('resize',closePop);host.removeEventListener('scroll',reposition,true);window.removeEventListener('canvasflow:previs-models-changed',loadModels);window.removeEventListener('canvasflow:models-changed',loadModels);};
    sync();void loadModels();void refresh();
  }
  window.CanvasFlowBox3D={mount,unmount,listProjects,projectDate,buildPrompt,ASPECTS};
})();
