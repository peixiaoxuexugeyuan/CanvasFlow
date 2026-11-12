/* Workspace-wide material management. The host supplies its existing local API. */
(function () {
  'use strict';
  const TYPES = [['all','全部素材','▦'],['image','图片','▧'],['video','视频','▶'],['model','模型','◇'],['audio','音频','≋']];
  const CATEGORIES = [['all','全部分类'],['character','角色'],['scene','场景'],['prop','道具'],['uncategorized','未分类']];
  const TYPE_NAMES = Object.fromEntries(TYPES.map(([key,label])=>[key,label]));
  const UPLOAD_KINDS = {png:'image',jpg:'image',jpeg:'image',webp:'image',mp4:'video',webm:'video',mov:'video',mp3:'audio',wav:'audio',m4a:'audio',glb:'model'};
  function uploadKind(file){return UPLOAD_KINDS[String(file?.name||'').split('.').pop().toLowerCase()]||'';}
  let active = null;

  function mount(deps) {
    active?.dispose();
    const state={rows:[],projects:[],categories:CATEGORIES.slice(1,4),kind:'all',category:'all',origin:'all',project:'all',query:'',sort:'recent',selected:new Set()};
    const esc=deps.escapeHtml, host=deps.host, events=new AbortController();
    let version=0, dialog=null, undoing=false;
    const deletionHistory=[];
    const root=document.createElement('div');root.className='content-view-inner workspace-materials';
    host.replaceChildren(root);
    const instance={dispose(){version++;events.abort();dialog?.remove();}};active=instance;
    root.innerHTML=`<header class="wm-heading"><div><span class="eyebrow">WORKSPACE MATERIALS</span><h1>素材管理</h1><p>汇总当前工作区所有项目中生成和上传的素材。</p></div><div class="wm-heading-actions"><span class="wm-workspace">▣ ${esc(deps.workspaceName||'当前工作区')}</span><button type="button" data-wm-action="refresh" class="wm-secondary">↻ 刷新</button><button type="button" data-wm-action="upload" class="wm-primary">＋ 上传素材</button></div></header>
      <div class="wm-type-tabs" role="tablist" aria-label="素材类型">${TYPES.map(([key,label,icon])=>`<button type="button" role="tab" data-wm-kind="${key}" aria-selected="${key==='all'}"><span>${icon}</span>${label}<em data-wm-type-count="${key}">0</em></button>`).join('')}</div>
      <section class="wm-controls" aria-label="素材筛选"><div class="wm-categories"></div>
      <div class="wm-search-row"><label class="wm-search"><span aria-hidden="true">⌕</span><input type="search" data-wm-search placeholder="搜索素材名称或项目" aria-label="搜索素材名称或项目"></label><select data-wm-project aria-label="按所属项目筛选"><option value="all">全部项目</option></select><select data-wm-origin aria-label="按素材来源筛选"><option value="all">全部来源</option><option value="generated">生成素材</option><option value="uploaded">上传素材</option></select><select data-wm-sort aria-label="素材排序"><option value="recent">最近更新</option><option value="name">名称排序</option></select></div></section>
      <div class="wm-result-row"><label class="wm-select-all"><input type="checkbox" data-wm-select-all> 全选当前结果</label><span data-wm-result-count>正在汇总素材…</span><button type="button" class="wm-clear-filters" data-wm-action="clear">清除筛选</button></div>
      <div class="wm-selection" hidden><span data-wm-selection-count></span><select data-wm-bulk-category aria-label="批量设置内容分类"><option value="choose">批量设置分类…</option><option value="character">角色</option><option value="scene">场景</option><option value="prop">道具</option><option value="">未分类</option></select><button type="button" class="wm-delete-selected" data-wm-action="delete-selected">删除所选</button><button type="button" data-wm-action="unselect">取消选择</button></div>
      <div class="wm-undo-row" hidden role="status"><span data-wm-delete-status></span><button type="button" data-wm-action="undo-delete">撤销删除</button></div>
      <div class="wm-grid" aria-live="polite"><div class="wm-empty">正在读取各项目的素材…</div></div>`;

    function categoryName(id){return state.categories.find(([key])=>key===id)?.[1]||'未分类';}
    function paintCategories() {
      root.querySelector('.wm-categories').innerHTML='<span>内容分类</span>'+[['all','全部分类'],...state.categories,['uncategorized','未分类']].map(([key,label])=>`<button type="button" data-wm-category="${esc(key)}" aria-pressed="${key===state.category}">${esc(label)}</button>`).join('')+'<button type="button" class="wm-manage-tags" data-wm-action="manage-tags">⚙ 管理标签</button>';
      const bulk=root.querySelector('[data-wm-bulk-category]');
      bulk.innerHTML='<option value="choose">批量设置分类…</option>'+categoryOptions('');bulk.value='choose';
    }

    function filtered() {
      const query=state.query.trim().toLowerCase();
      const rows=state.rows.filter(row=>(state.kind==='all'||row.kind===state.kind)
        &&(state.category==='all'||row.category===(state.category==='uncategorized'?'':state.category))
        &&(state.origin==='all'||row.origins.includes(state.origin))
        &&(state.project==='all'||row.projects.some(project=>project.id===state.project))
        &&(!query||(row.name+' '+row.projects.map(project=>project.name).join(' ')).toLowerCase().includes(query)));
      if(state.sort==='name')rows.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
      return rows;
    }
    const find=id=>state.rows.find(row=>row.id===id);
    function originLabel(row){return row.origins.length>1?'生成 / 上传':row.origins.includes('generated')?'生成':'上传';}
    function categoryOptions(category){return [['','未分类'],...state.categories].map(([key,label])=>`<option value="${esc(key)}"${category===key?' selected':''}>${esc(label)}</option>`).join('');}
    function card(row) {
      const source=row.thumbnail||(row.kind==='image'?row.url:'');
      const icon=TYPES.find(([key])=>key===row.kind)?.[2]||'◇';
      const preview=source?`<img src="${esc(source)}" alt="${esc(row.name)}" loading="lazy">`:row.kind==='video'&&row.url?`<video src="${esc(row.url)}" muted preload="metadata"></video>`:`<span class="wm-preview-icon wm-is-${row.kind}">${icon}</span>`;
      return `<article class="wm-card"><div class="wm-cover"><button type="button" class="wm-preview" data-wm-preview="${row.id}" aria-label="预览 ${esc(row.name)}">${preview}<span class="wm-preview-label">查看素材</span></button><label class="wm-card-check"><input type="checkbox" data-wm-select="${row.id}" aria-label="选择 ${esc(row.name)}"${state.selected.has(row.id)?' checked':''}></label><span class="wm-kind-badge">${TYPE_NAMES[row.kind]}</span></div>
        <div class="wm-card-body"><div class="wm-card-name"><strong title="${esc(row.name)}">${esc(row.name)}</strong><button type="button" data-wm-rename="${row.id}" aria-label="编辑素材 ${esc(row.name)}" title="编辑素材">✎</button></div><div class="wm-card-info"><span class="wm-origin ${row.origins.includes('generated')?'is-generated':''}">${originLabel(row)}</span><span>${esc(row.size||'')}</span></div>
        <div class="wm-card-project" title="${esc(row.projects.map(project=>project.name).join('、'))}">▣ ${esc(row.projects.length?row.projects[0].name:'工作区素材')}${row.projects.length>1?` <em>+${row.projects.length-1}</em>`:''}</div>
        <div class="wm-card-metadata"><button type="button" data-wm-favorite="${row.id}" aria-pressed="${Boolean(row.favorite)}" aria-label="收藏 ${esc(row.name)}">${row.favorite?'★ 已收藏':'☆ 收藏'}</button><select data-wm-rating="${row.id}" aria-label="评级 ${esc(row.name)}">${[0,1,2,3,4,5].map(n=>`<option value="${n}"${n===(row.rating||0)?' selected':''}>${n?'★'.repeat(n):'未评级'}</option>`).join('')}</select></div><div class="wm-card-footer"><select data-wm-item-category="${row.id}" aria-label="分类 ${esc(row.name)}">${categoryOptions(row.category)}</select><button type="button" data-wm-download="${row.id}" title="下载素材" aria-label="下载 ${esc(row.name)}">↓</button><button type="button" class="wm-delete" data-wm-delete="${row.id}" title="删除素材" aria-label="删除 ${esc(row.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div></article>`;
    }
    function paintSelection() {
      const rows=filtered(), all=root.querySelector('[data-wm-select-all]');
      const count=rows.filter(row=>state.selected.has(row.id)).length;
      all.checked=!!rows.length&&count===rows.length;all.indeterminate=count>0&&count<rows.length;
      root.querySelector('.wm-selection').hidden=!state.selected.size;
      root.querySelector('[data-wm-selection-count]').textContent=`已选择 ${state.selected.size} 项`;
      root.querySelectorAll('[data-wm-select]').forEach(input=>{input.checked=state.selected.has(input.dataset.wmSelect);});
    }
    function paintDeletionStatus() {
      const previous=deletionHistory[deletionHistory.length-1];
      root.querySelector('.wm-undo-row').hidden=!previous;
      root.querySelector('[data-wm-delete-status]').textContent=previous?`已从素材管理删除 ${previous.length} 项素材` : '';
      const undo=root.querySelector('[data-wm-action="undo-delete"]');
      undo.disabled=undoing;undo.textContent=undoing?'正在撤销…':'撤销删除';
      root.querySelectorAll('[data-wm-delete], [data-wm-action="delete-selected"]').forEach(button=>{button.disabled=undoing;});
    }
    function paint() {
      if(!root.isConnected)return;
      const rows=filtered();
      root.querySelectorAll('[data-wm-kind]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.wmKind===state.kind)));
      root.querySelectorAll('[data-wm-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.wmCategory===state.category)));
      root.querySelectorAll('[data-wm-type-count]').forEach(el=>{el.textContent=String(el.dataset.wmTypeCount==='all'?state.rows.length:state.rows.filter(row=>row.kind===el.dataset.wmTypeCount).length);});
      root.querySelector('[data-wm-result-count]').textContent=`共 ${state.rows.length} 项素材 · 当前显示 ${rows.length} 项`;
      root.querySelector('.wm-grid').innerHTML=rows.length?rows.map(card).join(''):`<div class="wm-empty"><span>▦</span><h3>${state.rows.length?'没有符合筛选条件的素材':'当前工作区还没有素材'}</h3><p>${state.rows.length?'试试其他类型、分类或所属项目。':'上传图片、视频、模型、音频，或在项目中生成素材后，会统一显示在这里。'}</p></div>`;
      root.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.replaceWith(Object.assign(document.createElement('span'),{className:'wm-preview-icon',textContent:'▧'}));},{once:true}));
      paintSelection();
      paintDeletionStatus();
    }
    async function reload({throwOnError=false}={}) {
      const request=++version;
      try {
        await deps.pendingSave;
        const result=await deps.api('/api/workspace/materials',{throwOnError:true});
        if(request!==version||!root.isConnected)return;
        state.rows=result.materials||[];state.projects=result.projects||[];
        if(Array.isArray(result.categories))state.categories=result.categories.map(row=>[row.id,row.name]);
        paintCategories();
        state.selected=new Set([...state.selected].filter(id=>find(id)));
        const selector=root.querySelector('[data-wm-project]');
        selector.innerHTML='<option value="all">全部项目</option>'+state.projects.map(project=>`<option value="${esc(project.id)}">${esc(project.name)}</option>`).join('');
        if(!state.projects.some(project=>project.id===state.project))state.project='all';
        selector.value=state.project;paint();
      } catch(error) {
        if(request===version&&root.isConnected)root.querySelector('.wm-grid').innerHTML=`<div class="wm-empty"><h3>素材暂时无法加载</h3><p>${esc(error.message)}</p><button type="button" data-wm-action="refresh">重新加载</button></div>`;
        if(throwOnError)throw error;
      }
    }
    async function updateMetadata(id,values){await deps.api('/api/workspace/materials/'+encodeURIComponent(id),{method:'PUT',throwOnError:true,body:JSON.stringify(values)});Object.assign(find(id)||{},values);paint();}
    async function classify(ids,category) {
      await deps.api('/api/workspace/materials',{method:'PUT',throwOnError:true,body:JSON.stringify({ids,category})});
      state.rows.forEach(row=>{if(ids.includes(row.id))row.category=category;});paint();
      deps.toast(`已设为${categoryName(category)}`,'✓');
    }
    async function detail(id) {
      const result=await deps.api('/api/workspace/materials/'+encodeURIComponent(id),{throwOnError:true});
      return result.material;
    }
    function closeDialog(){dialog?.remove();dialog=null;}
    function openDelete(ids,opener) {
      if(undoing||!root.isConnected)return;
      const rows=[...new Set(ids)].map(find).filter(Boolean);
      if(!rows.length)return;
      closeDialog();dialog=document.createElement('div');dialog.className='wm-modal';
      const layer=dialog,view=document.createElement('section');view.className='wm-modal-panel wm-delete-panel';
      view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');view.setAttribute('aria-labelledby','wmDeleteTitle');
      const projects=new Set(rows.flatMap(row=>row.projects.map(project=>project.id)));
      view.innerHTML=`<header><strong id="wmDeleteTitle">${rows.length===1?'删除素材':`删除 ${rows.length} 项素材`}</strong><button type="button" data-delete-cancel aria-label="关闭删除弹窗">×</button></header><div class="wm-delete-content"><p>确认从当前工作区的素材管理中删除以下素材？</p><ul class="wm-delete-items">${rows.slice(0,8).map(row=>`<li>${esc(row.name)}</li>`).join('')}${rows.length>8?`<li class="wm-delete-more">另有 ${rows.length-8} 项素材</li>`:''}</ul><p class="wm-delete-note">${projects.size?`这些素材关联 ${projects.size} 个项目。`:''}删除会移除素材管理中的记录，项目节点和本地原文件会保留。删除后可在本页面撤销。</p><p class="wm-upload-error" data-delete-error role="alert" hidden></p></div><footer><button type="button" class="wm-secondary" data-delete-cancel>取消</button><button type="button" class="wm-danger" data-delete-confirm>确认删除</button></footer>`;
      layer.append(view);document.body.append(layer);
      let busy=false;
      function close(){if(busy)return;closeDialog();if(opener?.isConnected)opener.focus();else root.querySelector('[data-wm-action="upload"]')?.focus();}
      layer.addEventListener('click',async event=>{
        const button=event.target.closest('button');
        if(event.target===layer||button?.hasAttribute('data-delete-cancel'))return close();
        if(!button?.hasAttribute('data-delete-confirm')||busy)return;
        busy=true;view.setAttribute('aria-busy','true');
        view.querySelectorAll('button').forEach(control=>{control.disabled=true;});
        const error=view.querySelector('[data-delete-error]');error.hidden=true;button.textContent='正在删除…';
        try {
          const result=await deps.api('/api/workspace/materials',{method:'DELETE',throwOnError:true,body:JSON.stringify({ids:rows.map(row=>row.id)})});
          if(!root.isConnected)return;
          const removed=new Set(result.deleted);version++;
          state.rows=state.rows.filter(row=>!removed.has(row.id));
          removed.forEach(id=>state.selected.delete(id));
          deletionHistory.push([...removed]);busy=false;close();paint();
          root.querySelector('[data-wm-action="undo-delete"]').focus();
          deps.toast(`已删除 ${removed.size} 项素材，可撤销`,'✓');
        } catch(err) {
          if(!root.isConnected)return;
          error.textContent=err.message||'删除失败，请重试';error.hidden=false;
          busy=false;view.setAttribute('aria-busy','false');
          view.querySelectorAll('button').forEach(control=>{control.disabled=false;});button.textContent='确认删除';
        }
      });
      layer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
      view.querySelector('footer [data-delete-cancel]').focus();
    }
    async function undoDelete() {
      if(undoing||!deletionHistory.length)return;
      undoing=true;paintDeletionStatus();
      try {
        const ids=deletionHistory[deletionHistory.length-1];
        await deps.api('/api/workspace/materials/restore',{method:'POST',throwOnError:true,body:JSON.stringify({ids})});
        if(!root.isConnected)return;
        deletionHistory.pop();await reload({throwOnError:true});
        deps.toast(`已恢复 ${ids.length} 项素材`,'✓');
      } catch(error) {report(error);}
      finally {undoing=false;if(root.isConnected)paintDeletionStatus();}
    }
    function openCategoryManager() {
      closeDialog();dialog=document.createElement('div');dialog.className='wm-modal';
      const layer=dialog,view=document.createElement('section');view.className='wm-modal-panel wm-tag-panel';
      view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');view.setAttribute('aria-labelledby','wmTagTitle');
      view.innerHTML=`<header><div><strong id="wmTagTitle">内容分类标签管理</strong><span>管理${esc(deps.workspaceName||'当前工作区')}的分类标签。</span></div><button type="button" data-tag-close aria-label="关闭标签管理">×</button></header>
        <div class="wm-tag-content"><form class="wm-tag-create"><label class="wm-upload-field">新标签名称<input type="text" name="newTag" maxlength="40" placeholder="例如：建筑、服装、配乐" required autocomplete="off"></label><button type="submit" class="wm-primary">新建标签</button></form>
        <p class="wm-tag-error wm-upload-error" role="alert" hidden></p><div class="wm-tag-list"></div><div class="wm-tag-confirm" hidden></div></div>
        <footer><span>标签变更会同步到筛选、上传及素材卡片。</span><button type="button" class="wm-primary" data-tag-close>完成</button></footer>`;
      layer.append(view);document.body.append(layer);
      const list=view.querySelector('.wm-tag-list'),newInput=view.querySelector('[name=newTag]'),error=view.querySelector('.wm-tag-error'),confirm=view.querySelector('.wm-tag-confirm');
      let busy=false,editing='',draft='',deleting='';
      function showError(message){error.textContent=message;error.hidden=!message;}
      function setBusy(value){busy=value;view.setAttribute('aria-busy',String(value));view.querySelectorAll('button,input').forEach(control=>{control.disabled=value;});}
      function close(){if(busy)return;closeDialog();root.querySelector('[data-wm-action="manage-tags"]')?.focus();}
      function render() {
        list.innerHTML=state.categories.map(([id,name])=>{
          const count=state.rows.filter(row=>row.category===id).length;
          return `<div class="wm-tag-row"><div class="wm-tag-name">${editing===id?`<input data-tag-draft aria-label="重命名标签 ${esc(name)}" type="text" maxlength="40" value="${esc(draft)}">`:`<strong>${esc(name)}</strong>`}<span>${count} 项素材</span></div><div class="wm-tag-actions">${editing===id?`<button type="button" data-tag-save="${esc(id)}">保存</button><button type="button" data-tag-cancel>取消</button>`:`<button type="button" data-tag-rename="${esc(id)}" aria-label="重命名标签 ${esc(name)}">重命名</button><button type="button" class="wm-tag-delete" data-tag-delete="${esc(id)}" aria-label="删除标签 ${esc(name)}">删除</button>`}</div></div>`;
        }).join('')||'<p class="wm-no-tags">还没有内容分类标签，可在上方新建。</p>';
        const pending=state.categories.find(([id])=>id===deleting);confirm.hidden=!pending;
        if(pending){
          const count=state.rows.filter(row=>row.category===deleting).length;
          confirm.innerHTML=`<strong>删除“${esc(pending[1])}”？</strong><p>${count?`${count} 项素材将归入“未分类”。`:''}素材文件会保留。</p><div><button type="button" data-tag-delete-cancel>取消</button><button type="button" data-tag-delete-confirm="${esc(deleting)}">确认删除标签</button></div>`;
        }
        if(busy)view.querySelectorAll('button,input').forEach(control=>{control.disabled=true;});
      }
      async function mutate(action,id='') {
        if(busy)return;
        const name=(action==='create'?newInput.value:draft).trim();
        if(action!=='delete'&&!name){showError('请填写标签名称');return;}
        setBusy(true);showError('');
        try {
          const path='/api/workspace/materials/categories'+(id?'/'+encodeURIComponent(id):'');
          const result=await deps.api(path,{method:action==='create'?'POST':action==='rename'?'PUT':'DELETE',throwOnError:true,...(action==='delete'?{}:{body:JSON.stringify({name})})});
          ++version; // An older refresh must not overwrite a completed label change.
          state.categories=result.categories.map(row=>[row.id,row.name]);
          if(action==='delete'){
            state.rows.forEach(row=>{if(row.category===id)row.category='';});
            if(state.category===id)state.category='all';
          }
          if(action==='create')newInput.value='';
          editing='';deleting='';paintCategories();paint();render();
          deps.toast(action==='delete'?'标签已删除，素材文件已保留':action==='rename'?'标签名称已更新':'标签已创建','✓');
        }catch(err){showError(err.message||'标签更新失败，请重试');}
        finally{setBusy(false);if(action==='create')newInput.focus();}
      }
      view.querySelector('form').addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();void mutate('create');});
      layer.addEventListener('input',event=>{if(event.target.matches('[data-tag-draft]'))draft=event.target.value;});
      layer.addEventListener('click',event=>{
        event.stopPropagation();const button=event.target.closest('button');if(busy)return;
        if(event.target===layer||button?.hasAttribute('data-tag-close')){close();return;}
        if(!button)return;const d=button.dataset;
        if(d.tagRename){editing=d.tagRename;draft=categoryName(editing);deleting='';showError('');render();list.querySelector('[data-tag-draft]')?.focus();}
        if(button.hasAttribute('data-tag-cancel')){editing='';render();}
        if(d.tagSave)void mutate('rename',d.tagSave);
        if(d.tagDelete){deleting=d.tagDelete;editing='';showError('');render();view.querySelector('[data-tag-delete-confirm]')?.focus();}
        if(button.hasAttribute('data-tag-delete-cancel')){deleting='';render();}
        if(d.tagDeleteConfirm)void mutate('delete',d.tagDeleteConfirm);
      });
      layer.addEventListener('keydown',event=>{
        event.stopPropagation();
        if(event.key==='Escape'){event.preventDefault();close();}
        if(event.key==='Enter'&&event.target.matches('[data-tag-draft]')){event.preventDefault();void mutate('rename',editing);}
        if(event.key==='Tab'){
          const controls=[...view.querySelectorAll('button,input')].filter(el=>!el.disabled&&el.getClientRects().length),first=controls[0],last=controls.at(-1);
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
        }
      });
      render();newInput.focus();
    }
    async function preview(id) {
      const row=await detail(id);if(!root.isConnected)return;
      closeDialog();dialog=document.createElement('div');dialog.className='wm-modal';
      const view=document.createElement('section');view.className='wm-modal-panel';view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');view.setAttribute('aria-label',row.name);
      view.innerHTML=`<header><div><strong>${esc(row.name)}</strong><span>${TYPE_NAMES[row.kind]} · ${esc(categoryName(row.category))} · ${originLabel(row)}</span></div><button type="button" data-wm-close aria-label="关闭素材预览">×</button></header><div class="wm-media-view"></div><footer><div class="wm-project-links">${row.projects.map(project=>`<button type="button" data-wm-project-open="${esc(project.id)}">打开 ${esc(project.name)} ↗</button>`).join('')||'<span>工作区素材，尚未关联项目</span>'}</div><button type="button" class="wm-primary" data-wm-modal-download>下载素材 ↓</button></footer>`;
      const media=view.querySelector('.wm-media-view');
      if(row.kind==='image'&&row.url){const image=document.createElement('img');image.src=row.url;image.alt=row.name;media.append(image);}
      else if(['video','audio'].includes(row.kind)&&row.url){const player=document.createElement(row.kind);player.controls=true;player.src=row.url;player.preload='metadata';media.append(player);}
      else if(row.thumbnail){const image=document.createElement('img');image.src=row.thumbnail;image.alt=row.name;media.append(image);}
      else {const block=document.createElement('div');block.className='wm-model-preview';const icon=document.createElement('span');icon.textContent='◇';const label=document.createElement('strong');label.textContent=row.name;const hint=document.createElement('p');hint.textContent=row.url?'可下载模型文件，或进入来源项目查看。':'项目中的三维模型，可导出模型 JSON 并在来源项目中继续编辑。';block.append(icon,label,hint);media.append(block);}
      dialog.append(view);document.body.append(dialog);
      dialog.addEventListener('click',event=>{const button=event.target.closest('button');if(event.target===dialog||button?.hasAttribute('data-wm-close'))closeDialog();if(button?.hasAttribute('data-wm-modal-download'))download(id).catch(report);if(button?.dataset.wmProjectOpen){closeDialog();deps.openProject(button.dataset.wmProjectOpen);}});
      dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeDialog();}});
      view.querySelector('[data-wm-close]').focus();
    }
    async function download(id) {
      const row=await detail(id);let url=row.url, suffix='';
      if(!url&&row.object){url=URL.createObjectURL(new Blob([JSON.stringify(row.object,null,2)],{type:'application/json'}));suffix='.json';}
      if(!url)throw Error('此素材没有可下载的文件');
      if(!suffix) {try{suffix=new URL(url,location.href).pathname.match(/\.[a-z0-9]{2,5}$/i)?.[0]||'';}catch{}}
      if(!suffix)suffix={image:'.png',video:'.mp4',model:'.glb',audio:'.wav'}[row.kind];
      const name=row.name.replace(/[<>:"/\\|?*]/g,'_');
      const link=document.createElement('a');link.href=url;link.download=name.toLowerCase().endsWith(suffix.toLowerCase())?name:name+suffix;link.rel='noopener';
      if(url.startsWith('http')&&new URL(url).origin!==location.origin)link.target='_blank';
      document.body.append(link);link.click();link.remove();if(url.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(url),30000);
    }
    function openUpload(existing=null) {
      if(!root.isConnected)return;
      closeDialog();
      dialog=document.createElement('div');dialog.className='wm-modal';
      const layer=dialog,opener=existing?root.querySelector(`[data-wm-rename="${existing.id}"]`):root.querySelector('[data-wm-action="upload"]');
      const initialCategory=existing?existing.category:(state.categories.some(([id])=>id===state.category)?state.category:'');
      const view=document.createElement('section');view.className='wm-modal-panel wm-upload-panel';
      view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');view.setAttribute('aria-labelledby','wmUploadTitle');
      view.innerHTML=`<header><div><strong id="wmUploadTitle">${existing?'编辑素材':'上传素材'}</strong><span>保存到${esc(deps.workspaceName||'当前工作区')}，随时按标签查找。</span></div><button type="button" data-upload-close aria-label="${existing?'关闭编辑弹窗':'关闭上传弹窗'}">×</button></header>
        <form class="wm-upload-form"><div class="wm-upload-fields">
          <label class="wm-upload-field"><span>名称 <span class="wm-required">*</span></span><input name="name" type="text" maxlength="160" required placeholder="输入素材名称" autocomplete="off"><small>选择多个文件时，将按此名称依次编号。</small></label>
          <div class="wm-upload-field"><span data-upload-file-label>${existing?'替换文件':'上传文件 <span class="wm-required">*</span>'}</span><button type="button" class="wm-file-picker" data-upload-choose><span aria-hidden="true">${existing?'↻':'↑'}</span><strong>${existing?'点击替换文件':'点击选择文件'}</strong><small>图片、视频、GLB 模型或音频${existing?'':' · 支持多选'}</small></button><input name="files" type="file" ${existing?'':'multiple'} hidden accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,.mp3,.wav,.m4a,.glb"><ul class="wm-upload-files" aria-label="${existing?'当前素材文件':'已选择的文件'}"></ul>${existing?.projects?.length?'<small>替换文件用于素材库预览与下载，来源项目中的原始内容会保留。</small>':''}</div>
          <div class="wm-upload-field"><span>素材类型 <small class="wm-auto-label">自动识别</small></span><div class="wm-detected-types" aria-live="polite"><span class="wm-type-hint">选择文件后自动识别图片、视频、音频或模型。</span></div></div>
          <label class="wm-upload-field">内容分类标签<select name="category" aria-label="内容分类标签">${categoryOptions(initialCategory)}</select></label>
          <div class="wm-new-category"><button type="button" class="wm-new-category-toggle" data-category-toggle>＋ 新建分类标签</button><div class="wm-new-category-editor" hidden><label>标签名称<input name="categoryName" type="text" maxlength="40" placeholder="例如：服装、建筑、配乐" autocomplete="off"></label><button type="button" class="wm-secondary" data-category-create>创建并选用</button></div><small>新标签会同步显示在“内容分类”筛选中。</small></div>
          <p class="wm-upload-error" role="alert" hidden></p><p class="wm-upload-progress" role="status" hidden></p>
        </div><footer><button type="button" class="wm-secondary" data-upload-close>取消</button><button type="submit" class="wm-primary" data-upload-submit>${existing?'保存修改':'上传素材'}</button></footer></form>`;
      layer.append(view);document.body.append(layer);
      const form=view.querySelector('form'),nameInput=form.elements.name,fileInput=form.elements.files,categorySelect=form.elements.category;
      const error=view.querySelector('.wm-upload-error'),progress=view.querySelector('.wm-upload-progress');
      let busy=false,queue=[];
      const showError=message=>{error.textContent=message;error.hidden=!message;};
      function setBusy(value){busy=value;view.setAttribute('aria-busy',String(value));view.querySelectorAll('button,input,select').forEach(control=>{control.disabled=value;});}
      function close(){if(busy)return;closeDialog();if(opener?.isConnected)opener.focus();else root.querySelector('[data-wm-action="upload"]')?.focus();}
      function showTypes(items) {
        const detected=TYPES.filter(([kind])=>kind!=='all'&&items.some(item=>item.kind===kind));
        view.querySelector('.wm-detected-types').innerHTML=detected.length?detected.map(([kind,label,icon])=>`<span class="wm-detected-type" data-detected-kind="${kind}">${icon} ${label}<b>${items.filter(item=>item.kind===kind).length}</b></span>`).join(''):'<span class="wm-type-hint">选择文件后自动识别图片、视频、音频或模型。</span>';
      }
      if(existing){
        nameInput.value=existing.name;
        view.querySelector('.wm-upload-files').innerHTML=`<li><span title="${esc(existing.name)}">${esc(existing.name)}</span><em class="wm-file-kind">${TYPE_NAMES[existing.kind]}</em><small>${esc(existing.size||'当前素材')}</small></li>`;
        nameInput.nextElementSibling.textContent='可直接修改名称和分类，也可选择新的文件进行替换。';
        showTypes([existing]);
      }
      async function createCategory() {
        const name=form.elements.categoryName.value.trim();
        if(!name){showError('请先填写标签名称');form.elements.categoryName.focus();return;}
        setBusy(true);showError('');
        try {
          const result=await deps.api('/api/workspace/materials/categories',{method:'POST',throwOnError:true,body:JSON.stringify({name})});
          state.categories=result.categories.map(row=>[row.id,row.name]);paintCategories();paint();
          categorySelect.innerHTML=categoryOptions(result.category.id);
          form.elements.categoryName.value='';view.querySelector('.wm-new-category-editor').hidden=true;
          deps.toast(`已添加标签“${result.category.name}”`,'✓');
        }catch(err){showError(err.message||'标签创建失败，请重试');}
        finally{setBusy(false);categorySelect.focus();}
      }
      layer.addEventListener('click',event=>{
        event.stopPropagation();
        const button=event.target.closest('button');
        if(event.target===layer||button?.hasAttribute('data-upload-close'))close();
        if(button?.hasAttribute('data-upload-choose'))fileInput.click();
        if(button?.hasAttribute('data-category-toggle')){
          const editor=view.querySelector('.wm-new-category-editor');editor.hidden=!editor.hidden;if(!editor.hidden)form.elements.categoryName.focus();
        }
        if(button?.hasAttribute('data-category-create'))void createCategory();
      });
      layer.addEventListener('keydown',event=>{
        event.stopPropagation();
        if(event.key==='Escape'){event.preventDefault();close();}
        if(event.key==='Enter'&&event.target===form.elements.categoryName){event.preventDefault();void createCategory();}
        if(event.key==='Tab'){
          const controls=[...view.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.getClientRects().length);
          const first=controls[0],last=controls.at(-1);
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
        }
      });
      fileInput.addEventListener('change',()=>{
        queue=[...fileInput.files].map(file=>({file,kind:uploadKind(file)}));showError('');
        if(queue.length&&!nameInput.value.trim())nameInput.value=queue[0].file.name.replace(/\.[^.]+$/,'').slice(0,150)||'新素材';
        view.querySelector('.wm-upload-files').innerHTML=queue.map(({file,kind})=>`<li><span title="${esc(file.name)}">${esc(file.name)}</span><em class="wm-file-kind ${kind?'':'is-unsupported'}">${TYPE_NAMES[kind]||'不支持的类型'}</em><small>${formatSize(file.size)}</small></li>`).join('');
        if(existing&&!queue.length)view.querySelector('.wm-upload-files').innerHTML=`<li><span>${esc(existing.name)}</span><em class="wm-file-kind">${TYPE_NAMES[existing.kind]}</em><small>${esc(existing.size||'当前素材')}</small></li>`;
        showTypes(queue.length?queue:existing?[existing]:[]);
        view.querySelector('[data-upload-file-label]').textContent=(queue.length||existing)?'替换文件':'上传文件';
        view.querySelector('[data-upload-choose] strong').textContent=queue.length?`已选择 ${queue.length} 个文件 · 点击替换文件`:existing?'点击替换文件':'点击选择文件';
      });
      form.addEventListener('submit',async event=>{
        event.preventDefault();event.stopPropagation();if(busy)return;
        showError('');
        const name=nameInput.value.trim(),category=categorySelect.value;
        if(!name){showError('请填写素材名称');nameInput.focus();return;}
        if(!queue.length&&!existing){showError('请选择要上传的文件');view.querySelector('[data-upload-choose]').focus();return;}
        if(form.elements.categoryName.value.trim()){showError('请先点击“创建并选用”保存新标签，或清空标签名称');return;}
        setBusy(true);progress.hidden=false;
        try {
          // Validate the whole selection before sending any file; retries reuse uploaded files.
          for(const item of queue){
            item.kind=uploadKind(item.file);
            if(!item.kind)throw Error(item.file.name+'：请选择图片、视频、GLB 模型或音频文件');
            await window.CanvasFlowFileFormats.validate(item.file,{image:'images',video:'videos',audio:'music',model:'models'}[item.kind]);
          }
          if(existing){
            const payload={name,category},replacement=queue[0];
            progress.textContent=replacement?'正在替换文件…':'正在保存修改…';
            if(replacement){
              if(!replacement.media)replacement.media=await deps.upload(replacement.file);
              if(!replacement.media?.mediaId)throw Error('替换文件上传失败，请重试');
              payload.replacementMediaId=replacement.media.mediaId;
            }
            await deps.api('/api/workspace/materials/'+existing.id,{method:'PUT',throwOnError:true,body:JSON.stringify(payload)});
          }
          for(let index=0;index<queue.length;index++){
            if(existing)break;
            const item=queue[index],file=item.file,kind=item.kind,label=queue.length>1?`${name.slice(0,150)}-${index+1}`:name;
            progress.textContent=`正在上传 ${index+1} / ${queue.length}：${file.name}`;
            if(!item.media)item.media=await deps.upload(file);
            const media=item.media;if(!media?.url)throw Error(file.name+'：素材文件上传失败');
            if(!item.registered){
              if(kind==='model')await deps.api('/api/previs/assets',{method:'POST',throwOnError:true,body:JSON.stringify({name:label,object:{kind:'geometry',local:true,modelUrl:media.url,transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}}})});
              else await deps.api('/api/assets',{method:'POST',throwOnError:true,body:JSON.stringify({name:label,kind,mediaId:media.mediaId,size:formatSize(file.size),origin:'uploaded'})});
              item.registered=true;
            }
            if(!item.materialId){
              const catalog=await deps.api('/api/workspace/materials',{throwOnError:true});
              item.materialId=catalog.materials.find(row=>row.url===media.url)?.id;
              if(!item.materialId)throw Error('文件已保存，读取素材信息失败，请重试');
            }
            await deps.api('/api/workspace/materials/'+item.materialId,{method:'PUT',throwOnError:true,body:JSON.stringify({name:label,category})});
          }
          Object.assign(state,{kind:'all',category:category||'all',origin:'all',project:'all',query:''});
          root.querySelector('[data-wm-search]').value='';root.querySelector('[data-wm-origin]').value='all';root.querySelector('[data-wm-project]').value='all';
          await reload({throwOnError:true});setBusy(false);close();deps.toast(existing?'素材已更新':`已上传 ${queue.length} 项素材`,'✓');
        }catch(err){showError(err.message||'上传失败，请重试');progress.hidden=true;setBusy(false);}
      });
      nameInput.focus();
    }
    function formatSize(size){return size>=1024*1024?(size/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(size/1024))+' KB';}
    function report(error){deps.toast(error.message||'操作失败，请重试','×');}
    root.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;event.stopPropagation();
      const d=button.dataset;
      if(d.wmKind){state.kind=d.wmKind;paint();return;}
      if(d.wmCategory){state.category=d.wmCategory;paint();return;}
      if(d.wmFavorite){updateMetadata(d.wmFavorite,{favorite:!find(d.wmFavorite)?.favorite}).catch(report);return;}
      if(d.wmPreview){preview(d.wmPreview).catch(report);return;}
      if(d.wmDownload){download(d.wmDownload).catch(report);return;}
      if(d.wmDelete){openDelete([d.wmDelete],button);return;}
      if(d.wmRename){detail(d.wmRename).then(row=>openUpload(row)).catch(report);return;}
      if(d.wmAction==='refresh')reload();
      if(d.wmAction==='upload')openUpload();
      if(d.wmAction==='manage-tags')openCategoryManager();
      if(d.wmAction==='unselect'){state.selected.clear();paintSelection();}
      if(d.wmAction==='delete-selected')openDelete([...state.selected],button);
      if(d.wmAction==='undo-delete')undoDelete();
      if(d.wmAction==='clear'){Object.assign(state,{kind:'all',category:'all',origin:'all',project:'all',query:''});root.querySelector('[data-wm-search]').value='';root.querySelector('[data-wm-origin]').value='all';root.querySelector('[data-wm-project]').value='all';paint();}
    },{signal:events.signal});
    root.addEventListener('input',event=>{if(event.target.matches('[data-wm-search]')){state.query=event.target.value;paint();}},{signal:events.signal});
    root.addEventListener('change',event=>{
      const target=event.target,d=target.dataset;
      if(target.matches('[data-wm-project]')){state.project=target.value;paint();}
      if(target.matches('[data-wm-origin]')){state.origin=target.value;paint();}
      if(target.matches('[data-wm-sort]')){state.sort=target.value;paint();}
      if(d.wmRating)updateMetadata(d.wmRating,{rating:Number(target.value)}).catch(report);
      if(d.wmItemCategory)classify([d.wmItemCategory],target.value).catch(report);
      if(d.wmSelect){if(target.checked)state.selected.add(d.wmSelect);else state.selected.delete(d.wmSelect);paintSelection();}
      if(target.matches('[data-wm-select-all]')){filtered().forEach(row=>target.checked?state.selected.add(row.id):state.selected.delete(row.id));paintSelection();}
      if(target.matches('[data-wm-bulk-category]')&&target.value!=='choose'){classify([...state.selected],target.value).catch(report);target.value='choose';}
    },{signal:events.signal});
    paintCategories();reload();
  }
  window.CanvasFlowMaterials={mount};
})();
