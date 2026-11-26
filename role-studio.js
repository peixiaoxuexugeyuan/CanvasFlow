(function () {
  'use strict';
  const paths = {
    face:'M12 3a9 9 0 1 0 9 9M7 11h2m5 0h2m-7 4q3 3 6 0m3-14 1.2 3.8L23 6l-3.8 1.2L18 11l-1.2-3.8L13 6l3.8-1.2z',
    features:'M14 5c-4-3-9-1-10 4l-2 5 3 1 1 4c3 2 7 0 8-4m-2-9c5-1 9 2 10 7-1 4-5 6-10 5',
    body:'M6 2c4 6 1 10-2 14l2 6m12-20c-4 6-1 10 2 14l-2 6M10 11h4',
    outfit:'m9 4-5 3-3 5 4 2 2-3v10h10V11l2 3 4-2-3-5-5-3c-1 3-5 3-6 0z',
    voice:'M2 11v2m4-6v10m4-14v18m4-17v16m4-12v8m4-6v4',
    back:'m15 4-8 8 8 8', close:'m5 5 14 14M19 5 5 19',
    undo:'m8 4-5 5 5 5M3 9h10a6 6 0 1 1 0 12',redo:'m16 4 5 5-5 5m5-5H11a6 6 0 1 0 0 12',
    compare:'M12 2v20M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4m6-14h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4',
    half:'M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3 21v-2a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v2',
    full:'M10 4a2 2 0 1 0 4 0 2 2 0 1 0-4 0M8 15V9q4-3 8 0v6m-6-4v11m4-11v11',
    spark:'m9 4 2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 2v6m-3-3h6',
    skin:'M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9ZM7 17l1-1m2-2 1-1m2-2 1-1m2-2 1-1m-4 10 1-1m2-2 1-1',
    eyes:'M1.5 12S5.5 5 12 5s10.5 7 10.5 7S18.5 19 12 19 1.5 12 1.5 12Zm7.5 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z',
    nose:'M9 3c0 6-1 9-4 12-2 2 0 5 3 4 2-1 2 2 4 2s2-3 4-2c3 1 5-2 3-4-3-3-4-6-4-12',
    lips:'M2 12c3-1 6-5 9-3l1 1 1-1c3-2 6 2 9 3-5 8-15 8-20 0Zm0 0q10 4 20 0',
    shape:'M4 9c0-4 3-7 8-7s8 3 8 7c0 6-3 11-8 13-5-2-8-7-8-13Z',
    makeup:'m5 16 8-8 3 3-8 8-5 2 2-5zm7-9 4-4 4 4-4 4',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
  const tool = (action,label,image) => `<button type="button" data-action="${action}" aria-label="${label}" title="${label}">${icon(image)}</button>`;
  const modes = window.CanvasFlowRoleModes;

  function open({role,sourceRevision='',official,escapeHtml:esc,upload,pickReference,markLibrary,persist,resumeSave,saved,exitLibrary,workspaceKey,paletteKey,notify,checkVersion,editPrompts,refreshPrompts}) {
    if (document.querySelector('dialog.role-studio[open]')) return;
    const draftKey='canvasflow.role-studio.draft.'+(workspaceKey || role.id);
    const swatchKey='canvasflow.role-studio.hair-colors.'+(paletteKey || workspaceKey || role.id);
    const hexColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    function storedSwatches() {
      try {
        const colors=JSON.parse(localStorage.getItem(swatchKey));
        return Array.isArray(colors) ? colors.filter(hexColor).map(c=>c.toLowerCase()) : [];
      } catch { return []; }
    }
    const customSwatches=new Set(storedSwatches());
    let colorPicker;
    const owner=crypto.randomUUID();
    let expectedRevision=sourceRevision, conflict=false, draftTimer;
    function loadDraft(store) {
      try { return JSON.parse(window[store].getItem(draftKey) || 'null'); } catch { return null; }
    }
    let cached=loadDraft('sessionStorage') || loadDraft('localStorage');
    const currentBase=JSON.stringify([role.name,role.images,role.styling]);
    if (cached?.state?.draft?.controls && typeof cached.state.draft.name==='string') {
      if (cached.source?.id===role.id && typeof cached.revision==='string') {
        expectedRevision=cached.revision;
        conflict=expectedRevision!==sourceRevision;
        role=cached.source;
      } else if(cached.base!==currentBase) cached=null;
    } else cached=null;
    let submission=cached?.submission;
    const maxOutfits=16;
    const uploadedOutfits=new Map();
    const initial = {name:official ? `${role.name.slice(0,35)} - 副本` : role.name,
      controls:{...role.styling?.controls},outfitUrls:role.styling?.outfitUrls ?? (role.styling?.outfitUrl ? [role.styling.outfitUrl] : [])};
    let draft=structuredClone(initial), mode=modes[0], tab=mode.tabs[0], slot=1;
    let history=[], cursor=0, busy=false, comparing=false;
    let models=[], modelId='', loadingModels=true, voicePanel, voiceSaving=false;
    let preferredModelId=cached?.ui?.modelId || role.styling?.renderModelId || '';
    let generation=null, deciding=false, leavePrompt=null, decisionGate=null;
    const activator=document.activeElement;
    const dialog=document.createElement('dialog');
    const saveGroup = (type, title, menuName) => {
      const style = type === 'apply' ? ' class="rs-primary"' : '';
      const menu=role.id ? `data-save-menu="${type}" aria-haspopup="menu" aria-expanded="false"` : '';
      return `<div class="rs-save-group"><button type="button" data-action="${type}" ${menu}${style}>${title}</button><div class="rs-save-popup" role="menu" aria-label="${menuName}" hidden><button type="button" role="menuitem" data-save-kind="update" ${official?'disabled':''}>更新当前角色</button><button type="button" role="menuitem" data-save-kind="new">保存为新角色</button></div></div>`;
    };
    dialog.className='role-studio';
    dialog.setAttribute('aria-label','角色造型室');
    dialog.innerHTML=`<div class="role-studio-dialog"><header class="rs-header">${tool('back','返回','back')}${tool('close','关闭','close')}</header>
      <div class="rs-body"><aside class="rs-sidebar"><div class="rs-identity"><input aria-label="角色名称" maxlength="40" required><small></small></div>
      <nav class="rs-modes" aria-label="编辑项目">${modes.map(m=>`<button type="button" data-mode="${m.id}">${icon(m.id)}<span>${esc(m.label)}</span></button>`).join('')}</nav>
      <div class="rs-history">${tool('undo','撤销','undo')}${tool('redo','恢复','redo')}${tool('compare','按住对比','compare')}</div></aside>
      <main class="rs-preview"><div class="rs-photo"><div class="rs-image-box"><img draggable="false" alt="角色预览"><div class="rs-marks" hidden></div></div><span class="rs-no-image" hidden>暂无角色图片</span></div>
      <div class="rs-views">${tool('half','半身','half')}${tool('full','全身','full')}</div></main>
      <aside class="rs-inspector"><div class="rs-tabs" role="navigation" aria-label="调整分类"></div><div class="rs-fields"></div>
      <input type="file" hidden class="rs-mark-file" accept="image/png,image/jpeg,image/webp" aria-label="上传自定义特征">
      <div class="rs-voice-host" hidden></div><div class="rs-image-actions"><label class="rs-model">图片模型<select aria-label="图片模型" disabled></select></label>
      <div class="rs-conflict" role="alert" hidden>当前角色已有更新。本次编辑仍在草稿中，可从保存选项另存为新角色。<button type="button" data-action="reload-role">放弃草稿，查看最新版本</button></div><p class="rs-status" role="status" aria-live="polite"></p><div class="rs-confirm"><button class="rs-generate" data-action="generate">${icon('spark')}确认生成</button>${tool('smart','智能调整','spark')}</div></div></aside></div>
      <footer class="rs-footer"><label><input type="checkbox" class="rs-assets">保存时生成角色资产</label><div class="rs-actions">${saveGroup('save','保存','保存选项')}${saveGroup('apply','保存并添加到画布','添加到画布选项')}</div>${editPrompts ? `<button type="button" class="rs-edit-prompts" data-rs="edit-prompts" aria-haspopup="dialog">${icon('makeup')}提示词编辑</button>` : ''}</footer></div>`;
    const $=s=>dialog.querySelector(s), $$=s=>[...dialog.querySelectorAll(s)];
    const action=n=>$(`[data-action="${n}"]`);
    const nameInput=$('.rs-identity input'), fields=$('.rs-fields'), tabs=$('.rs-tabs');
    const titleMeasure=document.createElement('canvas').getContext('2d');
    let measuredName='';
    function fitName() {
      const name=nameInput.value, width=nameInput.clientWidth;
      nameInput.title=name;
      const key=width+'|'+name;
      if(!width || key===measuredName) return;
      measuredName=key;
      const style=getComputedStyle(nameInput), max=matchMedia('(max-width:720px)').matches?17:20;
      titleMeasure.font=style.fontWeight+' '+max+'px '+style.fontFamily;
      const full=titleMeasure.measureText(name).width;
      nameInput.style.fontSize=(full?Math.max(13,Math.min(max,Math.floor(max*(width-3)/full))):max)+'px';
    }
    const photo=$('.rs-photo'), box=$('.rs-image-box'), img=$('.rs-image-box > img');
    const appearancePreview=window.createRoleAppearancePreview(img);
    const assets=$('.rs-assets'), picker=$('.rs-model select'), status=$('.rs-status');
    const estimate=document.createElement('small');estimate.style.marginLeft='4px';assets.parentElement.append(estimate);
    const previewMessage=document.createElement('span');previewMessage.className='rs-hint';photo.append(previewMessage);
    photo.addEventListener('rolepreviewstate',e=>{
      updateCompare();
      previewMessage.textContent=({cutting:'正在抠除背景…','cutout-failed':'抠图未完成，当前显示原图。',multiple:'检测到多个人物，局部调整将在生成时应用。',unlocated:'当前视角无法定位所选部位，局部调整将在生成时应用。',unavailable:'当前图片无法进行局部预览。'})[e.detail]||'';
    });
    let omittedLabels=new Set();
    const fieldsByKey=new Map();
    for(const m of modes) for(const t of m.tabs) for(const f of t.fields) fieldsByKey.set(`${m.id}.${t.id}.${f.id}`, f);
    const markKey = 'features.marks.mark';
    let customMarks=[], loadingMarks=false, loadedMarks=false;
    async function loadMarks() {
      if (!markLibrary || loadingMarks || loadedMarks) return;
      loadingMarks=true;
      try {
        const rows=await markLibrary.list();
        if (!dialog.open) return;
        for(const row of rows) if(!customMarks.some(item=>item.url===row.url)) customMarks.push(row);
        loadedMarks=true;
        if(mode.id==='features') renderFields();
      } catch (error) {
        if(dialog.open && mode.id==='features') status.textContent='读取我的贴图失败：'+error.message;
      } finally {loadingMarks=false;}
    }
    const marks = window.createRoleStudioMarks({
      host:$('.rs-marks'), presets:fieldsByKey.get(markKey).images, controls:()=>draft.controls, setValue,
      getSlot:()=>slot, sources:()=>renderer.framingSources(), legacySources:()=>renderer.previewSources(),
      faceBounds:url=>appearancePreview.faceBounds?.(url), surfaceFor:appearancePreview.surfaceFor,
      editable:()=>!busy && mode.id==='features' && !comparing,
      changed:()=>{renderFields();preview()}, commit,
    });
    function setValue(key,v) {
      const field=fieldsByKey.get(key);
      if(v===undefined || v===field?.default || (v==='' && !(field?.toggleable && field.default))) delete draft.controls[key];
      else draft.controls[key]=v;
    }
    const value=key=>fieldsByKey.get(key)?.read?.(draft.controls) ?? draft.controls[key] ?? fieldsByKey.get(key)?.default;
    const prompts=window.CanvasFlowRolePrompts;
    function summary(includeVoice, excluded) {
      const lines=[];
      for(const [key,f] of fieldsByKey) {
        if(excluded?.has(key) || (key.startsWith('voice.') && !includeVoice)) continue;
        const prefix=key.slice(0,key.lastIndexOf('.')+1);
        if(key===markKey || f.filterOnly || (f.activeWhen && !matchesCondition(prefix,f.activeWhen)))continue;
        if(Object.hasOwn(draft.controls,key) || (f.activeWhen && (f.read || f.id.endsWith('Strength')))) {
          const v=value(key);
          if(key.startsWith('voice.')) lines.push(f.label+'：'+(f.labels?.[v] || (v===true?'开启':v)));
          else {
            lines.push(prompts.fieldText(key,f,v));
            if(prompts.hasOverride('step.'+key)) lines.push(prompts.stepText(key,f,v));
          }
        }
      }
      lines.push(...marks.describe((item,view)=>prompts.format('marks.item',{
        ...item,view,value:prompts.selectedText(markKey,fieldsByKey.get(markKey),item.preset)
      },'{value}位于{view}图横向{x}%、纵向{y}%，宽{size}%，旋转{turn}°')));
      if(includeVoice && draft.controls['voice.selection']) {
        try {const v=JSON.parse(draft.controls['voice.selection']); if(v.name) lines.push('音色：'+v.name)} catch {}
      }
      if(includeVoice && draft.controls['voice.design.description']) lines.push('声音描述：'+draft.controls['voice.design.description']);
      if(wardrobeUrls().length||draft.controls['outfit.ai.outfitNotes']) {
        const skill=value('outfit.ai.stylingSkill');
        if(skill==='妆造复刻')lines.push(prompts.format('ai.replicate',{},'保留本角色身份，按造型参考与描述复刻发型、发色、妆容和衣着细节。'));
        if(skill==='人设定制造型')lines.push(prompts.format('ai.design',{},'结合原角色设定与要求，为人物选择协调的服装、发型与妆容。'));
      }
      return lines.join('；');
    }
    const renderer=window.createRoleStudioRenderer({role,isActive:()=>dialog.isConnected&&dialog.open,
      onModelChange:id=>{modelId=id;picker.value=id;},
      onProgress:({slot:which,half,completed,total,phase,omittedReferences=[]})=>{
        if(phase==='checkpoint'){flushDraft();buttons();return;}
        if(phase==='completed') flushDraft();
        omittedReferences.forEach(label=>omittedLabels.add(label));
        status.textContent=`${phase==='completed'?'已生成':'正在生成'}${half?'半身图':['全身图','面部特写','表情九宫格','人物设定板'][which]}（${completed}/${total}）`+omission();
      }});
    function omission(){return omittedLabels.size?'。以下调整仅按文字生成：'+[...omittedLabels].join('、'):'';}
    const wardrobeUrls=()=>draft.outfitUrls ?? (draft.outfitUrl ? [draft.outfitUrl] : []);
    function snapshot(){return JSON.stringify({draft,frame:renderer.capture(draft.controls,wardrobeUrls())});}
    function clearDraft() {
      clearTimeout(draftTimer);
      for (const store of ['sessionStorage','localStorage']) {
        try {
          const prior=loadDraft(store);
          const inherited=prior && cached && prior.owner===cached.owner && JSON.stringify(prior)===JSON.stringify(cached);
          if (prior && (prior.owner===owner || inherited)) window[store].removeItem(draftKey);
        } catch {}
      }
    }
    function flushDraft() {
      clearTimeout(draftTimer);
      if (!initialSnapshot || !dialog.open) return true;
      const snap=snapshot();
      if (snap===initialSnapshot && !submission) { clearDraft(); return true; }
      const ui={mode:mode.id,tab:tab.id,slot,modelId:preferredModelId,generateAssets:assets.checked,filters:[...panelFilters]};
      const encoded=JSON.stringify({owner,source:role,revision:expectedRevision,state:JSON.parse(snap),ui,submission});
      let wrote=false;
      for (const store of ['sessionStorage','localStorage']) {
        try { window[store].setItem(draftKey,encoded); wrote=true; } catch {}
      }
      if (!wrote) status.textContent='本机草稿空间不足，请保存角色。';
      return wrote;
    }
    function queueDraft() {
      clearTimeout(draftTimer);
      draftTimer=setTimeout(flushDraft,180);
    }
    function visibilityChanged() { if (document.visibilityState==='hidden') flushDraft(); }
    function commit() {
      const snap=snapshot();
      if(snap!==history[cursor]) {
        history.splice(cursor+1);history.push(snap);
        if(history.length>60) history.shift();
        cursor=history.length-1;
        queueDraft();
      }
      buttons();
    }
    function travel(step) {
      commit();
      if(cursor+step<0||cursor+step>=history.length) return;
      const state=JSON.parse(history[cursor+=step]);
      draft=state.draft;renderer.restore(draft.controls,wardrobeUrls(),state.frame);nameInput.value=draft.name;
      voicePanel?.sync(draft.controls);renderFields();preview();buttons();queueDraft();
    }
    let initialSnapshot='';
    function changed(){return snapshot()!==initialSnapshot;}
    function buttons() {
      fitName();
      const {total:count,primary,derived,pending,stale}=renderer.plan(draft.controls,wardrobeUrls());
      estimate.textContent=assets.checked?(count?'· 预计 '+count+' 次图片生成（'+[primary?'全身主图 1 次':'',derived?'衍生资产 '+derived+' 次':''].filter(Boolean).join('，')+'）':'· 已全部生成') : '';
      estimate.title=primary?'保存时先生成全身主图。也可先切换至全身并点击生成，确认主图后再保存。'
        :derived?'保留当前全身主图，只生成缺少的面部特写、表情九宫格或设定板。':'保留角色已有的四张图片。';
      if (!assets.checked && stale) estimate.textContent='· 保存新参数，沿用上次图片';
      else if (!assets.checked && count) estimate.textContent='· 保存已有图片，另有 '+count+' 项尚未生成';
      if (pending) estimate.textContent=assets.checked && count ? estimate.textContent+'，另有 '+pending+' 个已提交任务' : '· 接续 '+pending+' 个已提交任务，无新增调用';
      action('undo').disabled=busy||cursor===0;action('redo').disabled=busy||cursor===history.length-1;
      updateCompare();
      const emptyAI=mode.id==='outfit' && tab.id==='ai' && !hasStylingInput();
      action('smart').disabled=busy||loadingModels||!modelId;
      const manualMode=mode.id==='outfit' && tab.id!=='ai';
      action('generate').disabled=busy||(!pending&&(loadingModels||!modelId||emptyAI||(manualMode?!manualSelection(stale).length:!hasVisualEdits())));
      action('generate').lastChild.textContent=pending?'继续已提交任务':'确认生成';
      action('back').disabled=action('close').disabled=voiceSaving;
      const promptButton=$('[data-rs="edit-prompts"]');
      if (promptButton) promptButton.disabled=busy || voiceSaving;
      action('save').disabled=action('apply').disabled=voiceSaving||busy||!draft.name.trim()||(assets.checked&&count>0&&(loadingModels||!modelId)&&!submission);
      for (const toggle of $$('[data-save-menu]')) toggle.disabled = action('save').disabled;
      picker.disabled=busy||loadingModels;
      assets.disabled=busy||loadingModels||!models.length;
      dialog.setAttribute('aria-busy',String(busy || voiceSaving));
    }
    function hasStylingInput(){return !!(String(draft.controls['outfit.ai.outfitNotes'] || '').trim() || wardrobeUrls().length);}
    function hasVisualEdits(){return !!wardrobeUrls().length || Object.keys(draft.controls).some(k=>!k.startsWith('voice.')&&!fieldsByKey.get(k)?.filterOnly) || renderer.isRendered(slot,draft.controls,wardrobeUrls());}
    function refreshNav() {
      photo.dataset.view=slot?'half':'full';
      for(const b of $$('[data-mode]')) b.setAttribute('aria-pressed',String(b.dataset.mode===mode.id));
      for(const [s,n] of [[1,'half'],[0,'full']]) action(n).setAttribute('aria-pressed',String(slot===s));
    }
    let framingKey='', camera=null;
    function fit() {
      fitName();
      if(!img.naturalWidth || !photo.clientWidth || !photo.clientHeight) return;
      const styles=getComputedStyle(photo);
      const left=parseFloat(styles.paddingLeft), top=parseFloat(styles.paddingTop);
      const w=photo.clientWidth-left-parseFloat(styles.paddingRight);
      const h=photo.clientHeight-top-parseFloat(styles.paddingBottom);
      const fitScale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
      const baseW=img.naturalWidth*fitScale, baseH=img.naturalHeight*fitScale;
      const width=baseW*(camera?.zoom ?? 1), height=baseH*(camera?.zoom ?? 1);
      // Lay out the masked portrait at its displayed size so zoom never stretches a composited layer.
      box.style.width=width+'px';box.style.height=height+'px';
      box.style.left=(left+w/2-width*(camera?.x ?? 0.5))+'px';
      box.style.top=(top+(h-baseH)/2+(camera ? 0.26*baseH-height*camera.y : 0))+'px';
      appearancePreview.refreshResolution?.();
    }
    const observer=new ResizeObserver(fit); observer.observe(photo);
    img.onload=()=>{box.hidden=false;$('.rs-no-image').hidden=true;fit()};
    img.onerror=()=>{box.hidden=true;$('.rs-no-image').hidden=false;$('.rs-no-image').textContent='角色图片无法加载'};
    function updateFraming(url,crop) {
      const key=crop && url ? url : '';
      if (key===framingKey) return;
      framingKey=key;
      camera=key ? {zoom:2,x:0.5,y:0.15} : null;
      fit();
      if (!key) return;
      appearancePreview.faceBounds(url).then(face=>{
        if (framingKey!==key || !face || !dialog.isConnected) return;
        camera={zoom:Math.min(3.75,Math.max(1,0.27/face.height)),x:face.x+face.width/2,y:face.y+face.height/2};
        fit();
      });
    }
    function preview() {
      refreshNav();
      const editingMarks=mode.id==='features' && !!marks.current();
      const frame=renderer.viewFrame(slot,draft.controls,wardrobeUrls(),comparing||editingMarks);
      const src=frame.url;
      updateFraming(src,frame.crop);
      if(src && src!==img.getAttribute('src')) {img.src=src;box.hidden=false;$('.rs-no-image').hidden=true}
      else if(!src){img.removeAttribute('src');box.hidden=true;$('.rs-no-image').hidden=false}
      const actual=!editingMarks && frame.rendered;
      appearancePreview.update({controls:draft.controls,slot,enabled:!comparing&&!actual});
      marks.update(!comparing && !actual);
      action('compare').setAttribute('aria-pressed',String(comparing));
      updateCompare();
    }
    const genderText = [role.gender, ...(role.tags || [])].join(' ');
    const male = /男|\bmale\b/i.test(genderText), female = /女|\bfemale\b/i.test(genderText);
    const gender = male === female ? 'any' : female ? 'female' : 'male';
    const panelFilters = new Map();
    for (const [key, field] of fieldsByKey) {
      if (field.filterOnly && Object.hasOwn(initial.controls, key)) {
        panelFilters.set(key, initial.controls[key]);
        delete initial.controls[key];
        delete draft.controls[key];
      }
      if (!field.groupsByGender || !draft.controls[key]) continue;
      const prefix = key.slice(0, key.lastIndexOf('.') + 1);
      const group = Object.entries(field.groupsByGender[gender]).find(([, ids]) => ids.includes(draft.controls[key]));
      if (group && !panelFilters.has(prefix + field.dependsOn)) panelFilters.set(prefix + field.dependsOn, group[0]);
    }
    initialSnapshot=snapshot();history=[initialSnapshot];
    if(cached) {
      draft=cached.state.draft;
      const ui=cached.ui;
      mode=modes.find(m=>m.id===ui?.mode) || mode;
      tab=mode.tabs.find(t=>t.id===ui?.tab) || mode.tabs[0];
      slot=ui?.slot===0 ? 0 : 1;
      if(Array.isArray(ui?.filters)) for(const entry of ui.filters) {
        if(Array.isArray(entry) && fieldsByKey.get(entry[0])?.filterOnly) panelFilters.set(entry[0],entry[1]);
      }
      action('smart').hidden=mode.id!=='face';
      renderer.restore(draft.controls,wardrobeUrls(),cached.state.frame);
      history.push(snapshot());cursor=1;
    }
    $('.rs-conflict').hidden=!conflict;
    window.addEventListener('pagehide',flushDraft);
    document.addEventListener('visibilitychange',visibilityChanged);
    function panelValue(key) {
      const field = fieldsByKey.get(key);
      if (key === markKey) return marks.current();
      if (!field?.filterOnly) return value(key);
      const choices = field.optionsByGender?.[gender] || field.options;
      const selected = panelFilters.get(key);
      return choices.includes(selected) ? selected : choices[0];
    }
    function matchesCondition(prefix, condition) {
      if (!condition) return true;
      const selected = panelValue(prefix + condition.id);
      return Object.hasOwn(condition, 'not') ? selected !== condition.not : selected === condition.value;
    }
    function renderFields() {
      colorPicker?.dismiss();colorPicker=null;
      const active = document.activeElement;
      const target = fields.contains(active) || tabs.contains(active) ? active.dataset : {};
      const scroll = fields.scrollTop;
      const body = $('.rs-body'), bodyScroll = body.scrollTop;
      const isVoice=mode.id==='voice';
      fields.hidden=isVoice;tabs.hidden=isVoice||mode.tabs.length===1;$('.rs-voice-host').hidden=!isVoice;
      $('.rs-image-actions').hidden=isVoice;
      if(isVoice) {
        if(!voicePanel) voicePanel=window.mountRoleStudioVoice($('.rs-voice-host'),{controls:draft.controls,role,
          onChange:(key,v)=>{setValue(key,v);commit()},onStatus:msg=>{status.textContent=msg||''},
          onSavingChange:saving=>{voiceSaving=saving;buttons()}});
        return;
      }
      voicePanel?.stopPlayback();
      tabs.classList.toggle('rs-face-tabs',mode.id==='face');
      tabs.innerHTML=mode.tabs.map(t=>`<button data-tab="${t.id}" aria-label="${esc(t.label)}" title="${esc(t.label)}" aria-pressed="${t===tab}">${mode.id==='face'?icon(t.id):''}<span>${esc(t.label)}</span></button>`).join('');
      const prefix=`${mode.id}.${tab.id}.`;
      const visible = tab.fields.filter(f => matchesCondition(prefix, f.visibleWhen) && matchesCondition(prefix, f.activeWhen));
      const parts=visible.map(f=>{
        const key=prefix+f.id,v=panelValue(key), id='rs-'+key, label=esc(f.label);
        const hint=f.hint?` <span tabindex="0" title="${esc(f.hint)}" aria-label="${esc(f.hint)}">ⓘ</span>`:'';
        if(f.type==='range')return `<div class="rs-slider"><label for="${id}"><span>${label}${hint}</span><output for="${id}">${esc(String(v))}</output></label><input id="${id}" type="range" data-field="${key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${Number(v)}"></div>`;
        if(f.type==='switch')return `<label class="rs-switch">${label}${hint}<input type="checkbox" data-field="${key}" ${v?'checked':''}></label>`;
        if(f.type==='text')return `<label class="rs-field">${label}<textarea maxlength="1200" data-field="${key}" placeholder="${esc(f.placeholder||'')}">${esc(v||'')}</textarea></label>`;
        const groups = f.groupsByGender?.[gender] || f.groups;
        const choices = groups ? groups[panelValue(prefix + f.dependsOn)] || [] : f.optionsByGender?.[gender] || f.options || [];
        if (f.display === 'select') {
          const options = choices.map(opt => `<option value="${esc(opt)}"${opt === v ? ' selected' : ''}>${esc(f.labels?.[opt] || opt)}</option>`).join('');
          const localSkill=f.id==='stylingSkill' && window.CanvasFlowRoleStyling.skillTitle(v);
          return `<label class="rs-field">${label}<select data-field="${key}">${options}</select>${localSkill?`<small class="rs-hint">本地 Skill · ${esc(localSkill)}</small>`:''}</label>`;
        }
        const cls={cards:'rs-cards',swatches:'rs-swatches'}[f.display]||'rs-options';
        const swatchChoices=f.customColor ? [...new Set([...choices,...customSwatches,...(hexColor(v)?[v]:[])])] : choices;
        const choicesHtml=swatchChoices.map(opt=>{
          const color=f.colors?.[opt] || (f.customColor && hexColor(opt) ? opt : ''), image=f.images?.[opt], caption=f.labels?.[opt] || opt;
          const accessibleName=color ? f.label + ' ' + caption + (caption !== color ? '（' + color + '）' : '') : caption;
          return `<button type="button" data-option="${key}" data-value="${esc(opt)}" aria-label="${esc(accessibleName)}" aria-pressed="${v===opt}" title="${esc(accessibleName)}"${color?` style="--rs-swatch:${esc(color)}"`:''}>${image?`<img alt="" src="${esc(image)}">`:''}${color?'':`<span>${esc(caption)}</span>`}</button>`;
        }).join('');
        const custom=f.customColor?`<button type="button" data-color-picker="${key}" aria-label="自定义颜色" title="自定义颜色" aria-haspopup="dialog" aria-expanded="false">＋</button>`:'';
        const note=f.previewNote?`<small class="rs-hint">${esc(f.previewNote)}</small>`:'';
        return `<section class="rs-field"><strong>${esc(f.displayLabel||f.label)}</strong>${note}<div class="${cls}" role="group" aria-label="${label}">${choicesHtml}${custom}</div></section>`;
      });
      if(mode.id==='outfit' && tab.id==='ai') {
        const refs=wardrobeUrls(), full=refs.length >= maxOutfits;
        const thumbs=refs.map((url,i)=>`<div class="rs-outfit-item"><img class="rs-outfit-thumb" src="${esc(url)}" alt="服装参考图 ${i+1}"><span>${i+1}</span><button type="button" data-action="remove-outfit" data-index="${i}" aria-label="移除第 ${i+1} 张参考图" title="移除参考图">×</button></div>`).join('');
        const reference = `<section class="rs-field"><strong>造型参考图</strong><div class="rs-outfit-list">${thumbs}</div><div class="rs-reference-actions"><button type="button" data-action="upload-outfit" ${full?'disabled':''}>本地上传</button><button type="button" data-action="pick-history" ${full?'disabled':''}>生成历史</button><button type="button" data-action="pick-reference" ${full?'disabled':''}>画布与素材库</button></div><input hidden multiple class="rs-upload" type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传参考图"></section>`;
        parts.splice(visible.findIndex(f => f.id === 'stylingSkill'), 0, reference);
      }
      if(mode.id==='features') {
        void loadMarks();
        if(customMarks.length) {
          const buttons=customMarks.map(({name,url},index)=>
            `<button type="button" data-custom-mark="${index}" aria-label="${esc(name)}"><img alt="" src="${esc(url)}"><span>${esc(name)}</span></button>`);
          parts.push(`<section class="rs-field"><strong>我的贴图</strong><div class="rs-cards" role="group" aria-label="我的贴图">${buttons.join('')}</div></section>`);
        }
      }
      fields.innerHTML=parts.join('');
      const selector = target.option ? `[data-option="${CSS.escape(target.option)}"][data-value="${CSS.escape(target.value)}"]`
        : target.tab ? `[data-tab="${CSS.escape(target.tab)}"]`
        : target.field ? `[data-field="${CSS.escape(target.field)}"]` : '';
      if (selector) $(selector)?.focus({preventScroll:true});
      fields.scrollTop=scroll;
      body.scrollTop=bodyScroll;
    }
    function changeMode(id) {
      const next=modes.find(m=>m.id===id);if(!next)return;
      mode=next;tab=mode.tabs[0];
      action('smart').hidden=id!=='face';
      if(id==='face'||id==='features')slot=1;
      if(id==='outfit'||id==='body')slot=0;
      fields.scrollTop=0;renderFields();preview();buttons();
    }
    function changeField(target) {
      const key=target.dataset.field;if(!key) return;
      const next=target.type==='checkbox'?target.checked:target.type==='range'?target.valueAsNumber:target.value;
      if (fieldsByKey.get(key)?.filterOnly) { panelFilters.set(key, next); renderFields(); return; }
      if (key === 'face.eyes.lightAlphaLeft' || key === 'face.eyes.lightAlphaRight') {
        const other = key.endsWith('Left') ? 'face.eyes.lightAlphaRight' : 'face.eyes.lightAlphaLeft';
        draft.controls[other] ??= value(other);
        draft.controls[key] = next;
      }
      else setValue(key,next);
      if(key==='outfit.ai.stylingSkill')renderFields();
      const output=target.closest('.rs-slider')?.querySelector('output');if(output)output.value=String(next);
      preview();buttons();
    }
    function appendOutfit(url) {
      if (!url || wardrobeUrls().includes(url)) return;
      if (wardrobeUrls().length >= maxOutfits) throw Error('最多可添加 '+maxOutfits+' 张造型参考图。');
      draft.outfitUrls=[...wardrobeUrls(),url];
      delete draft.outfitUrl;
      commit(); renderFields(); preview();
    }
    async function readImages(files,isMark) {
      if(!files.length)return;
      await work(async()=>{
        for (const file of files) {
          if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error(file.name+' 格式不支持，请选 JPG、PNG 或 WebP 图片。');
          if(isMark) {
            const url=await upload(file);
            const item=markLibrary ? await markLibrary.add(url,file.name) : {url,name:file.name};
            if (!dialog.open) return;
            customMarks=[item,...customMarks.filter(row=>row.url!==item.url)];
            await addMark('自定义',url);break;
          }
          const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).join('.');
          let url=uploadedOutfits.get(hash);
          if (!url) {
            if (wardrobeUrls().length>=maxOutfits) throw Error('最多可添加 '+maxOutfits+' 张造型参考图。');
            url=await upload(file);
            uploadedOutfits.set(hash,url);
          }
          appendOutfit(url);
        }
        status.textContent='';
      });
    }
    function manualField(key) {
      return key.startsWith('outfit.styling.') || key === 'outfit.clothes.wardrobe';
    }
    function manualSelection(stale) {
      if(draft.manualStyling?.length)return draft.manualStyling;
      if(!stale)return [];
      return Object.entries(draft.controls).filter(([key,v])=>v && manualField(key) && !fieldsByKey.get(key)?.filterOnly)
        .map(([key,value])=>({key,value}));
    }
    function rememberManualSelection(key,selected) {
      if(!manualField(key) || fieldsByKey.get(key)?.filterOnly)return;
      const queue=draft.manualStyling || [], old=queue.find(step=>step.key===key);
      if(selected) {
        if(old)old.value=selected;
        else queue.push({key,value:selected});
      } else if(old)queue.splice(queue.indexOf(old),1);
      if(queue.length)draft.manualStyling=queue;else delete draft.manualStyling;
      if(!old && queue.length===2)status.textContent='多选将延长生成时间，建议逐个生成。';
    }
    async function addMark(preset,url) {
      await marks.add(preset,url);
      if(dialog.open){commit();renderFields();preview();}
    }
    function pick(key,v,applyColor=false) {
      const field = fieldsByKey.get(key);
      if (!field) return;
      if (field.filterOnly) {
        panelFilters.set(key, v);
        renderFields();
        return;
      }
      if(key===markKey) {
        if(v==='自定义')return $('.rs-mark-file').click();
        return work(()=>addMark(v));
      }
      if(!applyColor && field.toggleable && value(key)===v)v='';
      rememberManualSelection(key,v);
      // Re-selecting the original swatch is still an explicit styling step (and may have its own prompt).
      if(manualField(key) && field.toggleable && v && v===field.default)draft.controls[key]=v;
      else setValue(key,v);
      const prefix = mode.id + '.' + tab.id + '.';
      for (const dependent of tab.fields) {
        if (dependent.activeWhen?.id === field.id && dependent.activeWhen.not === v) {
          delete draft.controls[prefix + dependent.id];
        }
      }
      if (key === 'face.eyes.eyeLight' && v !== '无') {
        const left = prefix + 'lightAlphaLeft', right = prefix + 'lightAlphaRight';
        if (!Object.hasOwn(draft.controls, left) && !Object.hasOwn(draft.controls, right)) {
          setValue(left, 50); setValue(right, 50);
        }
      }
      commit();renderFields();preview();
    }
    function updateCompare() {
      if(comparing) return;
      const current=renderer.viewFrame(slot,draft.controls,wardrobeUrls());
      const original=renderer.viewFrame(slot,draft.controls,wardrobeUrls(),true);
      const visibleMarks=marks.current() && (!current.rendered || mode.id==='features');
      const painted=photo.querySelector('.rs-appearance-preview:not([hidden])');
      action('compare').disabled=busy || !current.url || !(visibleMarks || painted || current.url!==original.url);
    }
    function compare(active) {comparing=active;preview()}
    const compareButton=action('compare');
    compareButton.onpointerdown=e=>{if(!busy){compareButton.setPointerCapture(e.pointerId);compare(true)}};
    compareButton.onlostpointercapture=()=>compare(false);
    compareButton.onblur=()=>{if(comparing)compare(false)};
    compareButton.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();compare(true)}};
    compareButton.onkeyup=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();compare(false)}};
    function dispose(restore) {
      clearTimeout(draftTimer);
      window.removeEventListener('canvasflow:role-prompts-changed',refreshPromptState);
      window.removeEventListener('pagehide',flushDraft);
      document.removeEventListener('visibilitychange',visibilityChanged);
      if(leavePrompt?.open)leavePrompt.close('stay');
      marks.destroy();appearancePreview.destroy();
      voicePanel?.destroy();observer.disconnect();dialog.close();dialog.remove();
      if(restore && activator?.isConnected)activator.focus();
    }
    function confirmLeave(running) {
      const prompt=document.createElement('dialog');
      leavePrompt=prompt;
      prompt.className='rs-leave';prompt.setAttribute('role','alertdialog');
      prompt.setAttribute('aria-labelledby','rs-leave-title');prompt.setAttribute('aria-describedby','rs-leave-note');
      prompt.innerHTML='<form method="dialog"><h2 id="rs-leave-title"></h2><p id="rs-leave-note"></p><div><button value="stay" autofocus>取消</button><button value="leave"></button></div></form>';
      prompt.querySelector('h2').textContent=running?'生成尚未完成，确定离开？':'放弃未保存的修改？';
      prompt.querySelector('p').textContent=running?'后续角色资产将停止生成；已提交的任务会向供应商请求取消。':'放弃后将清除本次编辑草稿。已保存的角色会保留。';
      prompt.querySelector('[value=leave]').textContent=running?'取消生成并离开':'放弃并关闭';
      prompt.addEventListener('keydown',e=>e.stopPropagation());
      document.body.append(prompt);prompt.showModal();
      return new Promise(resolve=>{
        let settled=false;
        function finish(value) {
          if(settled)return;
          settled=true;
          if(prompt.open)prompt.close(value);
          leavePrompt=null;prompt.remove();resolve(value==='leave');
        }
        prompt.addEventListener('submit',event=>{event.preventDefault();finish(event.submitter?.value||'stay');});
        prompt.addEventListener('cancel',event=>{event.preventDefault();finish('stay');});
        prompt.addEventListener('close',()=>finish(prompt.returnValue),{once:true});
      });
    }
    async function leave(exit) {
      if(voiceSaving || deciding || (busy&&!generation))return;
      const running=generation;
      if(changed()||running){
        deciding=true;
        let release,confirmed;
        decisionGate=new Promise(resolve=>{release=resolve;});
        try {confirmed=await confirmLeave(!!running);}
        finally {deciding=false;decisionGate=null;release();}
        if(!confirmed||!dialog.isConnected||(busy&&!generation))return;
        running?.abort();
        if (!running) clearDraft();
        else if (!flushDraft()) {
          notify?.('已请求取消生成。本机草稿空间不足，本次修改未能暂存。');
        }
      } else clearDraft();
      dispose(!exit);if(exit)exitLibrary?.();
    }
    async function work(fn, generating=false) {
      if(busy)return;busy=true;comparing=false;generation=generating?new AbortController():null;
      buttons();$('.rs-body').inert=true;$('.rs-header').inert=!generating;
      try {await fn()}catch(error){
        if(error?.payload?.error==='role_revision_conflict'){
          conflict=true;$('.rs-conflict').hidden=false;flushDraft();
        }
        status.textContent=error?.message||'操作失败，请重试。';
      }
      finally {busy=false;generation=null;if(dialog.isConnected){$('.rs-body').inert=false;$('.rs-header').inert=false;buttons();marks.refresh()}}
    }
    async function renderInput(intent){
      const visualReferences=[];
      const manual=manualSelection(intent==='manual' && renderer.plan(draft.controls,wardrobeUrls()).stale);
      const pendingKeys=new Set(manual.map(step=>step.key));
      omittedLabels=new Set();
      const previews=new Map(), controls={...draft.controls};
      const original=renderer.framingSources();
      function previewFor(which) {
        const view=which===0||which===3?'full':'half',src=view==='full'?original[0]||original[1]:original[1]||original[0];
        if(!previews.has(view)) previews.set(view,(async()=>{
          const canvas=await appearancePreview.referenceFor(src,controls).catch(()=>null);
          const omitted=src && !canvas && appearancePreview.hasLocalChanges(controls)?['当前视角未能定位的局部外观']:[];
          try {
            const result=await marks.composite(view,canvas,original);
            return result||omitted.length?{...result,omitted}:null;
          } catch {throw Error('无法读取贴图或其定位原图，请检查图片后重试。');}
        })());
        return previews.get(view);
      }
      for(const [key,field] of fieldsByKey){
        if(key===markKey||!field.images||!draft.controls[key])continue;
        const selected=draft.controls[key],url=field.images[selected];
        if(url)visualReferences.push({key,url,label:prompts.fieldText(key,field,selected)});
      }
      const stylingSteps=manual.flatMap(({key,value:selected})=>{
        const field=fieldsByKey.get(key);if(!field||!selected)return [];
        const label=prompts.selectedText(key,field,selected);
        const instructions=[prompts.stepText(key,field,selected)];
        if(prompts.hasOverride('field.'+key))instructions.push(prompts.fieldText(key,field,selected));
        return [{key,value:selected,prompt:instructions.join('\n'),image:field.images?.[selected],label}];
      });
      const styleAI=intent==='ai' ? {name:value('outfit.ai.stylingSkill'),brief:String(controls['outfit.ai.outfitNotes']||'').trim()} : null;
      return {slot,modelId,controls,stylingSteps:intent==='manual'||intent==='assets'?stylingSteps:[],styleAI,
        stylingBase:pendingKeys.size ? summary(false,pendingKeys) : '',
        onStylingStep:(key,selected)=>{
          draft.manualStyling=draft.manualStyling?.filter(step=>step.key!==key || step.value!==selected);
          if(!draft.manualStyling?.length)delete draft.manualStyling;
          commit();flushDraft();
        },prompt:summary(false),outfitUrl:wardrobeUrls()[0] || '',outfitUrls:wardrobeUrls(),visualReferences,previewFor,
        beforeSubmit:()=>decisionGate,signal:generation?.signal};
    }
    function generate(){
      return work(async()=>{
        const resumed=renderer.plan(draft.controls,wardrobeUrls()).pending;
        if (!resumed && mode.id==='outfit' && tab.id==='ai' && !hasStylingInput()) throw Error('请填写造型描述或添加参考图。');
        const intent=mode.id==='outfit'?(tab.id==='ai'?'ai':'manual'):null;
        if(!resumed && intent==='manual' && !manualSelection(renderer.plan(draft.controls,wardrobeUrls()).stale).length)throw Error('请选择需要调整的造型。');
        status.textContent=resumed?'正在取回上次生成的图片…':'正在准备角色参考图…';
        await renderer.generateView(await renderInput(intent));
        commit();status.textContent=(resumed?'已接收上次生成的图片':'当前视角已生成')+omission();preview();
      },true);
    }
    let retrySave;
    function save(apply, asNew = false){
      if(voiceSaving)return;
      if(!draft.name.trim()){nameInput.focus();return}
      const signature=()=>renderer.basisKey({'save.state':JSON.stringify([draft,renderer.capture(draft.controls,wardrobeUrls()),assets.checked,asNew])},[]);
      if(conflict&&!official&&!asNew&&submission?.signature!==signature()){$('.rs-conflict').hidden=false;return}
      const pending=renderer.plan(draft.controls,wardrobeUrls()).pending;
      const saveVersion=async()=>{
        if(resumeSave && submission?.signature===signature()){
          const result=await resumeSave(submission.operation,operation=>{submission.operation=operation;flushDraft();});
          clearDraft();dispose(false);saved(result,apply);
          return;
        }
        if (retrySave && retrySave.signature!==signature()) retrySave=null;
        if(!retrySave && assets.checked&&!official&&!asNew) await checkVersion?.(expectedRevision);
        if(!dialog.open||generation?.signal.aborted)return;
        if (!assets.checked && pending) await renderer.generateView(await renderInput());
        const items=!retrySave && assets.checked ? await renderer.preparePrimary(await renderInput('assets')) : [];
        if (decisionGate) await decisionGate;
        if(!dialog.open||generation?.signal.aborted)return;
        generation=null;$('.rs-header').inert=true;
        const name = asNew && !official && draft.name.trim() === role.name ? role.name.slice(0,35) + ' - 副本' : draft.name.trim();
        if (!retrySave) {
          const images=renderer.savedImages(draft.controls,wardrobeUrls());
          for (const {slot} of items) images[slot]='';
          const record={name,images,styling:{version:1,controls:{...draft.controls},prompt:summary(true),outfitUrl:wardrobeUrls()[0] || '',outfitUrls:wardrobeUrls(),...renderer.persistence(draft.controls,wardrobeUrls())}};
          const options={asNew:official||asNew,expectedRevision,sourceRecord:role,copyId:'char-'+crypto.randomUUID()};
          if(items.length) options.derivatives={id:crypto.randomUUID(),projectId:items[0].payload.projectId || '',items};
          retrySave={signature:signature(),record,options};
        }
        const result=await persist(retrySave.record,{...retrySave.options,onPrepared:operation=>{
          submission={signature:signature(),operation};
          flushDraft();
        }});
        clearDraft();
        dispose(false);saved(result,apply);
      };
      return work(()=>{
        if (official || asNew || !navigator.locks) return saveVersion();
        return navigator.locks.request(draftKey+'.save',{ifAvailable:true},lock=>{
          if (!lock) throw Error('另一个窗口正在保存此角色。请等待保存完成后重试，本窗口的修改仍在草稿中。');
          return saveVersion();
        });
      },assets.checked||pending);
    }
    function dismissSaveMenu(restoreFocus = false) {
      const toggle = $('[data-save-menu][aria-expanded=true]');
      if (!toggle) return;
      toggle.setAttribute('aria-expanded','false');
      toggle.nextElementSibling.hidden = true;
      if (restoreFocus) toggle.focus();
    }
    let pressedBackdrop=false;
    dialog.addEventListener('pointerdown', e => {
      pressedBackdrop=e.target===dialog && e.button===0;
      if (!e.target.closest('[data-save-menu],.rs-save-popup')) dismissSaveMenu();
      if(colorPicker && !colorPicker.element.contains(e.target) && !colorPicker.trigger.contains(e.target)){colorPicker.dismiss();colorPicker=null;}
    });
    dialog.addEventListener('focusin', e => {
      if (!e.target.closest('[data-save-menu],.rs-save-popup')) dismissSaveMenu();
    });
    dialog.addEventListener('click',e=>{
      if(e.target===dialog && pressedBackdrop) {
        pressedBackdrop=false;
        void leave(true);
        return;
      }
      const b=e.target.closest('button');if(!b||b.disabled)return;
      if(b.dataset.mode||b.dataset.tab||['half','full'].includes(b.dataset.action))queueDraft();
      if(busy&&!['close','back'].includes(b.dataset.action))return;
      if (b.dataset.rs === 'edit-prompts') { void editPrompts(mode.id, dialog); return; }
      if (b.dataset.colorPicker) {
        if(colorPicker?.element.isConnected){colorPicker.dismiss(true);colorPicker=null;return;}
        const key=b.dataset.colorPicker, initial=value(key);
        colorPicker=window.CanvasFlowRoleStyling.mountColorPicker(b,hexColor(initial)?initial:'#0b0b0b',color=>{
          if(!fieldsByKey.get(key).options.includes(color)) {
            for (const prior of storedSwatches())customSwatches.add(prior);
            customSwatches.add(color);
            try {localStorage.setItem(swatchKey,JSON.stringify([...customSwatches]));} catch {}
          }
          pick(key,color,true);
          $('[data-color-picker]')?.focus({preventScroll:true});
        });return;
      }
      if (b.dataset.saveMenu) {
        const opening = b.getAttribute('aria-expanded') !== 'true';
        dismissSaveMenu();
        if (opening) {
          b.setAttribute('aria-expanded','true');
          b.nextElementSibling.hidden = false;
          b.nextElementSibling.querySelector('button:enabled').focus();
        }
        return;
      }
      if (b.dataset.saveKind) {
        const apply = b.closest('.rs-save-group').querySelector('[data-save-menu]').dataset.saveMenu === 'apply';
        dismissSaveMenu(true);
        return save(apply, b.dataset.saveKind === 'new');
      }
      if(b.hasAttribute('data-custom-mark')) {
        const item=customMarks[Number(b.dataset.customMark)];
        if(item)return work(()=>addMark('自定义',item.url));
        return;
      }
      if(b.dataset.mode)return changeMode(b.dataset.mode);
      if(b.dataset.tab){tab=mode.tabs.find(t=>t.id===b.dataset.tab)||mode.tabs[0];fields.scrollTop=0;renderFields();buttons();return}
      if(b.dataset.option)return pick(b.dataset.option,b.dataset.value);
      switch(b.dataset.action){
        case 'reload-role':
          if(confirm('放弃这份草稿并返回角色库，查看最新版本？')){clearDraft();dispose(true);}
          return;
        case 'back':return leave(false);
        case 'close':return leave(true);
        case 'undo':return travel(-1);
        case 'redo':return travel(1);
        case 'smart': {
          const preset={'skin.smooth':20,'skin.glow':10,'eyes.brightEyeLeft':10,'eyes.brightEyeRight':10,
            'eyes.eyeSizeLeft':10,'eyes.eyeSizeRight':10,'lips.lipCorner':4,'shape.vFace':10,'shape.chinHeight':4};
          for(const [key,v] of Object.entries(preset))setValue('face.'+key,v);
          commit();renderFields();preview();return generate();
        }
        case 'half':case 'full':slot=b.dataset.action==='half'?1:0;return preview();
        case 'generate':return generate();
        case 'save':case 'apply':return save(b.dataset.action==='apply');
        case 'upload-outfit':return $('.rs-upload')?.click();
        case 'pick-history':case 'pick-reference':
          if (!pickReference) return $('.rs-upload')?.click();
          return work(async () => {
            await pickReference(b.dataset.action==='pick-history'?'history':'canvas',maxOutfits-wardrobeUrls().length,appendOutfit);
            status.textContent = '';
          }).finally(() => action(b.dataset.action)?.focus({preventScroll:true}));
        case 'remove-outfit':
          draft.outfitUrls=wardrobeUrls().filter((_,i)=>i!==Number(b.dataset.index));
          delete draft.outfitUrl;commit();renderFields();return preview();
      }
    });
    dialog.addEventListener('input',e=>{
      if(busy)return;
      queueDraft();
      if(e.target===nameInput){draft.name=nameInput.value;buttons();return}
      changeField(e.target);
    });
    dialog.addEventListener('change',e=>{
      if(busy)return;
      if(e.target.matches('.rs-upload,.rs-mark-file')){
        const files=Array.from(e.target.files); e.target.value='';
        return readImages(files,e.target.matches('.rs-mark-file'));
      }
      if(e.target===picker){
        const command=picker.selectedOptions[0]?.dataset.command;
        if(command) {
          picker.value=modelId;
          if(command==='configure') openImageModelSettings();
          else loadImageModels();
          return;
        }
        preferredModelId=modelId=picker.value;
        renderer.selectModel(modelId);
        queueDraft();preview();buttons();return;
      }
      if(e.target.dataset.field)changeField(e.target);
      commit();
    });
    dialog.addEventListener('keydown',e=>{
      e.stopPropagation();
      if ($('[data-save-menu][aria-expanded=true]')) {
        if (e.key === 'Escape') { e.preventDefault(); dismissSaveMenu(true); return; }
        if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
          const options = $$('.rs-save-popup:not([hidden]) button:enabled'), i = options.indexOf(document.activeElement);
          const index = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (i + (e.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
          e.preventDefault(); options[index]?.focus(); return;
        }
      }
      if(e.key==='Escape'){e.preventDefault();leave(false);return}
      if(busy)return;
      if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())&&!e.target.matches('textarea,input:not([type=range])')){
        e.preventDefault();travel(e.key.toLowerCase()==='y'||e.shiftKey?1:-1);
      }
    });
    dialog.addEventListener('cancel',e=>{e.preventDefault();leave(false)});
    dialog.addEventListener('keyup',e=>e.stopPropagation());
    nameInput.value=draft.name;$('.rs-identity small').textContent=(role.tags||[]).join(' · ');
    function refreshPromptState(){if(dialog.isConnected && !busy){preview();buttons();}}
    window.addEventListener('canvasflow:role-prompts-changed',refreshPromptState);
    document.body.append(dialog);dialog.showModal();renderFields();preview();buttons();
    function openImageModelSettings() {
      const settings=window.CanvasFlowSettings, backdrop=document.getElementById('settingsBackdrop');
      if(!settings || !backdrop)return;
      settings.open('mainProviders');
      if(!settings.isOpen())return;
      dialog.close();
      backdrop.querySelector('#settingsClose')?.focus();
      backdrop.addEventListener('canvasflow:settings-closed',()=>{
        if(!dialog.isConnected)return;
        dialog.showModal();
        void loadImageModels().then(()=>{if(dialog.open && !busy)picker.focus({preventScroll:true});});
      },{once:true});
    }
    function addModelCommand(text,command) {
      const option=new Option(text,'__'+command+'__');
      option.dataset.command=command;picker.add(option);
    }
    async function loadImageModels(initialLoad=false) {
      loadingModels=true;picker.setAttribute('aria-busy','true');buttons();
      let placeholder='暂无可用图片模型', failed=false;
      try {
        const [list]=await Promise.all([renderer.models(), initialLoad && refreshPrompts?.()]);
        if(!dialog.isConnected)return;
        const needsIdentity=(role.images||[]).some(Boolean)||(role.styling?.sourceImages||[]).some(Boolean);
        models=needsIdentity?list.filter(m=>m.maxReferences!==0):list;
        if(list.length&&!models.length)placeholder='暂无支持参考图的模型';
      } catch {
        if(!dialog.isConnected)return;
        models=[];failed=true;placeholder='图片模型加载失败';
      }
      modelId=(models.find(m=>m.id===preferredModelId)||models.find(m=>m.isDefault)||models[0])?.id||'';
      if(modelId)preferredModelId=modelId;
      picker.replaceChildren();
      if(!models.length){
        const empty=new Option(placeholder,'');
        empty.disabled=true;picker.add(empty);
      }
      const names=new Set(), duplicates=new Set();
      for(const m of models){if(names.has(m.name))duplicates.add(m.name);names.add(m.name);}
      for(const m of models)picker.add(new Option(duplicates.has(m.name)?m.name+' · '+m.id:m.name||m.id,m.id));
      if(failed)addModelCommand('重新加载','retry');
      if(window.CanvasFlowSettings)addModelCommand('配置图片模型…','configure');
      picker.value=modelId;renderer.selectModel(modelId);
      if(initialLoad && !changed()){initialSnapshot=snapshot();history=[initialSnapshot];cursor=0;}
      if(initialLoad)assets.checked=!!modelId && cached?.ui?.generateAssets!==false;
      if(!modelId)assets.checked=false;
      assets.title=modelId?'将使用所选图片模型生成角色资产':'请先配置可用的图片模型';
      loadingModels=false;picker.removeAttribute('aria-busy');buttons();
    }
    void loadImageModels(true);
  }
  window.CanvasFlowRoleStudio={open};
})();

