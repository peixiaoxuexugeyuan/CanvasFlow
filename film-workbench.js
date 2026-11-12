/* CanvasFlow's non-modal film drawer. The embedded editor owns and saves its timeline. */
(function () {
  'use strict';
  let panel, frame, status, deps, context, epoch = 0, lastFocus;
  let editorOrigin = '', editorProject = '', visibleProject = '';
  let external = '', externalJob = '', selectedClip = null,layoutTimer,denyPending;
  let externalAttachments=[], externalState={},externalActivity;
  let materialTimer,materialSyncing=false,lastMaterialWarning='';
  async function syncMaterialsQuietly(){
    if(materialSyncing||panel?.hidden||document.hidden||visibleProject!==editorProject||!editorProject)return;
    const run=epoch;materialSyncing=true;
    try{const result=await action({action:'sync_materials'});if(run!==epoch)return;
      const message=(result.conflicts||[]).map(c=>c.message).join('；');
      if(message&&message!==lastMaterialWarning)deps.toast(message,'!');lastMaterialWarning=message;
    }catch(e){if(run===epoch&&e.message!==lastMaterialWarning){lastMaterialWarning=e.message;deps.toast('素材同步暂未完成，可在制片工具中重试','!');}}
    finally{materialSyncing=false;}
  }
  let canvasSlot, canvasHome, liveCanvas, canvasToggle;
  const scopeBody = scope => ({projectId:scope.projectId,draft:Boolean(scope.draft)});
  const action = args => deps.api('/api/film/action',{method:'POST',headers:context.headers,body:JSON.stringify({...scopeBody(context),args}),throwOnError:true});
  const el = (tag, text, cls) => { const node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; };
  const button = (text, title, fn) => { const node = el('button', text); node.type = 'button'; node.title = title; node.setAttribute('aria-label', title); node.addEventListener('click', fn); return node; };
  function requestCanvas() {
    if (!editorOrigin || visibleProject !== editorProject) return deps.toast('请等待成片载入','!');
    // Use the native entry to pause its player before hiding the editor.
    frame.contentWindow.postMessage({type:'canvasflow-film-command',action:'canvas',projectId:editorProject},editorOrigin);
  }
  function showCanvas(show) {
    if (show && !liveCanvas) {
      const canvas = document.getElementById('canvasWrap');
      if (!canvas || canvas.classList.contains('view-hidden')) return;
      canvasHome = document.createComment('CanvasFlow live canvas home');
      canvas.before(canvasHome); liveCanvas = canvas;
      canvasSlot.append(canvas); // Move the real DOM, never clone nodes or reload a project.
    } else if (!show && liveCanvas) {
      canvasHome.replaceWith(liveCanvas); liveCanvas = canvasHome = null;
    }
    canvasSlot.hidden = !show; frame.hidden = show;
    panel.classList.toggle('is-canvas', show);
    canvasToggle.textContent = show ? '剪辑' : '画布';
    canvasToggle.setAttribute('aria-label', show ? '返回成片剪辑' : '打开当前创作画布');
    canvasToggle.setAttribute('aria-pressed', String(show));
    if (show) status.hidden = true;
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }
  function close(restoreFocus = true) {
    if(externalJob)void action({action:'agent_stop',id:externalJob}).catch(()=>{});
    denyPending?.();clearTimeout(layoutTimer);clearInterval(materialTimer);
    epoch++;
    if (!panel) return;
    const wasOpen = !panel.hidden;
    showCanvas(false);
    editorOrigin = editorProject = visibleProject = '';
    selectedClip = null;
    externalAttachments=[];externalState={};externalActivity?.remove();externalActivity=null;
    panel.hidden = true;
    if (wasOpen) deps?.onClose?.();
    // Unload playback, not the local process: exports and already-saved edits continue.
    frame.removeAttribute('src');
    panel.querySelectorAll('.film-materials').forEach(n=>n.remove());
    document.getElementById('filmWorkbenchBtn')?.setAttribute('aria-expanded', 'false');
    if (wasOpen && restoreFocus && lastFocus?.isConnected) lastFocus.focus();
  }
  function build() {
    panel = el('aside', '', 'film-workbench');
    panel.id = 'filmWorkbench'; panel.hidden = true;
    panel.setAttribute('aria-label', '成片工作台');
    const grip = el('div', '', 'film-workbench-grip');
    grip.tabIndex = 0; grip.role = 'separator';
    grip.setAttribute('aria-orientation', 'vertical'); grip.setAttribute('aria-label', '调整成片工作台宽度');
    function resize(width) {
      panel.classList.remove('is-expanded');
      const available = innerWidth - (Number(panel.dataset.agentWidth) || 0) - 24;
      const value = Math.max(Math.min(760, available), Math.min(width, available));
      panel.style.width = value + 'px'; grip.setAttribute('aria-valuenow', String(Math.round(value)));
    }
    grip.addEventListener('pointerdown', event => {
      event.preventDefault(); grip.setPointerCapture(event.pointerId);
      panel.classList.add('is-resizing');
    });
    grip.addEventListener('pointermove', event => { if (grip.hasPointerCapture(event.pointerId)) resize(innerWidth - (Number(panel.dataset.agentWidth) || 0) - event.clientX); });
    const stopResize = () => panel.classList.remove('is-resizing');
    grip.addEventListener('pointerup', stopResize); grip.addEventListener('lostpointercapture', stopResize);
    grip.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); resize(panel.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? 40 : -40));
    });
    const heading = el('header', '', 'film-workbench-head');
    const title = el('div', '', 'film-workbench-title'); title.append(el('strong', '成片工作台'), el('small', '', 'film-workbench-context'));
    const actions = el('div', '', 'film-workbench-actions');
    canvasToggle = button('画布', '打开当前创作画布', ()=>liveCanvas?showCanvas(false):requestCanvas());
    actions.append(button('＋ 当前画布素材', '导入当前画布素材到成片', importMaterials), canvasToggle,
      button('@ 片段','引用选中的时间轴片段',()=>{if(!selectedClip)return deps.toast('先点击时间轴上的一个片段','!');deps.onReference?.(selectedClip);}),
      button('制片工具', '技能、版本、导出、服务与 Agent', () => void controls()),
      button('AI 助手', '打开成片剪辑助手', () => deps?.onOpen?.()),
      button('↻', '重新连接编辑器', () => void connect()),
      button('↔', '展开或还原成片工作台', () => panel.classList.toggle('is-expanded')),
      button('×', '关闭成片工作台', close));
    heading.append(title, actions);
    status = el('div', '', 'film-workbench-status'); status.role = 'status';
    frame = el('iframe'); frame.title = '成片剪辑编辑器'; frame.id = 'filmEditorFrame';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-downloads allow-forms allow-modals');
    // Studio and its preview use different local origins. Keep its native player,
    // full-screen viewer and copy actions available inside the host frame.
    frame.setAttribute('allow', 'autoplay; fullscreen; clipboard-write');
    frame.referrerPolicy = 'no-referrer';
    frame.addEventListener('load', () => {
      if (!panel.hidden && frame.getAttribute('src')) status.hidden = true;
    });
    window.addEventListener('message', event => {
      if (panel.hidden || event.source !== frame.contentWindow || event.origin !== editorOrigin) return;
      if(event.data?.type==='canvasflow-film-host' && event.data.projectId===editorProject){
        const message=event.data;
        if(message.event==='canvas')showCanvas(true);
        if(message.event==='reference'&&message.ref)deps.onReference?.(message.ref);
        if(message.event==='ask'){for(const ref of message.request?.refs||[])deps.onReference?.(ref);if(message.request?.text)deps.onReference?.(message.request.text);}
        if(message.event==='skill')deps.onReference?.(`请先读取 OpenFilm 技能 ${message.skill?.name}，再帮我制作：`);
        return;
      }
      if(event.data?.type !== 'canvasflow-film-project')return;
      visibleProject = String(event.data.projectId || '');
      if(visibleProject===editorProject){
        selectedClip=event.data.clip;
        if(event.data.layout){clearTimeout(layoutTimer);const layout=event.data.layout;layoutTimer=setTimeout(()=>void action({action:'layout_save',layout}).catch(()=>{}),800);}
      }
      if (visibleProject && visibleProject !== editorProject) {
        selectedClip = null;
        showCanvas(false);
        status.hidden = false;
        status.textContent = '编辑器切换了成片，请点击 ↻ 返回当前画布关联的成片，再继续使用剪辑助手。';
      } else if (visibleProject === editorProject) status.hidden = true;
    });
    const footer = el('footer', '', 'film-workbench-credit');
    footer.append(el('span', 'OpenFilm · 本地剪辑'), el('span', '自动保存 · 拖动左边缘调整宽度'));
    canvasSlot = el('div','','film-canvas-slot'); canvasSlot.hidden = true;
    panel.append(grip, heading, status, frame, canvasSlot, footer);
    panel.addEventListener('keydown', event => {
      // The mounted canvas retains CanvasFlow's own shortcuts and document handlers.
      if (event.target.closest?.('#canvasWrap')) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='e' && !event.target.closest('input,textarea,[contenteditable]')) {
          event.preventDefault();event.stopPropagation();showCanvas(false);
        }
        return;
      }
      // Host controls must not send Delete/Ctrl+Z/etc. to the canvas behind them.
      // Keys inside Studio's iframe are handled exclusively by Studio itself.
      event.stopPropagation();
      if (event.key === 'Escape' && !panel.querySelector('.film-materials')) close();
    });
    document.body.append(panel);
  }
  function validEditorURL(value) {
    const url = new URL(value);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/open' || url.username || url.password) throw Error('编辑器返回了无效地址');
    return url.href;
  }
  async function connect() {
    if(externalJob)void action({action:'agent_stop',id:externalJob}).catch(()=>{});
    const run = ++epoch;
    clearInterval(materialTimer);clearTimeout(layoutTimer);externalAttachments=[];externalState={};externalActivity?.remove();externalActivity=null;
    panel.querySelectorAll('.film-materials').forEach(n=>n.remove());
    showCanvas(false);
    editorOrigin = editorProject = visibleProject = '';
    selectedClip = null;
    frame.removeAttribute('src'); status.hidden = false; status.textContent = '正在启动本地成片编辑器…';
    try {
      const result = await deps.api('/api/film/open', {method: 'POST', headers: context.headers,
        body: JSON.stringify(scopeBody(context)), throwOnError: true});
      if (run !== epoch || panel.hidden) return;
      const url = validEditorURL(result.url);
      editorOrigin = new URL(url).origin;
      editorProject = String(result.projectId || '');
      frame.src = url;
      clearInterval(materialTimer);materialTimer=setInterval(syncMaterialsQuietly,15000);
    } catch (error) { if (run === epoch && !panel.hidden) status.textContent = (error.message || '编辑器连接失败') + '；可点击 ↻ 重试。'; }
  }
  async function importMaterials() {
    if (!editorProject || visibleProject !== editorProject) { deps.toast('请等待成片载入，或点击 ↻ 返回关联成片', '!'); return; }
    if (panel.querySelector('.film-materials')) return;
    const run = epoch, scope={...context}, localDeps=deps;
    const dialog = el('section', '', 'film-materials'); dialog.role = 'dialog'; dialog.setAttribute('aria-label', '导入当前画布素材');
    const head = el('header'); head.append(el('strong', '从当前画布导入'), button('×', '关闭素材选择', () => dialog.remove()));
    const search = el('input'); search.type = 'search'; search.placeholder = '搜索图片、视频、音频'; search.setAttribute('aria-label', '搜索成片素材');
    const list = el('div', '正在读取当前画布素材…', 'film-materials-list');
    const note = el('p', '仅显示当前画布的素材，复制到当前成片后即可剪辑。'); note.role = 'status';
    const selected = new Set(); let rows = [];
    const submit = button('导入所选', '导入所选素材', async () => {
      if (run !== epoch || !dialog.isConnected) return;
      submit.disabled = true; note.textContent = '正在复制素材到成片…';
      try {
        const result = await localDeps.api('/api/film/import', {method:'POST', headers:scope.headers,
          body:JSON.stringify({...scopeBody(scope), materialIds:[...selected]}), throwOnError:true});
        if (run !== epoch || !dialog.isConnected) return;
        dialog.remove(); localDeps.toast(`已导入 ${result.imported} 项素材；从左侧素材区拖入时间轴即可剪辑`, '✓');
      } catch (error) { if (dialog.isConnected) { note.textContent = error.message || '素材导入失败'; submit.disabled = !selected.size; } }
    }); submit.disabled = true;
    function paint() {
      list.replaceChildren();
      const shown = rows.filter(row => row.name.toLowerCase().includes(search.value.trim().toLowerCase()));
      if (!shown.length) list.append(el('p', rows.length ? '没有匹配的素材' : '当前画布没有图片、视频或音频素材。添加素材节点后再来导入。'));
      for (const row of shown) {
        const card = el('article','','film-material-card');
        const preview = el('div','','film-material-preview');
        const url = value => { try {const u=new URL(value,location.href);return (u.origin===location.origin && u.pathname.startsWith('/media/')) || u.protocol==='https:' || /^data:(image|video|audio)\//.test(value) ? u.href : '';} catch{return '';} };
        const source = url(row.url), thumb = url(row.thumbnail);
        if (row.kind==='image') {
          const img=el('img');img.src=source||thumb;img.alt=row.name;img.loading='lazy';img.decoding='async';preview.append(img);
          img.addEventListener('error',()=>{preview.replaceChildren(el('span','图片暂不可预览'));},{once:true});
        } else {
          const media=el(row.kind==='video'?'video':'audio');media.controls=true;media.preload='none';media.src=source;
          media.setAttribute('aria-label',`预览 ${row.name}`);
          if (row.kind==='video') {media.playsInline=true;if(thumb)media.poster=thumb;else media.preload='metadata';}
          media.addEventListener('play',()=>{for(const other of list.querySelectorAll('video,audio'))if(other!==media)other.pause();});
          preview.append(media);
        }
        const label = el('label'); const check = el('input'); check.type = 'checkbox'; check.checked = selected.has(row.id);
        check.setAttribute('aria-label',`选择 ${row.name}`);
        check.addEventListener('change', () => {
          check.checked ? selected.add(row.id) : selected.delete(row.id);
          submit.disabled = !selected.size || selected.size > 50; submit.textContent = `导入所选（${selected.size}）`;
          note.textContent = selected.size > 50 ? '每次最多导入 50 项素材' : '复制素材到成片工程，原素材保持不变。';
        });
        label.append(check, el('span', row.name), el('small', {image:'图片',video:'视频',audio:'音频'}[row.kind]));
        card.append(preview,label);list.append(card);
      }
    }
    search.addEventListener('input', paint);
    dialog.append(head, search, list, note, submit); panel.append(dialog); search.focus();
    try {
      const result = await localDeps.api('/api/workspace/materials?project='+encodeURIComponent(scope.projectId), {headers: scope.headers, throwOnError: true});
      if (run !== epoch || !dialog.isConnected) return;
      rows = (result.materials || []).filter(row => ['image','video','audio'].includes(row.kind) && (row.url||row.deferred) && row.projects?.some(p=>p.id===scope.projectId));
      // Old inline media are returned separately to keep catalog responses small.
      // Limit parallel reads and discard late results after project navigation.
      const pending=rows.filter(row=>row.deferred);
      await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{
        while(pending.length && run===epoch && dialog.isConnected){
          const row=pending.shift();
          const detail=await localDeps.api('/api/workspace/materials/'+encodeURIComponent(row.id),{headers:scope.headers,throwOnError:true});
          if(detail.material?.projects?.some(p=>p.id===scope.projectId))row.url=detail.material.url;
        }
      }));
      if (run !== epoch || !dialog.isConnected) return;
      paint();
    } catch (error) { if (dialog.isConnected) list.textContent = error.message || '素材读取失败'; }
  }
  async function controls(selected='clips') {
    if (!window.CanvasFlowFilm.agentReady()) return deps.toast('请等待成片载入','!');
    const run=epoch,scope={...context},localDeps=deps;
    const action=async args=>{
      if(run!==epoch)throw Error('当前成片已切换，请重新打开制片工具');
      const result=await localDeps.api('/api/film/action',{method:'POST',headers:scope.headers,body:JSON.stringify({...scopeBody(scope),args}),throwOnError:true});
      if(run!==epoch)throw Error('当前成片已切换，操作结果保留在原成片');
      return result;
    };
    panel.querySelector('.film-controls')?.remove();
    const box=el('section','','film-materials film-controls');box.role='dialog';box.setAttribute('aria-label','制片工具');
    const head=el('header');head.append(el('strong','制片工具'),button('×','关闭制片工具',()=>box.remove()));
    const tabs=el('nav'),body=el('div','','film-controls-body'),note=el('p','');note.role='status';
    const tabNames={clips:'片段引用',materials:'素材联动',skills:'制片技能',history:'版本与改动',exports:'导出与回流',generate:'生成素材',services:'模型服务',agents:'Agent'};
    let request=0;
    async function load(tab) {
      const current=++request;
      for(const b of tabs.children)b.classList.toggle('active',b.dataset.tab===tab);
      body.replaceChildren(el('p','正在读取…'));note.textContent='';
      try {
        const result=await action({action:tab==='clips'?'document':tab==='generate'?'services':tab==='materials'?'sync_materials':tab});if(!box.isConnected||current!==request)return;body.replaceChildren();
        const row=(title,description,buttons=[])=>{const r=el('article','','film-control-row');const text=el('div');text.append(el('strong',title),el('small',description));r.append(text,...buttons);body.append(r);return r;};
        const perform=(label,fn)=>{const b=button(label,label,async()=>{b.disabled=true;try{await fn();}catch(e){note.textContent=e.message;}finally{b.disabled=false;}});return b;};
        if(tab==='materials'){
          const catalog=await localDeps.api('/api/workspace/materials?project='+encodeURIComponent(scope.projectId),{headers:scope.headers,throwOnError:true});
          if(current!==request||run!==epoch)return;
          body.append(perform('立即同步',()=>load('materials')));
          for(const [id,item]of Object.entries(result.links||{})){
            const category=el('select');category.setAttribute('aria-label','分类 '+item.name);
            for(const c of [{id:'',name:'未分类'},...(catalog.categories||[])]){const opt=el('option',c.name||c.label||c.id);opt.value=c.id;category.append(opt);}category.value=item.category||'';
            const rating=el('select');rating.setAttribute('aria-label','评级 '+item.name);for(let i=0;i<=5;i++){const opt=el('option',i?'★'.repeat(i):'未评级');opt.value=String(i);rating.append(opt);}rating.value=String(item.rating||0);
            const save=async value=>{await localDeps.api('/api/workspace/materials/'+encodeURIComponent(id),{method:'PUT',headers:scope.headers,body:JSON.stringify(value),throwOnError:true});await load('materials');};
            row(item.name||item.path,item.sourceDeleted?'源素材已移除；剪辑副本保留，避免现有片段缺失':item.path,
              item.sourceDeleted?[]:[category,rating,perform('保存标签与评级',()=>save({category:category.value,rating:Number(rating.value)})),perform(item.favorite?'★ 已收藏':'☆ 收藏',()=>save({favorite:!item.favorite}))]);
          }
          if(!Object.keys(result.links||{}).length)body.append(el('p','还没有导入当前画布素材'));
          note.textContent=(result.conflicts||[]).map(c=>c.message).join('；')||'已导入素材自动检查更新；分类、评级和收藏共用工作区记录。手动改过的剪辑副本不会被覆盖。';
        }
        if(tab==='generate'){
          const types={image:'图片',video:'视频',tts:'配音',music:'音乐',sfx:'音效'},kind=el('select'),model=el('select'),form=el('div'),prompt=el('textarea');
          kind.setAttribute('aria-label','生成类型');model.setAttribute('aria-label','生成模型');prompt.placeholder='描述你需要生成的素材';prompt.setAttribute('aria-label','生成提示词');
          for(const [value,label]of Object.entries(types)){const opt=el('option',label);opt.value=value;kind.append(opt);}
          body.append(kind,model,prompt,form);
          const files=(await action({action:'files'})).files||[];let fields={},voiceRequest=0;
          const field=(label,key,options,multiple=false)=>{
            const input=options?el('select'):el('input');input.setAttribute('aria-label',label);
            if(options){input.multiple=multiple;for(const option of options){const opt=el('option',typeof option==='string'?option:option.name);opt.value=typeof option==='string'?option:option.value;input.append(opt);}}
            const container=el('label',label,'film-generation-field');container.append(input);form.append(container);fields[key]=input;return input;
          };
          const mediaOptions=type=>[{name:'不使用',value:''},...files.filter(f=>f.kind===type||({image:/\.(png|jpe?g|webp|gif)$/i,video:/\.(mp4|webm|mov)$/i,audio:/\.(mp3|wav|m4a)$/i})[type].test(f.path)).map(f=>({name:f.path,value:f.path}))];
          async function draw(){
            const currentVoice=++voiceRequest;fields={};form.replaceChildren();
            const selected=(result.models?.[kind.value]||[]).find(m=>m.id===model.value),spec=selected?.spec||{};
            if(kind.value==='image'){
              field('比例','ratio',['1:1','16:9','9:16','3:2','2:3','4:3']);field('尺寸','size',['1k','2k','4k']);if(spec.qualities?.length)field('画质','quality',spec.qualities);
              const format=field('输出格式','format',spec.formats||['png']);if(spec.formats?.includes('gif')){const count=field('GIF 帧数','frames');count.type='number';count.min='2';count.max='16';count.value='9';const ms=field('GIF 每帧毫秒','frame-ms');ms.type='number';ms.min='20';ms.max='2000';ms.value='200';const update=()=>{count.parentElement.hidden=ms.parentElement.hidden=format.value!=='gif';};format.addEventListener('change',update);update();}field('参考图片（可多选）','ref',mediaOptions('image'),true);
              if(spec.mask)field('重绘遮罩','mask',mediaOptions('image'));
              if(spec.markup)field('标注引导图','markup',mediaOptions('image'));
              if(spec.transparent){const input=field('透明背景','transparent');input.type='checkbox';}
            }else if(kind.value==='video'){
              const duration=field('时长（秒）','duration');duration.type='number';duration.min='1';duration.value='4';
              field('比例','aspect-ratio',['16:9','9:16','1:1']);field('首帧','first-frame',mediaOptions('image'));field('尾帧','last-frame',mediaOptions('image'));if(spec.clip)field('参考视频','video',mediaOptions('video'));else form.append(el('small','此模型尚未配置参考视频上传能力')); field('参考音频','audio',mediaOptions('audio'));
            }else if(kind.value==='tts'){
              const voice=field('音色','voice',[{name:'正在读取音色…',value:''}]),search=field('搜索音色','voiceSearch'),gender=field('性别','voiceGender',['全部']),language=field('语言','voiceLanguage',['全部']),preview=el('audio');
              preview.controls=true;preview.preload='none';preview.hidden=true;form.append(preview);
              try{const r=await action({action:'voices',model:model.value});if(currentVoice!==voiceRequest||current!==request)return;
                for(const value of r.filters?.genders||[]){const opt=el('option',value);opt.value=value;gender.append(opt);}
                for(const value of r.filters?.languages||[]){const opt=el('option',value);opt.value=value;language.append(opt);}
                const refresh=()=>{const old=voice.value;voice.replaceChildren();for(const v of r.voices||[]){if(gender.value!=='全部'&&v.gender!==gender.value||language.value!=='全部'&&v.language!==language.value||!JSON.stringify(v).toLowerCase().includes(search.value.toLowerCase()))continue;const opt=el('option',v.name||v.id);opt.value=v.id;voice.append(opt);}if([...voice.options].some(o=>o.value===old))voice.value=old;preview.pause();const demo=r.voices?.find(v=>v.id===voice.value)?.demo;if(demo&&/^https?:\/\//.test(demo)){preview.src=demo;preview.hidden=false;}else{preview.removeAttribute('src');preview.hidden=true;}};
                search.addEventListener('input',refresh);gender.addEventListener('change',refresh);language.addEventListener('change',refresh);voice.addEventListener('change',()=>{const demo=r.voices?.find(v=>v.id===voice.value)?.demo;preview.pause();preview.hidden=!demo;if(demo&&/^https?:\/\//.test(demo))preview.src=demo;else preview.removeAttribute('src');});refresh();
                if(!r.voices?.length){note.textContent=r.error||'供应商未提供音色目录，可填写官方音色 ID';const custom=field('音色 ID','voice');custom.placeholder='供应商提供的音色 ID';}
              }catch(e){if(currentVoice===voiceRequest){note.textContent=e.message;field('音色 ID','voice');}}
            }else{const duration=field('时长（秒）','sec');duration.type='number';duration.min='1';duration.value='10';}
          }
          function fillModels(){model.replaceChildren();for(const item of result.models?.[kind.value]||[]){const opt=el('option',item.name);opt.value=item.id;model.append(opt);}void draw();}
          kind.addEventListener('change',fillModels);model.addEventListener('change',()=>void draw());fillModels();
          body.append(perform('生成并加入当前成片',async()=>{
            if(!model.value)throw Error('请先配置并启用对应模型');if(!prompt.value.trim())throw Error('请填写生成提示词');
            const options={};for(const [key,input]of Object.entries(fields)){if(key.startsWith('voice')&&key!=='voice')continue;const value=input.multiple?[...input.selectedOptions].map(o=>o.value).filter(Boolean):input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;if(value!==''&&value!==false)options[key]=value;}
            options[kind.value==='tts'?'text':'prompt']=prompt.value;note.textContent='正在生成，费用由当前供应商收取，请勿重复提交…';
            const r=await action({action:'generate',verb:kind.value,model:model.value,options});note.textContent='生成完成，已保存到当前成片素材库';body.append(el('pre',JSON.stringify(r.receipt||r,null,2),'film-source'));
          }));
          note.textContent='只调用你选择的模型；生成会按供应商计费。参考文件从当前成片素材中选择。';
        }
        if(tab==='clips') {
          body.append(perform('打开当前创作画布',()=>{box.remove();requestCanvas();}));
          for(const [track,t] of (result.film?.tracks||[]).entries())for(const c of t.clips)row(c.src,`轨道 ${track+1} · ${c.at||0} 秒`,[perform('@ 引用',()=>{deps.onReference?.({kind:'clip',id:c.id,label:c.src.split('/').pop(),src:c.src,track});box.remove();})]);
          if(!body.children.length)body.append(el('p','时间轴为空。先导入素材，或让 Agent 制作影片。'));
        }
        if(tab==='skills') {
          body.append(perform('发现更多技能',async()=>{const catalog=await action({action:'skill_catalog'});body.replaceChildren();for(const s of catalog.skills||[])row(s.name,s.description,[perform(s.installed?'已安装':'安装',async()=>{await action({action:'skill_install',uid:s.uid});await load('skills');})]);}));
          for(const s of result.skills||[])row(s.name,s.description,[perform('阅读',async()=>{const d=await action({action:'skill',uid:s.uid});const p=el('pre',d.text,'film-source');body.replaceChildren(p);}),perform('交给助手',()=>{deps.onReference?.(`请先读取 OpenFilm 技能 ${s.uid}，再按此技能帮我制作：`);box.remove();})]);
        }
        if(tab==='history') {
          body.append(perform('保存当前版本',async()=>{await action({action:'version',operation:'save',message:'用户保存的版本'});await load(tab);}));
          body.append(perform('查看最近一次 Agent 改动',async()=>{const r=await action({action:'diff'});body.replaceChildren(el('pre',JSON.stringify(r.files||[],null,2),'film-source'));}));
          for(const v of result.versions||[]) {const id=v.commit||v.id;row(v.name||v.message||v.kind||'自动版本',`${(id||'').slice(0,8)} · ${v.at?new Date(v.at).toLocaleString():''}`,[perform('查看改动',async()=>{const d=await action({action:'changes',commit:id});body.replaceChildren(el('pre',JSON.stringify(d,null,2),'film-source'));}),perform('恢复此版本',async()=>{if(!confirm('恢复到此版本？未保存的改动将被保护；若有冲突会提示。'))return;await action({action:'version',operation:'checkout',commit:id});await load(tab);})]);}
        }
        if(tab==='exports') {
          const bar=el('div','','film-controls-export');const kind=el('select');kind.setAttribute('aria-label','导出格式');
          const formats={video:'MP4 视频',gif:'GIF 动图',audio:'MP3 音频',poster:'PNG 静帧',subtitles:'SRT 字幕',slides:'PPTX 幻灯片',nle:'剪辑工程 XML',project:'完整工程 ZIP'};
          for(const [v,label]of Object.entries(formats)){const o=el('option',label);o.value=v;kind.append(o);}
          bar.append(kind,perform('开始导出',async()=>{const settings={kind:kind.value,name:'CanvasFlow',...({video:{codec:'h264',shortEdge:720,fps:30},audio:{format:'mp3'},poster:{format:'png',at:0},subtitles:{format:'srt'},slides:{format:'pptx'},nle:{format:'xml'},project:{format:'zip'}}[kind.value]||{})};await action({action:'export',settings});await load(tab);}),perform('刷新进度',()=>load(tab)));body.append(bar);
          note.textContent='更多分辨率、透明视频、分轨及导出选项仍可在编辑器原生导出窗口中选择。';
          for(const j of result.exports||[])row(j.files?.join('、')||j.id,`${j.status} · ${Math.round((j.progress||0)*100)}%${j.error?' · '+j.error:''}`,[...(j.status==='done'?[perform('加入素材',async()=>{const d=await action({action:'outputs',id:j.id});const messages=[];for(const f of d.files||[]){const r=await action({action:'publish',token:f.token});messages.push(r.message||'已登记到素材管理');}note.textContent=messages.join('；');}),perform('加入画布',async()=>{const d=await action({action:'outputs',id:j.id});const messages=[];for(const f of d.files||[]){const r=await action({action:'publish',token:f.token,addToCanvas:true});deps.onEffects?.(r._effects);messages.push(r.message||'已加入画布及素材管理');}note.textContent=messages.join('；');})]:['waiting','running'].includes(j.status)?[perform('取消导出',async()=>{await action({action:'cancel_export',id:j.id});await load(tab);})]:[])]);
        }
        if(tab==='services') {
          note.textContent='沿用 CanvasFlow 供应商；生成、转写和翻译会按供应商计费。没有可用模型时不会自动改用其他类型。';
          for(const [kind,models]of Object.entries(result.models||{}))row(({image:'图片',video:'视频',tts:'配音',music:'音乐',sfx:'音效',asr:'字幕转写',translate:'语言与翻译'})[kind]||kind,models.length?models.map(m=>m.name).join('、'):'未配置可用模型');
          body.append(perform('打开供应商设置',()=>{window.CanvasFlowSettings?.open?.('providers');box.remove();}));
        }
        if(tab==='agents') {
          body.append(perform('对话记录与逐轮撤销',async()=>{
            const history=await action({action:'agent_history'});body.replaceChildren();
            for(const t of (history.turns||[]).slice().reverse()){
              const text=(t.updates||[]).map(u=>u.update||u).filter(u=>u.sessionUpdate==='agent_message_chunk'&&u.content?.type==='text').map(u=>u.content.text).join('');
              row(t.agent+' · '+new Date(t.at).toLocaleString(),t.prompt,t.canUndo?[perform('撤销此轮改动',async()=>{
                if(!confirm('撤销此轮对成片文件的改动？后续编辑有冲突时会停止，新增文件会保留到成片回收区。'))return;
                const r=await action({action:'agent_undo',turnId:t.id});note.textContent='已恢复 '+r.restored+' 项'+(r.missed?.length?'；未能恢复：'+r.missed.join('、'):'');await load(tab);
              })]:[]);
              body.append(el('pre',text||t.error||t.status,'film-source'));
              const detail=el('details'),summary=el('summary','执行过程与用量');detail.append(summary,el('pre',JSON.stringify({updates:t.updates,usage:t.usage},null,2),'film-source'));body.append(detail);
            }
            if(!history.turns?.length)body.append(el('p','还没有外部 Agent 对话'));
          }));
          row('CanvasFlow Agent','使用应用内已配置的 API 模型',[perform(external?'切换使用':'当前使用',()=>{external='';note.textContent='已切回 CanvasFlow Agent';})]);
          for(const a of result.agents||[])row(a.name,a.installed?'已发现本机程序 · 使用该程序自己的登录账号':'尚未发现本机程序',[perform('使用',()=>{if(!a.installed)throw Error('请先安装该 Agent');external=a.id;note.textContent=`已选择 ${a.name}；在右侧聊天输入剪辑要求。`;deps.onOpen?.();}),perform(a.installed?'登录':'安装',async()=>{await action({action:a.installed?'agent_login':'agent_install',agent:a.id});note.textContent='请在该 Agent 的安装或登录窗口完成操作后刷新。';})]);
          const selectedAgent=()=>{if(!external)throw Error('请先在列表中选择外部 Agent');return external;};
          body.append(perform('模型与推理强度',async()=>{
            const agent=selectedAgent(),r=await action({action:'agent_config',agent}),values={};
            body.replaceChildren();
            const draw=options=>{for(const option of options){
              const select=el('select');select.setAttribute('aria-label',option.name||option.id);
              for(const item of (option.options||[]).flatMap(o=>o.options||[o])){const opt=el('option',item.name||item.value);opt.value=item.value;select.append(opt);}
              select.value=r.saved[option.id]??option.currentValue;values[option.id]=select.value;
              select.addEventListener('change',()=>{values[option.id]=select.value;});row(option.name||option.id,'',[select]);
            }};
            draw(r.options||[]);
            body.append(perform('保存配置',async()=>{await action({action:'agent_config_save',agent,options:values});note.textContent='配置已保存，下次对话生效';}));
            if(!r.options?.length)note.textContent='该 Agent 没有提供可调整的模型选项。';
          }),perform('技能与 MCP',async()=>{
            const agent=selectedAgent(),r=await action({action:'agent_access',agent});body.replaceChildren();
            for(const [kind,items,enabled]of [['skill',r.skills,r.canSkills],['mcp',r.mcp,r.canMcp]]){
              body.append(el('h3',kind==='skill'?'允许使用的技能':'允许使用的 MCP 工具'));
              for(const item of items||[]){const toggle=el('input');toggle.type='checkbox';toggle.checked=item.allowed;toggle.disabled=!enabled;toggle.setAttribute('aria-label',item.name);
                toggle.addEventListener('change',async()=>{toggle.disabled=true;try{await action({action:'agent_access_set',agent,kind,name:item.name,allowed:toggle.checked});note.textContent='设置已保存，下一次连接生效';}catch(e){toggle.checked=!toggle.checked;note.textContent=e.message;}finally{toggle.disabled=!enabled;}});
                row(item.name,item.description||'',[toggle]);}
              if(!items?.length)body.append(el('p','没有发现此类扩展'));if(!enabled)body.append(el('p','该 Agent 暂不支持按项目开关此类扩展'));
            }
          }),perform('诊断连接',async()=>{const r=await action({action:'agent_diagnose',agent:selectedAgent()});body.append(el('pre',JSON.stringify(r.diagnostic,null,2),'film-source'));}),
          perform('查看账号用量',async()=>{const r=await action({action:'agent_usage',agent:selectedAgent()});note.textContent=r.usage?JSON.stringify(r.usage):'该 Agent 没有返回账号用量，请在其官方应用中查看。';}),
          perform('切换账号',async()=>{const agent=selectedAgent();if(!confirm('这会退出该 Agent 当前账号，并打开其登录流程。继续？'))return;await action({action:'agent_switch_account',agent});note.textContent='请在该 Agent 中完成登录。';}));
          const attach=el('input');attach.type='file';attach.multiple=true;attach.hidden=true;
          const list=el('div','','film-attachments');
          const drawAttachments=()=>{list.replaceChildren();for(const item of externalAttachments)list.append(button(item.name+' ×','移除附件 '+item.name,()=>{externalAttachments=externalAttachments.filter(a=>a!==item);drawAttachments();}));};
          attach.addEventListener('change',async()=>{const run=epoch;try{
            for(const file of attach.files){if(file.size>20*1024*1024)throw Error('单个附件不能超过 20 MB');if(externalAttachments.length>=16)throw Error('每条消息最多附加 16 个文件');
              const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
              if(run!==epoch)return;const saved=await action({action:'agent_attach',name:file.name,base64});if(run!==epoch)return;externalAttachments.push(saved);
            }drawAttachments();note.textContent='附件将随下一条外部 Agent 消息发送';
          }catch(e){note.textContent=e.message;}finally{attach.value='';}});
          body.append(perform('添加聊天附件',()=>{selectedAgent();attach.click();}),attach,list);drawAttachments();
          if(externalJob){const input=el('textarea');input.placeholder='在 Agent 执行中追加剪辑要求';body.append(input,perform('追加指令',async()=>{
            await action({action:'agent_steer',id:externalJob,message:input.value});input.value='';note.textContent='追加指令已送达';
          }));
            for(const option of externalState.options||[]){const select=el('select');for(const item of (option.options||[]).flatMap(o=>o.options||[o])){const opt=el('option',item.name||item.value);opt.value=item.value;select.append(opt);}select.value=option.currentValue;
              row(option.name||option.id,'当前对话配置',[select,perform('应用',async()=>{await action({action:'agent_option',id:externalJob,configId:option.id,value:select.value});note.textContent='当前对话配置已更新';})]);}
          }
          note.textContent='外部 Agent 使用自身账号；权限请求会单独显示。附件仅发送到你选择的 Agent。';
        }
      }catch(e){if(current===request){note.textContent=e.message;body.replaceChildren();}}
    }
    for(const [key,label]of Object.entries(tabNames)){const b=button(label,label,()=>void load(key));b.dataset.tab=key;tabs.append(b);}
    box.append(head,tabs,body,note);panel.append(box);await load(selected);
  }
  window.CanvasFlowFilm = {
    open(options) {
      if (panel && !panel.hidden) { close(); return; }
      deps = options; context = options.context;
      if (!panel) build();
      lastFocus = document.activeElement;
      panel.hidden = false;
      deps.onOpen?.();
      panel.querySelector('.film-workbench-context').textContent = context.title;
      document.getElementById('filmWorkbenchBtn')?.setAttribute('aria-expanded', 'true');
      void connect();
    },
    close,
    isOpen() { return Boolean(panel && !panel.hidden); },
    agentReady() { return Boolean(panel && !panel.hidden && editorProject && visibleProject === editorProject); },
    syncAgentWidth(width) {
      if (!panel) return;
      panel.dataset.agentWidth = String(width || 0);
      panel.style.setProperty('--film-agent-width', `${width || 0}px`);
    },
    syncView() { close(false); },
    externalSelected(){return external;},
    async stopExternal(){denyPending?.();if(externalJob)await action({action:'agent_stop',id:externalJob});},
    async runExternal(message,events) {
      const run=epoch,scope={...context};
      const scopedAction=args=>deps.api('/api/film/action',{method:'POST',headers:scope.headers,body:JSON.stringify({...scopeBody(scope),args}),throwOnError:true});
      const started=await scopedAction({action:'agent_start',agent:external,message,attachments:externalAttachments});externalAttachments=[];externalJob=started.jobId;const jobId=started.jobId;
      externalActivity?.remove();externalActivity=el('details','','film-agent-activity');externalActivity.append(el('summary','Agent 正在执行'));const activityBody=el('div');externalActivity.append(activityBody);panel.querySelector('.film-workbench-head').after(externalActivity);
      let offset=0;const answered=new Set();
      try {while(run===epoch && !panel.hidden){
        const result=await scopedAction({action:'agent_poll',id:jobId,offset});offset=result.offset;
        externalState=result;
        for(const u of result.updates||[]){const update=u.update||u;
          if(update.sessionUpdate==='agent_message_chunk' && update.content?.type==='text')events.text(update.content.text);
          if(['tool_call','tool_call_update','plan','usage_update'].includes(update.sessionUpdate)){
            const item=el('details');item.append(el('summary',(update.title||update.toolCallId||({plan:'执行计划',usage_update:'本次用量'})[update.sessionUpdate]||'工具操作')+' '+(update.status||'')),el('pre',JSON.stringify(update,null,2),'film-source'));activityBody.append(item);while(activityBody.children.length>100)activityBody.firstChild.remove();
          }
        }
        for(const p of result.pending||[]){if(answered.has(p.id))continue;answered.add(p.id);
          const box=el('section','','film-materials film-permission'),body=el('p',p.params.toolCall?.title||p.params.message||'外部 Agent 请求操作权限');box.append(el('strong','Agent 需要你的选择'),body);
          const answer=await new Promise(resolve=>{denyPending=()=>resolve(null);
            for(const opt of p.kind==='permission'?(p.params.options||[]):[])box.append(button(opt.name||opt.optionId,opt.name||opt.optionId,()=>resolve(opt.optionId)));
            if(p.kind==='question'){
              const answers={};
              for(const q of p.params.questions||[]){const label=el('label',q.question||q.header||q.id),field=el('div','','film-question');field.append(label);
                if(q.options?.length){const select=el('select');select.setAttribute('aria-label',q.question||q.id);select.append(el('option','请选择'));for(const o of q.options){const choice=el('option',o.label);choice.value=o.label;select.append(choice);}select.addEventListener('change',()=>{answers[q.id]={label:select.value};});field.append(select);}
                if(!q.options?.length||q.customId){const input=el('textarea');input.placeholder='输入回答';input.addEventListener('input',()=>{answers[q.id]={text:input.value};});field.append(input);}box.append(field);
              }box.append(button('提交回答','提交回答',()=>resolve(answers)));
            }box.append(button('拒绝 / 取消','拒绝此请求',()=>resolve(null)));panel.append(box);
          });denyPending=null;box.remove();
          await scopedAction({action:'agent_answer',id:jobId,requestId:p.id,answer});
        }
        if(result.status!=='running'){if(result.error)throw Error(result.error);events.note(result.status==='done'?'剪辑完成，已保存版本，可在“版本与改动”中查看。':'Agent 已停止。');break;}
        await new Promise(resolve=>setTimeout(resolve,800));
      }}finally{if(run!==epoch||panel.hidden)await scopedAction({action:'agent_stop',id:jobId}).catch(()=>{});if(externalJob===jobId){externalJob='';if(externalActivity)externalActivity.querySelector('summary').textContent='查看 Agent 执行过程与用量';}}
    },
  };
})();
