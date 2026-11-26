(() => {
  'use strict';
  const defaults = [
    ['young','青涩青年音色','男','青年'], ['elite','精英青年音色','男','青年'], ['bold','霸道青年音色','男','青年'], ['campus','青年大学生音色','男','青年'],
    ['girl','少女音色','女','青年'], ['lady','御姐音色','女','成年'], ['mature','成熟女性音色','女','成年'], ['sweet','甜美女性音色','女','青年'],
  ];
  const voices = [...defaults, ...defaults.map(([id, name, gender, age]) => [id + '-beta', name + '-beta', gender, age]),
    ['clever-boy','聪明男童','男','儿童'], ['cute-boy','可爱男童','男','儿童'], ['cute-girl','萌萌女童','女','儿童'], ['cartoon','卡通猪小琪','Character','儿童'],
  ].map(([id,name,gender,ageGroup]) => ({id, name, gender, ageGroup, language:'中文', accent:'普通话', source:'library', url:'assets/role-studio/voices/' + id + '.mp3'}));
  const cues = ['明亮、略带羞涩，说话轻柔自然','成熟沉着，吐字干净，节奏利落','声线低沉坚定，语速略慢','轻快开朗，校园生活的自然口语',
    '少女声线清亮活泼','御姐声线从容有力','成熟女声沉静温和','甜美女声柔和亲切','男童声音灵巧活跃','男童声音稚嫩柔软','女童声音清脆可爱','活泼夸张的高音卡通声线'];
  window.roleStudioVoicePreset = id => {
    const i = voices.findIndex(v => v.id === id);
    if (i < 0) return null;
    const description = cues[i < 16 ? i % 8 : i - 8] + (i >= 8 && i < 16 ? '，语调起伏更鲜明' : '');
    const masculine = (i < 16 && i % 8 < 4) || i === 16 || i === 17;
    return {description:'用普通话朗读，' + description, base:masculine ? 'onyx' : 'nova'};
  };
  const element = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };
  const button = (cls, text, action) => {
    const el = element('button', cls, text);
    el.type = 'button'; el.addEventListener('click', action);
    return el;
  };
  const icon = playing => playing
    ? '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z"/></svg>'
    : '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="m5 2 9 6-9 6z"/></svg>';
  const key = 'voice.selection';
  const designKey = 'voice.design.description';
  const tabNames = {library:'音色库', mine:'我的音色', design:'AI 生成'};
  const dimensions = {language:'语言', accent:'口音', gender:'性别', ageGroup:'年龄段', scene:'场景', capability:'能力'};
  const standard = {
    language:'中文 英文 日文 韩文 西班牙文 葡萄牙文 法文 印尼文 德文 俄文 意大利文 阿拉伯文 土耳其文 乌克兰文 荷兰文 越南文 泰文 波兰文 罗马尼亚文 希腊文 捷克文 芬兰文 印地文'.split(' '),
    gender:['男','女'], ageGroup:['青年','成年','儿童','老年'],
  };
  const distinct = values => [...new Set(values.filter(Boolean))];
  const accentsFor = (language,linked) => distinct([...(language==='中文'?['普通话','粤语']:[]),...(linked?.[language] || [])]);
  const pageSize = 20;
  const previewLine = '你好，我是你的角色，很高兴和你见面。';
  let fieldNumber=0;

  window.mountRoleStudioVoice = function (host, {controls = {}, onChange, onStatus, onSavingChange, role = {}}) {
    let values = {...controls}, tab = 'library', open = true;
    let mine = [], available = [], pending = false, loadedMine = false, loadedModels = false, loadingModels = false;
    const initial = selected();
    let currentModel = '', libraryModel = initial?.source === 'provider' ? initial.profile?.modelId || '' : '';
    let playing = null, sample = null, statusText = '';
    let edit = null, pageObserver = null;
    const history = [];
    let refreshTimer = 0, historyVersion = 0, historyTotal=0;
    const queries = {library:'', mine:''}, filters = {library:{}, mine:{}};
    const service = window.createRoleVoiceService(() => open && host.isConnected);
    const root = element('section', 'rs-voice');
    const tabs = element('div','rs-tabs rs-voice-tabs');
    tabs.setAttribute('aria-label','音色来源');
    tabs.setAttribute('role','tablist');
    const content = element('div','rs-voice-body');
    const status = element('p','rs-voice-status');
    status.setAttribute('role','status');
    root.append(tabs, content, status);
    host.replaceChildren(root);

    function message(text, notify = false) {
      statusText = text || '';
      status.hidden = !statusText;
      status.textContent = statusText;
      if (notify && open) onStatus?.(statusText);
    }
    function selected() {
      try { return JSON.parse(values[key] || 'null'); } catch { return null; }
    }
    function setValue(k, value) {
      if (values[k] === value) return;
      values[k] = value;
      onChange(k, value);
    }
    function updateCards() {
      const choice = selected();
      for (const row of content.querySelectorAll('[data-rs-voice-card]')) {
        const id = row.dataset.rsVoiceCard;
        const active = id === choice?.id;
        row.classList.toggle('is-selected', active);
        row.querySelector('.rs-voice-select').setAttribute('aria-pressed', String(active));
        const play = row.querySelector('.rs-voice-play');
        if (!play) continue;
        const activePlay = id === playing?.id;
        play.setAttribute('aria-pressed', String(activePlay));
        play.setAttribute('aria-label', (activePlay ? '停止试听' : '试听') + row.dataset.name);
        play.innerHTML = icon(activePlay);
      }
    }
    function stop(except = null) {
      for (const player of content.querySelectorAll('audio')) if (player !== except && !player.paused) player.pause();
      if (sample) {
        sample.onended = null; sample.onerror = null; sample.pause(); sample = null;
      }
      playing = null;
      updateCards();
    }
    content.addEventListener('play', event => {
      if (event.target instanceof HTMLAudioElement) stop(event.target);
    }, true);
    function play(voice) {
      const same = playing?.id === voice.id;
      stop();
      if (same) return;
      const audio = new Audio(voice.url);
      sample = audio; playing = voice;
      message('');
      updateCards();
      audio.onended = () => { if (audio === sample) stop(); };
      const failed = () => {
        if (audio !== sample) return;
        stop(); message('音色样本播放失败，请检查音频文件后重试。', true);
      };
      audio.onerror = failed;
      audio.play().catch(failed);
    }
    function choose(voice) {
      if (!bindable(voice)) return;
      if (playing && playing.id !== voice.id) stop();
      const {id,name,url,source,profile,language,gender,ageGroup,accent,description} = voice;
      setValue(key, JSON.stringify({id,name,url,source,profile,language,gender,ageGroup,accent,description}));
      if (profile?.modelId && available.some(m=>m.id===profile.modelId && m.design)) currentModel = profile.modelId;
      updateCards();
      const caption = content.querySelector('.rs-current-voice');
      if (caption) { caption.textContent = '已选择「'+name+'」'; caption.hidden = false; }
    }
    function bindable(voice) {
      if (window.roleStudioVoicePreset(voice.id)) return true;
      const profile = voice.profile;
      if (!profile?.modelId || profile.kind === 'preview') return false;
      const value = voice.source === 'provider' || profile.kind === 'registered' ? profile.voice : profile.description;
      return typeof value === 'string' && !!value.trim();
    }
    function cards(container, list) {
      const grid = element('div', 'rs-voice-grid');
      for (const v of list) {
        const item = element('div','rs-voice-card');
        item.dataset.rsVoiceCard = v.id; item.dataset.name = v.name;
        const select = button('rs-voice-select','',() => choose(v));
        select.disabled = !bindable(v);
        const details = [v.language,v.accent,v.gender,v.ageGroup].filter(Boolean).join(' · ') || v.description || v.profile?.voice || '';
        const type = select.disabled ? '仅可试听' : v.source==='provider' || v.profile?.kind==='registered' ? '供应商音色' : '风格声线';
        select.append(element('strong','',v.name), element('small','',[details,type].filter(Boolean).join(' · ')));
        select.title = [details,v.description].filter(Boolean).join('\n');
        if (v.url) item.append(button('rs-voice-play','',() => play(v)));
        item.append(select); grid.append(item);
      }
      container.append(grid);
      updateCards();
    }
    function libraryPanel(list) {
      const scope = tab, provider = scope === 'library' ? libraryModel : '';
      if (scope === 'library') {
        const label = element('label','rs-field');
        label.append(element('span','','音色来源'));
        const source = element('select');
        source.add(new Option('内置风格示例',''));
        for (const m of available) source.add(new Option(m.name || m.model, m.id));
        if (provider && !available.some(m=>m.id===provider)) source.add(new Option(loadedModels?'已停用的角色语音模型':'正在读取角色语音模型…',provider));
        source.value = provider;
        source.onchange = () => {
          stop(); libraryModel = source.value; filters.library = {}; queries.library = ''; message(''); render();
          content.querySelector('.rs-field select')?.focus({preventScroll:true});
        };
        label.append(source); content.append(label);
        if (!provider) content.append(element('p','rs-voice-status','内置录音用于试听风格。朗读新台词时，语音模型会按风格描述合成。'));
      }
      const selectedName = selected()?.name, caption = element('p','rs-voice-status rs-current-voice',selectedName ? '已选择「'+selectedName+'」' : '');
      caption.hidden = !selectedName; content.append(caption);
      const bar = element('div','rs-voice-tools');
      const search = element('input'); search.type = 'search'; search.placeholder = '搜索音色';
      search.setAttribute('aria-label','搜索音色'); search.value = queries[tab];
      const toggle = button('rs-voice-filter','',() => openFilters());
      toggle.setAttribute('aria-label','筛选音色'); toggle.title = '筛选音色';
      toggle.setAttribute('aria-haspopup','dialog');
      toggle.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 6h9m3 0h4M2 14h3m3 0h10"/><circle cx="12.5" cy="6" r="1.6"/><circle cx="6.5" cy="14" r="1.6"/></svg>';
      bar.append(search,toggle); content.append(bar);
      const result = element('div','rs-voice-matches');
      const more = button('rs-voice-more','加载更多音色',() => load(false));
      const notice = element('p','rs-voice-status'); notice.setAttribute('role','status');
      let serial = 0, page = 0, loading = false, facets = {}, linkedAccents = {}, timer = 0;
      const valuesOf = (v, field) => {
        const value = String(v[field] || '').trim();
        return ['language','capability'].includes(field) ? value.split(/[,，、]/).map(x=>x.trim()).filter(Boolean) : value ? [value] : [];
      };
      function openFilters() {
        if (root.querySelector('.rs-voice-filter-dialog')) return;
        let draft = structuredClone(filters[scope]);
        const dialog = element('dialog','rs-voice-filter-dialog');
        dialog.setAttribute('aria-label','音色筛选');
        const heading = element('header'); heading.append(element('strong','','音色筛选'),button('','关闭',()=>dialog.close()));
        const body = element('div','rs-voice-filter-fields');
        const footer = element('footer');
        footer.append(button('','重置筛选',()=>{ draft={}; fields(); }),button('rs-voice-generate','筛选',()=>{
          filters[scope]=draft; dialog.close(); load(true);
        }));
        function fields() {
          body.replaceChildren();
          for (const [key,label] of Object.entries(dimensions)) {
            const choices=key==='accent' ? accentsFor(draft.language?.[0],linkedAccents) :
              distinct([...(standard[key] || []),...(facets[key] || [])]);
            if (!choices.length && key!=='accent') continue;
            const group=element(key==='ageGroup'?'fieldset':'label','rs-field');
            group.append(element(key==='ageGroup'?'legend':'span','',label));
            if (key==='ageGroup') {
              for (const value of choices) {
                const tag=button('',value,()=>{
                  const ages=draft[key]||[]; draft[key]=ages.includes(value)?ages.filter(v=>v!==value):[...ages,value];
                  tag.setAttribute('aria-pressed',String(draft[key].includes(value)));
                });
                tag.setAttribute('aria-pressed',String(!!draft[key]?.includes(value))); group.append(tag);
              }
            } else {
              const select=element('select'); select.add(new Option('全部',''));
              for (const value of choices) select.add(new Option(value,value));
              select.value=draft[key]?.[0]||''; select.disabled=key==='accent' && (!draft.language?.length || !choices.length);
              select.onchange=()=>{ draft[key]=select.value?[select.value]:[];
                if (key==='language') {delete draft.accent; fields(); body.querySelector('select')?.focus();}
              };
              group.append(select);
            }
            body.append(group);
          }
        }
        dialog.addEventListener('keydown',e=>e.stopPropagation());
        dialog.addEventListener('cancel',e=>e.stopPropagation());
        dialog.addEventListener('close',()=>{dialog.remove();toggle.focus({preventScroll:true});},{once:true});
        fields(); dialog.append(heading,body,footer); root.append(dialog); dialog.showModal();
      }
      async function load(reset) {
        if (!result.isConnected || (!reset && (loading || more.hidden))) return;
        const version = ++serial, nextPage = reset ? 1 : page + 1;
        loading = true; more.disabled = true; notice.textContent = provider ? '正在读取音色…' : '';
        if (reset) {
          page = 0; result.replaceChildren(); more.hidden = true;
          // Remote search can leave the entire grid empty until the next page arrives.
          if (provider && playing) stop();
        }
        try {
          let data;
          const q = queries[scope].trim().toLocaleLowerCase();
          if (provider) data = await service.providerPage(provider,nextPage,q,filters[scope]);
          else {
            const choices = {}, accents = {};
            for (const key of Object.keys(dimensions)) choices[key] = distinct(list.flatMap(v=>valuesOf(v,key)));
            for (const v of list) for (const language of valuesOf(v,'language')) accents[language] = distinct([...(accents[language] || []),v.accent]);
            const matches = list.filter(v => Object.entries(filters[scope]).every(([key,selected]) =>
              !selected.length || valuesOf(v,key).some(value=>selected.includes(value))) &&
              [v.name,v.description,...Object.keys(dimensions).map(key=>v[key])].filter(Boolean).join(' ').toLocaleLowerCase().includes(q));
            data = {facets:choices,accentsByLanguage:accents,voices:matches.slice((nextPage-1)*pageSize,nextPage*pageSize),total:matches.length,hasMore:nextPage*pageSize<matches.length};
          }
          if (!result.isConnected || version !== serial) return;
          page = nextPage; facets=data.facets || {}; linkedAccents=data.accentsByLanguage || {};
          const count=Object.values(filters[scope]).filter(v=>v.length).length;
          toggle.dataset.count=count || ''; toggle.title=count?'已筛选 '+count+' 项':'筛选音色';
          more.textContent = '加载更多音色';
          if (data.voices.length) cards(result,data.voices);
          else if (nextPage === 1) result.append(element('p','rs-voice-empty',scope === 'mine' && !loadedMine ? '正在读取我的音色…' : '暂无音色数据'));
          if (reset && playing && !data.voices.some(voice=>voice.id===playing.id)) stop();
          notice.textContent = data.total ? (data.source === 'spec' ? '模型已登记的音色 · ' : '') + '共 ' + data.total + ' 个音色' : '';
          if (data.warning) notice.textContent = '已读取目录中的 ' + data.total + ' 个匹配音色。' + data.warning;
          more.hidden = !data.hasMore;
        } catch (e) {
          if (!result.isConnected || version !== serial) return;
          notice.textContent = e.message; more.hidden = false; more.textContent = '重新读取音色';
        } finally {
          if (version === serial) { loading = false; more.disabled = false; }
        }
      }
      search.oninput = () => {
        queries[scope] = search.value; clearTimeout(timer);
        if (provider) { ++serial; more.hidden = true; timer = setTimeout(()=>load(true),180); }
        else load(true);
      };
      more.hidden = true; content.append(result,more,notice); load(true);
      if ('IntersectionObserver' in window) {
        pageObserver = new IntersectionObserver(entries => {
          if (page > 0 && more.textContent !== '重新读取音色' && entries.some(e=>e.isIntersecting)) load(false);
        });
        pageObserver.observe(more);
      }
    }
    async function loadMine() {
      try {
        const result = await service.mine();
        if (!open) return;
        mine = result; loadedMine = true;
        if (tab === 'mine') render();
      } catch (e) { if (open && tab === 'mine') message(e.message, true); }
    }
    async function loadModels() {
      if (loadingModels) return;
      loadingModels = true;
      try {
        const list = await service.models();
        if (!open) return;
        available = list; loadedModels = true;
        if (!list.some(m => m.design && m.id === currentModel)) currentModel =
          list.find(m=>m.design && m.id===selected()?.profile?.modelId)?.id || list.find(m=>m.design)?.id || '';
        if (tab !== 'mine') render();
      } catch (e) { if (open && tab !== 'mine') message(e.message, true); }
      finally { loadingModels = false; }
    }
    async function loadHistory(append=false, refreshOffset=null) {
      const version = ++historyVersion;
      clearTimeout(refreshTimer);
      try {
        const offset=refreshOffset ?? (append ? history.length : 0);
        const [page, savedVoices] = await Promise.all([service.history(offset),service.mine()]);
        if (!open || version !== historyVersion || pending || tab !== 'design') return;
        mine = savedVoices; loadedMine = true;
        const saved = new Map(mine.filter(item=>item.jobId).map(item=>[item.jobId,item]));
        const legacy = mine.filter(item=>!item.jobId && item.profile);
        historyTotal=page.total;
        const entries=page.entries;
        const next=entries.map(item => ({...item, saved:saved.get(item.id) ||
          legacy.find(v=>v.url===item.url && v.profile.modelId===item.profile?.modelId &&
            v.profile.voice===item.profile?.voice && v.profile.description===item.profile?.description)}));
        const combined=append ? [...history,...next] : refreshOffset !== null ?
          [...history.slice(0,offset),...next,...history.slice(offset+50)] : next;
        const seen=new Set();
        history.splice(0,history.length,...combined.filter(v=>!seen.has(v.id) && seen.add(v.id)));
        render();
        const pendingIndex=history.findIndex(item => ['running','queued'].includes(item.status));
        if (pendingIndex>=0) {
          refreshTimer = setTimeout(()=>loadHistory(false,Math.floor(pendingIndex/50)*50), 3000);
        }
      } catch (e) { if (open && tab === 'design') message(e.message, true); }
    }
    async function design() {
      if (pending || !currentModel) return;
      const details = [role.name && '角色：'+role.name,role.value && '人设：'+role.value,
        role.tags?.length && '角色特征：'+role.tags.join('、'),String(values[designKey] || '').trim()].filter(Boolean);
      const description = details.length ? ['请根据以下角色设定与音色描述设计可用于角色对白的声音。',...details].join('\n') : '';
      if (!description) { message('请描述角色的年龄感、声音质感或说话方式。'); return; }
      historyVersion++; clearTimeout(refreshTimer);
      pending = true; render(); message('音色生成中…');
      try {
        const choice = selected();
        const base = choice?.profile?.modelId === currentModel ? choice.profile.voice : '';
        const entry = await service.generate(currentModel, description, previewLine, (role.name || '角色') + '音色 ' + (history.length + 1), base);
        if (!open) return;
        history.unshift(entry);
        message('');
      } catch (e) { if (open) message(e.message, true); }
      finally {
        pending = false; if (open && tab === 'design') {
          render(); if (available.find(m=>m.id===currentModel)?.roleVoiceRegistration) void loadHistory();
        }
      }
    }
    async function keep(entry, form) {
      const submitted = edit;
      if (!submitted || submitted.saving || !form.reportValidity()) return;
      const {name,...metadata} = submitted.values;
      if (![name,metadata.language,metadata.ageGroup,metadata.gender].every(v=>v.trim())) return;
      submitted.saving = true;
      onSavingChange?.(true);
      for (const control of form.elements) control.disabled = true;
      try {
        const saved = await service.save(name.trim(), entry.url, entry.id, metadata);
        if (!open) return;
        mine = [saved,...mine.filter(v => v.id !== saved.id)];
        const result = history.find(v=>v.id===entry.id);
        if (result) result.saved = saved;
        edit = null;
        choose(saved); message('音色已保存到我的音色。');
        render();
      } catch (e) {
        if (open) {
          submitted.saving = false; for (const control of form.elements) control.disabled = false;
          message(e.message, true);
        }
      } finally {
        onSavingChange?.(false);
      }
    }
    function saveForm(entry) {
      const form = element('form','rs-voice-metadata');
      form.setAttribute('aria-label','保存音色资料');
      const limits = {name:100,language:80,ageGroup:40,gender:40,accent:80,description:2000};
      const required = ['name','language','ageGroup','gender'];
      function ready() { save.disabled=!!edit.saving || !required.every(k=>edit.values[k].trim()); }
      for (const [key,label] of Object.entries({name:'名称',language:'语言',ageGroup:'年龄段',gender:'性别',accent:'口音',description:'描述'})) {
        const group = element('label','rs-field');
        const input = element(key==='description'?'textarea':'input'); input.name = key;
        input.maxLength = limits[key]; input.value = edit.values[key]; input.disabled = edit.saving;
        const choices = standard[key] || (key==='accent'?accentsFor(edit.values.language):null);
        if (choices) {
          const list=element('datalist'); list.id='rs-voice-'+(++fieldNumber);
          for(const value of choices)list.append(new Option(value,value)); input.setAttribute('list',list.id); group.append(list);
        }
        input.required = required.includes(key); input.oninput = () => {
          edit.values[key] = input.value;
          if (key==='language') {
            const accent=form.elements.namedItem('accent');
            edit.values.accent=''; accent.value=''; accent.list.replaceChildren(...accentsFor(input.value).map(v=>new Option(v,v)));
          }
          ready();
        };
        group.append(element('span','',label), input); form.append(group);
      }
      const actions = element('div','rs-voice-actions');
      const cancel = button('','取消',() => {
        edit = null; render(); content.querySelector('[data-job-id="'+CSS.escape(entry.id)+'"]')?.focus({preventScroll:true});
      });
      const save = element('button','rs-voice-generate','保存并使用'); save.type = 'submit';
      cancel.disabled = !!edit.saving; ready();
      form.append(element('small','rs-voice-status',entry.profile?.kind==='preview'?'保存会在 ElevenLabs 账户注册专属音色并占用一个音色名额。':'保存模型、基础声线和演绎描述，用于后续配音。'));
      actions.append(cancel,save); form.append(actions);
      form.onsubmit = event => { event.preventDefault(); void keep(entry,form); };
      return form;
    }
    function designPanel() {
      const label = element('label','rs-field');
      label.append(element('span','','AI 音色描述'));
      const input = element('textarea');
      input.placeholder = '默认基于当前人设生成，可以补充输入音色特征...';
      input.value = values[designKey] || '';
      input.addEventListener('input', () => setValue(designKey, input.value));
      label.append(input);
      content.append(label);
      const designModels = available.filter(m=>m.design);
      if (designModels.length) {
        const group = element('label','rs-field');
        group.append(element('span','','语音模型'));
        const select = element('select'); select.disabled = pending;
        for (const m of designModels) select.add(new Option(m.name || m.model, m.id));
        select.value = currentModel;
        select.onchange = () => { currentModel = select.value; render(); };
        group.append(select); content.append(group);
        content.append(element('p','rs-voice-status',designModels.find(m=>m.id===currentModel)?.roleVoiceRegistration ?
          'ElevenLabs 按试听文本字符计费。生成后可试听候选，保存时注册专属音色。' :
          '生成试听会使用模型额度。此模型复用基础音色和演绎描述。'));
      } else if (loadedModels) {
        content.append(element('p','rs-voice-status','请在供应商设置中接入支持音色描述的语音模型。'));
      }
      const generate = button('rs-voice-generate',pending ? '生成中…' : '生成音色', design);
      generate.disabled = pending || !currentModel;
      content.append(generate);
      content.append(element('h4','','生成历史'));
      if (!history.length) content.append(element('p','rs-voice-empty','暂无历史记录'));
      for (const entry of history) {
        const row = element('div','rs-voice-result');
        row.append(element('strong','',entry.name));
        const date = entry.createdAt && new Date(entry.createdAt);
        if (date && Number.isFinite(date.getTime())) row.append(element('small','rs-voice-status',date.toLocaleString()));
        if (!entry.url) {
          const progress = Number.isFinite(entry.progress) ? ' '+Math.round(entry.progress)+'%' : '…';
          row.append(element('small','rs-voice-status',entry.status === 'failed' ? (entry.error || '生成失败') : '音色生成中'+progress));
          content.append(row); continue;
        }
        const audio = element('audio'); audio.src = entry.url; audio.preload = 'none'; audio.controls = true;
        audio.setAttribute('aria-label','试听'+entry.name);
        if (entry.description) row.title = entry.description;
        row.append(audio);
        if (edit?.id === entry.id) row.append(saveForm(entry));
        else {
          const save = button('', entry.saved ? '使用音色' : '保存并使用', () => {
            if (entry.saved) { choose(entry.saved); message('已选择「'+entry.saved.name+'」。'); return; }
            const tags=[role.gender,role.age,...(role.tags||[])].join(' ');
            edit = {id:entry.id, saving:false, values:{name:entry.name, language:'中文',
              ageGroup:/儿童|幼儿|男童|女童/.test(tags)?'儿童':/老年|老人/.test(tags)?'老年':/青年/.test(tags)?'青年':/中年|成年/.test(tags)?'成年':'',
              gender:/女|\bfemale\b/i.test(tags)?'女':/男|\bmale\b/i.test(tags)?'男':'', accent:'普通话',
              description:(entry.profile?.description || '').slice(0,2000)}};
            message(''); render(); content.querySelector('.rs-voice-metadata input')?.focus();
          });
          save.dataset.jobId = entry.id; row.append(save);
          const reusable=entry.saved ? bindable(entry.saved) : entry.profile?.kind==='preview' || entry.profile?.modelId && entry.profile?.description;
          if (!reusable) {save.disabled=true;save.textContent='仅可试听';}
        }
        content.append(row);
      }
      if (history.length<historyTotal) content.append(button('','加载更多历史',()=>loadHistory(true)));
    }
    function render() {
      const filters = root.querySelector('.rs-voice-filter-dialog[open]');
      if (filters) {
        if (!filters.dataset.refresh) {
          filters.dataset.refresh='1';
          filters.addEventListener('close',()=>{ if (open && host.isConnected) render(); },{once:true});
        }
        return;
      }
      const focused = content.contains(document.activeElement) ? document.activeElement : null;
      const field = focused?.matches('input,textarea') ? (focused.name ? '[name="'+CSS.escape(focused.name)+'"]' : focused.tagName.toLowerCase()) : '';
      const selection = field ? [focused.selectionStart,focused.selectionEnd] : [];
      for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
      for (const player of content.querySelectorAll('audio')) if (!player.paused) player.pause();
      pageObserver?.disconnect(); content.replaceChildren();
      if (tab === 'library') libraryPanel(voices);
      if (tab === 'mine') libraryPanel(mine);
      if (tab === 'design') designPanel();
      if (field) {
        const replacement = content.querySelector(field);
        replacement?.focus({preventScroll:true}); replacement?.setSelectionRange(...selection);
      }
    }
    for (const [id,label] of Object.entries(tabNames)) {
      const b = button('', label, () => {
        if (tab === id || edit?.saving) return;
        edit = null;
        stop(); tab = id; message(''); render();
        if (id === 'mine') void loadMine();
        else if (!loadedModels) void loadModels();
        if (id === 'design') {
          if (!pending) void loadHistory();
        } else clearTimeout(refreshTimer);
      });
      b.dataset.tab = id; b.setAttribute('role','tab'); tabs.append(b);
    }
    message(''); render(); void loadModels();
    return {
      stopPlayback: stop,
      sync(next) {
        values = {...next}; updateCards();
        const caption = content.querySelector('.rs-current-voice');
        if (caption) { const name = selected()?.name; caption.textContent = name ? '已选择「'+name+'」' : ''; caption.hidden = !name; }
        const field = content.querySelector('.rs-voice-body > label textarea');
        if (field && field.value !== (values[designKey] || '')) field.value = values[designKey] || '';
      },
      destroy() {
        open = false; clearTimeout(refreshTimer); pageObserver?.disconnect(); stop();
        for (const player of content.querySelectorAll('audio')) player.pause();
        root.remove();
      },
    };
  };
})();
