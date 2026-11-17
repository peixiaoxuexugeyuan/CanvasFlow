/* CanvasFlow Agent: skill discovery and workflow entry, using the existing Agent. */
(() => {
  'use strict';
  const publisher = 'CanvasFlow';
  const categories = ['推荐','社区','专业影视','商业广告','短剧漫剧','动漫游戏','音乐MV','自媒体创作','通用技能','发现'];
  const entries = [
    ['shot-remix','爆款拉片复刻','拆解参考视频的镜头、节奏与叙事，创作你的版本','自媒体创作','视频',1,'读取用户提供的参考视频或镜头资料，拆解景别、运镜、节奏、光线和声音。提炼可复用结构，再围绕用户自己的主题创建分镜和生成提示词。不能读取视频时先要求可用素材，不虚构分析结果。'],
    ['film-shot','AI电影镜头设计师','把简单的场景设计成专业电影级镜头语言','专业影视','视频',8,'将用户场景拆成有叙事目的的镜头，明确景别、机位、运镜、主体动作、光线、时长与转场。保持空间轴线和主体连续性，先规划，再通过现有画布工具创建分镜节点与连线。'],
    ['short-drama-flow','精品女频短剧一键成片','从故事与角色设定出发，串联分镜、画面与剪辑','短剧漫剧','视频',4,'将用户故事整理为角色设定、剧情节拍和镜头表，先建立一致的角色与场景参考，再安排画面、视频和成片剪辑。逐阶段查看真实产物，缺少模型或素材时明确指出，不将未生成内容描述为完成。'],
    ['product-tvc','Apple风广告 TVC','上传产品参考，设计干净、克制的品牌视觉','商业广告','图片',2,'读取产品参考与品牌目标，提取不可改变的产品形态、标志和材质。设计极简布景、局部特写、光影变化及产品英雄镜头，输出镜头提示词与可执行的生成参数，保持品牌和产品一致。'],
    ['story-tvc','剧情 TVC 广告','围绕产品卖点，设计有情节的品牌短片','商业广告','视频',3,'根据产品、受众、卖点和目标时长，设计开场冲突、产品介入、效果展示和行动引导。把剧本拆成分镜，标明台词、画面、声音和时长，再按用户要求推进画布生成及剪辑。'],
    ['casting','选角 Casting','把人物设定转化为可比较的角色视觉方案','专业影视','图片',9,'从剧本提取角色的年龄、气质、服装、轮廓和叙事作用，制作若干可比较的角色方案。确认后整理正面、侧面和背面参考提示词，固定角色识别特征并用于后续镜头。'],
    ['cinema-image','电影质感画面专业生成','把画面想法转化为有构图与光影的电影感图像','专业影视','图片',5,'将用户想法组织为主体、环境、景别、构图、光源、色彩和材质提示词。检查当前图片模型的参考图与参数支持，先生成构图样图，再根据结果局部调整，避免同时改变所有参数。'],
    ['expression','微表情情绪精控','用具体的眼神、呼吸和动作呈现角色心理','短剧漫剧','视频',6,'把情绪转成可观察的眼神、眉部、嘴角、呼吸和姿态变化，控制动作幅度，保持角色身份与镜头连续。给出起始、中间、结束三个状态及完整视频提示词，优先用参考图控制一致性。'],
    ['male-drama','爆款男频短剧 Skill','以人物目标、冲突与反转推动短剧叙事','短剧漫剧','视频',7,'围绕用户主题规划人物目标、开场冲突、行动阻力和剧情反转，拆分可拍摄的分镜与台词。先确定角色与场景一致性，逐步推进画面和视频生成，基于实际素材进行成片剪辑。'],
    ['music-video','音乐 MV 视觉导演','围绕音乐节奏与情绪，编排画面和转场','音乐MV','视频',12,'读取用户提供的音乐与主题，根据可获取的节奏和段落安排视觉动机、镜头长度与转场。不能分析音频时明确需要的节拍或段落信息；在已有音频和画面基础上推进成片编排。'],
    ['scene-views','场景多视角资料卡','统一空间、布景与光线，建立多角度场景参考','通用技能','图片',10,'梳理空间布局、出入口、关键物件与主光方向，规划前后左右和主反打视角。先锁定一张场景主参考，再按同一空间规则生成各视角提示词，并检查透视与物件位置。'],
    ['script-doctor','AI导演 · 剧本诊断','梳理故事结构，逐场改进冲突与视觉表达','通用技能','文本',11,'阅读用户剧本，梳理人物目标、冲突、因果、节奏和信息铺垫，按场次给出问题、原因和修改建议。保留用户指定的人设与主题，提供可比对的改稿，然后转成拍摄镜头清单。'],
    ['anime-story','动漫分镜工作流','从角色与世界观出发，设计连续的动漫镜头','动漫游戏','视频',13,'根据用户世界观、角色设定和视觉风格安排剧情节拍，制作角色和场景资料卡，再编写连贯的动漫分镜与生成提示词，保持服装、道具、位置和色彩一致。'],
  ];
  const presets = window.CanvasFlowPublicSkills.merge(entries.map(([id,title,desc,cat,kind,cover,prompt]) => {
    const details=window.CanvasFlowSkillDetails?.[`cover-${cover}`];
    // Public documents stay intact in the viewer; all available references travel with execution.
    const instructions=details?.files?.length ? '在 CanvasFlow 中使用此技能，按实际可用工具执行；未提供的能力需明确说明。\n\n'+details.files.map(file=>`文件：${file.path}\n${file.content}`).join('\n\n') : prompt;
    return {id:'hub-'+id,title,desc:details?.description||desc,cat,kind,cover:`assets/agent-skills/cover-${cover}.png`,prompt:instructions,details,icon:'wand'};
  }));
  const drafts = new Map();
  let dispose = null;
  const icon = (name) => {
    const paths = {plus:'M12 5v14M5 12h14',cube:'m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v8',file:'M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 13h8M8 17h5',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',arrow:'M12 19V5m-6 6 6-6 6 6',star:'m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3L2.8 9.7l6.4-.9L12 3Z',close:'m6 6 12 12M6 18 18 6',history:'M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7m2-5v6l4 2'};
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(paths[name]||paths.file).split('|').map(d=>`<path d="${d}"/>`).join('')}</svg>`;
  };
  const el = (tag, cls, text) => {const node=document.createElement(tag);node.className=cls;if(text!=null)node.textContent=text;return node;};
  const button = (label, cls, action) => {const b=el('button',cls,label);b.type='button';b.addEventListener('click',action);return b;};
  const webUrl = value => {try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}};
  // Build Markdown with DOM text nodes. Raw HTML and unsafe URLs never become executable markup.
  function renderMarkdown(markdown, files, chooseFile) {
    const root=el('div','cah-markdown'), lines=String(markdown||'').replace(/\r\n?/g,'\n').split('\n');
    function inline(parent,text,depth=0){
      if(depth>8){parent.append(document.createTextNode(text));return;}
      const pattern=/(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/g;
      let offset=0;
      for(const match of text.matchAll(pattern)){
        parent.append(document.createTextNode(text.slice(offset,match.index)));const token=match[0];let node;
        if(token.startsWith('`'))node=el('code','',token.slice(1,-1));
        else if(token.startsWith('**')||token.startsWith('__')){node=el('strong','');inline(node,token.slice(2,-2),depth+1);}
        else if(token.startsWith('*')){node=el('em','');inline(node,token.slice(1,-1),depth+1);}
        else {
          const [,label,target]=token.match(/^\[([^\]]+)\]\((.+)\)$/), path=target.split('#')[0].replace(/^\.\//,'');
          const index=files.findIndex(file=>file.path===path||file.path.split('/').pop()===path.split('/').pop());
          if(index>=0){node=button(label,'cah-file-link',()=>chooseFile(index));}
          else if(webUrl(target)){node=el('a','',label);node.href=webUrl(target);node.target='_blank';node.rel='noopener noreferrer';}
          else node=el('span','',label);
        }
        parent.append(node);offset=match.index+token.length;
      }
      parent.append(document.createTextNode(text.slice(offset)));
    }
    const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());
    const tableDivider=line=>/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line||'');
    for(let i=0;i<lines.length;){
      const line=lines[i];if(!line.trim()){i++;continue;}
      if(/^\s*```/.test(line)){const code=[];i++;while(i<lines.length&&!/^\s*```/.test(lines[i]))code.push(lines[i++]);i++;const pre=el('pre','');pre.append(el('code','',code.join('\n')));root.append(pre);continue;}
      if(/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)){root.append(el('hr',''));i++;continue;}
      const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
      if(heading){const h=el('h'+Math.min(heading[1].length+1,6),'');inline(h,heading[2]);root.append(h);i++;continue;}
      if(line.includes('|')&&tableDivider(lines[i+1])){
        const wrap=el('div','cah-table-wrap'),table=el('table',''),head=el('thead',''),row=el('tr','');
        for(const cell of cells(line)){const th=el('th','');inline(th,cell);row.append(th);}head.append(row);table.append(head);i+=2;
        const body=el('tbody','');while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){const tr=el('tr','');for(const cell of cells(lines[i++])){const td=el('td','');inline(td,cell);tr.append(td);}body.append(tr);}table.append(body);wrap.append(table);root.append(wrap);continue;
      }
      if(/^\s*(?:[-+*]|\d+\.)\s+/.test(line)){
        const ordered=/^\s*\d+\./.test(line),list=el(ordered?'ol':'ul','');const pattern=ordered?/^\s*\d+\.\s+/:/^\s*[-+*]\s+/;
        while(i<lines.length&&pattern.test(lines[i])){const li=el('li','');inline(li,lines[i++].replace(pattern,''));list.append(li);}root.append(list);continue;
      }
      if(/^\s*>/.test(line)){const quote=el('blockquote','');inline(quote,line.replace(/^\s*>\s?/,''));root.append(quote);i++;continue;}
      const paragraph=el('p',''),parts=[line];i++;
      while(i<lines.length&&lines[i].trim()&&!/^\s*(#{1,6}\s|```|>|[-+*]\s|\d+\.\s|---+$)/.test(lines[i])&&!tableDivider(lines[i+1]))parts.push(lines[i++]);
      parts.forEach((part,index)=>{if(index)paragraph.append(el('br',''));inline(paragraph,part);});root.append(paragraph);
    }
    return root;
  }
  function mount(deps) {
    dispose?.();
    const {host}=deps, draft=drafts.get(deps.workspaceId)||{text:'',selected:null,tab:'skill',category:'推荐',query:''};
    let alive=true, skills=[], selected=draft.selected, tab=draft.tab, category=draft.category, query=draft.query, dialog=null, libraryDialog=null, refreshLibrary=null, loadId=0, attachments=draft.attachments||[],busy=false,controls,editor=null,cardMenu=null,menuTrigger=null;
    host.innerHTML=`<div class="cf-agent-hub">
      <div class="cah-top"><span>CanvasFlow Agent <small>BETA</small></span><div><button type="button" data-action="history" title="历史对话" aria-label="历史对话">${icon('history')}</button><button type="button" data-action="settings">模型设置</button></div></div>
      <section class="cah-hero"><h1>让 Skill 帮你迈出第一步</h1>
        <form class="cah-composer"><div class="cah-selected" hidden></div><div class="cah-attachments" hidden></div><textarea aria-label="描述你的创作灵感" placeholder="请输入你的创作灵感，或从下方挑选一个 Skill 开始" rows="3"></textarea><p class="cah-attachment-status" role="status" hidden></p>
          <div class="cah-composer-footer"><div class="cah-tools"><button type="button" data-action="attach" title="添加附件" aria-label="添加附件">${icon('plus')}</button><button type="button" data-action="model" title="选择模型" aria-label="选择模型">${icon('cube')}</button><button type="button" data-action="skill" title="Skill" aria-label="Skill">${icon('file')}</button><button type="button" data-action="gen" title="手动生成" aria-label="手动生成"></button></div><button type="submit" class="cah-send" aria-label="开始工作流" title="开始工作流" disabled>${icon('arrow')}</button></div>
        </form>
      </section>
      <section class="cah-library" aria-label="工作流技能库"><div class="cah-library-head"><div class="cah-tabs" role="tablist" aria-label="技能来源"></div><div class="cah-community-actions"><span class="cah-community-status" role="status" aria-live="polite"></span><button type="button" class="cah-community-sync">同步社区</button></div><div class="cah-mine-actions" hidden></div></div>
        <div class="cah-filterbar"><div class="cah-categories" aria-label="技能分类"></div><label class="cah-search"><input type="search" placeholder="搜索 Skill" aria-label="搜索 Skill">${icon('search')}</label></div>
        <div class="cah-status" role="status" aria-live="polite">正在加载技能…</div><div class="cah-grid"></div>
      </section><input class="cah-upload" type="file" accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,.mp3,.wav,.m4a" multiple hidden>
    </div>`;
    const root=host.firstElementChild, input=root.querySelector('textarea'), grid=root.querySelector('.cah-grid'), status=root.querySelector('.cah-status'), send=root.querySelector('.cah-send'), chip=root.querySelector('.cah-selected');
    input.value=draft.text;
    const save=()=>drafts.set(deps.workspaceId,{text:input.value,selected,tab,category,query,attachments});
    function updateComposer(){
      chip.replaceChildren();chip.hidden=!selected;
      if(selected){chip.append(el('span','',`✦ ${selected.title}`),button('×','',()=>{selected=null;updateComposer();save();}));chip.lastChild.setAttribute('aria-label','移除所选技能');}
      send.disabled=busy||(!input.value.trim()&&!selected&&!attachments.length);
    }
    function selectSkill(skill){closeLibrary();selected=skill;updateComposer();save();input.focus();root.querySelector('.cah-hero').scrollIntoView({behavior:'smooth',block:'start'});}
    function closeLibrary(){if(!libraryDialog)return;controls?.close();libraryDialog.close();libraryDialog.remove();libraryDialog=null;refreshLibrary=null;}
    function openLibrary(){
      closeLibrary();const panel=el('dialog','cah-library-dialog');libraryDialog=panel;panel.setAttribute('aria-label','全部 Skill');
      const dismiss=button('×','cah-library-dismiss',closeLibrary);dismiss.setAttribute('aria-label','关闭全部 Skill');
      const body=el('div','cf-agent-hub cah-library-browser');
      body.innerHTML='<section class="cah-library"><header class="cah-library-toolbar"><div class="cah-library-head"><div class="cah-tabs" role="tablist" aria-label="全部技能来源"></div><div class="cah-mine-actions" hidden></div></div><div class="cah-filterbar"><div class="cah-categories"></div><label class="cah-search"><input type="search" aria-label="搜索全部 Skill" placeholder="搜索 Skill"></label></div></header><div class="cah-status" role="status"></div><div class="cah-grid"></div></section>';
      const list=body.querySelector('.cah-grid'),tabs=body.querySelector('.cah-tabs'),cats=body.querySelector('.cah-categories'),empty=body.querySelector('.cah-status'),search=body.querySelector('input'),mine=body.querySelector('.cah-mine-actions');
      const searchIcon=el('span','');searchIcon.innerHTML=icon('search');search.parentElement.append(searchIcon);
      let browseTab='skill',browseCategory='推荐';
      const create=button('＋ 创建Skill ⌄','cah-create',()=>controls.createMenu(create));create.setAttribute('aria-haspopup','dialog');create.setAttribute('aria-expanded','false');mine.append(create);
      function paint(){
        tabs.replaceChildren();for(const [key,label] of [['skill','Skill'],['fav','收藏'],['mine','我的']]){const b=button(label,`cah-tab${browseTab===key?' is-active':''}`,()=>{controls.close();browseTab=key;browseCategory='推荐';search.value='';paint();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(browseTab===key));tabs.append(b);}
        cats.replaceChildren();for(const label of categories){const b=button(label,`cah-category${browseCategory===label?' is-active':''}`,()=>{browseCategory=label;paint();});b.setAttribute('aria-pressed',String(browseCategory===label));cats.append(b);}
        mine.hidden=browseTab!=='mine';body.querySelector('.cah-filterbar').hidden=browseTab==='mine';
        let items=browseTab==='mine'?skills.filter(s=>s.owned):browseTab==='fav'?skills.filter(s=>deps.favorites().includes(s.id)):skills.filter(s=>!s.owned);
        if(browseTab!=='mine'&&!['推荐','发现'].includes(browseCategory))items=items.filter(s=>browseCategory==='社区'?(s.communityId||s.inCommunity):s.cat===browseCategory);
        const q=search.value.trim().toLowerCase();if(q)items=items.filter(s=>`${s.title} ${s.desc} ${s.cat||''}`.toLowerCase().includes(q));
        empty.hidden=!!items.length;empty.textContent=q?'没有找到相关 Skill，试试其他关键词':browseTab==='fav'?'还没有收藏的 Skill':'当前暂无Skill';paintCards(list,items);
      }
      search.addEventListener('input',paint);panel.addEventListener('cancel',e=>{e.preventDefault();closeLibrary();});panel.addEventListener('click',e=>{if(e.target!==panel)return;const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeLibrary();});
      panel.addEventListener('close',()=>root.querySelector('[data-action="skill"]')?.focus());panel.append(dismiss,body);document.body.append(panel);refreshLibrary=paint;paint();panel.showModal();
    }
    function closeDetail(){dialog?.querySelectorAll('video,audio').forEach(media=>media.pause());dialog?.close();dialog?.remove();dialog=null;}
    function openEditor(skill){
      closeCardMenu();controls?.close();closeDetail();closeLibrary();editor?.close();
      editor=window.CanvasFlowSkillEditor.open({skill,parse:deps.parseSkill,renderMarkdown,save:deps.saveSkill,
        onSaved:async()=>{if(!alive)return;tab='mine';category='推荐';query='';search.value='';save();await load();},
        onClose:()=>{editor=null;if(alive)root.querySelector('.cah-create')?.focus();}});
    }
    function closeCardMenu(){cardMenu?.remove();cardMenu=null;menuTrigger?.setAttribute('aria-expanded','false');menuTrigger?.closest('.cah-card')?.classList.remove('has-menu');menuTrigger=null;}
    function showCardMenu(skill,trigger){
      const same=menuTrigger===trigger;closeCardMenu();controls?.close();if(same)return;
      menuTrigger=trigger;trigger.setAttribute('aria-expanded','true');trigger.closest('.cah-card').classList.add('has-menu');
      const menu=el('div','cah-card-menu');cardMenu=menu;menu.setAttribute('role','menu');menu.setAttribute('aria-label',skill.title+' 操作');
      const item=(label,action,cls='')=>{const b=button(label,cls,()=>{closeCardMenu();action();});b.setAttribute('role','menuitem');menu.append(b);return b;};
      item('查看详情',()=>detail(skill,trigger));
      item('在对话中编辑',()=>{closeLibrary();deps.editInChat(skill);});
      item('编辑',()=>openEditor(skill));
      const publish=item('发布',()=>{});publish.disabled=true;publish.title='发布服务暂未接入';publish.setAttribute('aria-disabled','true');
      item('删除',async()=>{closeLibrary();try{if(await deps.deleteSkill(skill)){if(selected?.id===skill.id){selected=null;updateComposer();save();}await load();}}catch(error){deps.toast?.(error.message||'删除失败，请重试','×');}},'is-danger');
      (trigger.closest('dialog[open]')||document.body).append(menu);
      const r=trigger.getBoundingClientRect(),m=menu.getBoundingClientRect();menu.style.left=Math.max(10,Math.min(innerWidth-m.width-10,r.right-m.width))+'px';menu.style.top=Math.max(10,Math.min(innerHeight-m.height-10,r.bottom+6))+'px';menu.firstElementChild.focus();
      menu.addEventListener('keydown',e=>{const items=[...menu.querySelectorAll('button:not(:disabled)')],i=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:items.length-1))%items.length].focus();}});
    }
    const dismissCardMenu=event=>{if(cardMenu&&!cardMenu.contains(event.target)&&!menuTrigger?.contains(event.target))closeCardMenu();};
    const escapeCardMenu=event=>{if(event.key==='Escape'&&cardMenu){event.preventDefault();event.stopPropagation();const trigger=menuTrigger;closeCardMenu();trigger?.focus();}};
    document.addEventListener('pointerdown',dismissCardMenu);document.addEventListener('keydown',escapeCardMenu,true);window.addEventListener('resize',closeCardMenu);
    let detailRequest=0;
    async function detail(skill, opener){
      const request=++detailRequest;
      try{await window.CanvasFlowPublicSkills.load(skill);}catch(error){if(alive&&request===detailRequest)deps.toast?.(error.message,'×');return;}
      if(!alive||request!==detailRequest)return;
      closeDetail();dialog=el('dialog','cah-dialog');dialog.setAttribute('aria-label',skill.title);
      const panel=dialog, data=skill.details||{}, publicFiles=data.files||[];
      const files=publicFiles.length?publicFiles:[{path:'SKILL.md',content:skill.owned?skill.prompt:`# ${skill.title}\n\n${skill.prompt}`,contentType:'text/markdown',primary:true}];
      let fileIndex=Math.max(0,files.findIndex(file=>file.path===data.primarySkillFilePath||file.primary)),sourceMode=false;
      const close=button('×','cah-dialog-close',closeDetail);close.setAttribute('aria-label','关闭技能详情');
      const head=el('header','cah-detail-header'),heading=el('div','cah-detail-heading'),meta=el('div','cah-detail-meta');
      const author=skill.communityId?skill.author:publisher;
      meta.append(el('span','cah-avatar',author.slice(0,1)),el('span','',author),el('span','','·'),el('span','',skill.cat||'通用技能'));
      if(data.version)meta.append(el('span','','·'),el('span','',`v${data.version}`));
      if(webUrl(data.sourceUrl)){const source=el('a','cah-detail-source',skill.communityId?'来自 CanvasFlow 社区 ↗':'来自 LibTV ↗');source.href=webUrl(data.sourceUrl);source.target='_blank';source.rel='noopener noreferrer';meta.append(source);}
      heading.append(el('h2','',skill.title),meta);
      const actions=el('div','cah-detail-actions');
      const share=button('','cah-detail-icon',()=>{
        const primary=files.find(file=>file.path===data.primarySkillFilePath)||files.find(file=>file.primary)||files.find(file=>/(^|[/\\])SKILL\.md$/i.test(file.path))||files[0];
        const name=String(skill.title||'CanvasFlow').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').trim().slice(0,100)||'CanvasFlow';
        let url,link;
        try{
          url=URL.createObjectURL(new Blob([primary.content],{type:'text/markdown;charset=utf-8'}));
          link=el('a','');link.href=url;link.download=`${name}-SKILL.md`;link.hidden=true;document.body.append(link);link.click();
          deps.toast?.('已导出 Skill .md 文件，可直接分享','↓');
        }catch{deps.toast?.('导出失败，请重试','×');}
        finally{link?.remove();if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);}
      });share.title='分享 Skill 的 .md 文件';share.setAttribute('aria-label','分享技能');share.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4M9 14l6 4"/></svg>';
      const fav=button('','cah-detail-icon',()=>{deps.toggleFavorite(skill.id);updateFavorite();render();});fav.innerHTML=icon('star');
      const updateFavorite=()=>{const saved=deps.favorites().includes(skill.id);fav.classList.toggle('is-saved',saved);fav.setAttribute('aria-label',saved?'取消收藏技能':'收藏技能');fav.setAttribute('aria-pressed',String(saved));};updateFavorite();
      const add=button('添加 Skill','cah-primary',()=>{closeDetail();selectSkill(skill);});add.title='添加到创作输入框';actions.append(share,fav);if(skill.owned)actions.append(button('编辑','cah-detail-edit',()=>openEditor(skill)));actions.append(add);head.append(heading,actions);
      const body=el('div','cah-detail-scroll');body.tabIndex=0;body.setAttribute('aria-label','技能详情内容');
      const examples=(data.examples||[]).filter(webUrl);
      if(examples.length){
        const gallery=el('section','cah-examples');gallery.setAttribute('aria-label','作品示例');const stage=el('div','cah-example-stage'),navigation=el('div','cah-example-navigation');let exampleIndex=0;
        function showExample(index){stage.querySelector('video')?.pause();exampleIndex=(index+examples.length)%examples.length;stage.replaceChildren();const url=examples[exampleIndex],video=/\.(mp4|webm|mov)(?:\?|$)/i.test(url),media=el(video?'video':'img','');
          if(video){media.controls=true;media.preload='none';media.playsInline=true;if(skill.cover)media.poster=skill.cover;}else{media.alt=`${skill.title} · 示例 ${exampleIndex+1}`;media.loading='lazy';}
          media.src=url;media.addEventListener('error',()=>{if(!stage.contains(media))return;stage.replaceChildren(el('p','cah-media-error','示例暂时无法加载'));const link=el('a','','打开原始示例 ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';stage.append(link);},{once:true});stage.append(media);navigation.replaceChildren();
          if(examples.length>1)navigation.append(button('‹','cah-example-arrow',()=>showExample(exampleIndex-1)),el('span','',`${exampleIndex+1} / ${examples.length}`),button('›','cah-example-arrow',()=>showExample(exampleIndex+1)));
        }
        gallery.append(stage,navigation);body.append(gallery);showExample(0);
      }
      const intro=el('section','cah-introduction');intro.append(el('h3','','简介'));const list=el('dl','cah-intro-list');
      for(const [label,value] of [['介绍',data.description||skill.desc],['使用场景',data.useScenario||`适用于「${skill.title}」相关创作任务。`],['如何使用',data.inputType||'添加此 Skill，输入你的创作要求，并补充所需素材后发送。'],['输出内容',data.outputContent||'按照下方 Skill 指令组织方案和执行结果。']])list.append(el('dt','',label),el('dd','',value));
      intro.append(list);body.append(intro);
      const section=el('section','cah-file-section'),toolbar=el('div','cah-file-toolbar'),picker=el('select','cah-file-select');picker.setAttribute('aria-label','选择 Skill 文件');
      files.forEach((file,index)=>{const option=el('option','',file.path);option.value=String(index);picker.append(option);});picker.value=String(fileIndex);
      const fileTools=el('div','cah-file-picker');fileTools.append(el('span','cah-file-count',`${files.length} 个文件`),picker);toolbar.append(el('h3','','Skill'),fileTools);section.append(toolbar);
      if(data.templateUuid&&!publicFiles.length)section.append(el('p','cah-file-note','原作者未公开 Skill 文件。下方展示 CanvasFlow 当前使用的执行指令。'));
      if(data.missingReferences?.length)section.append(el('p','cah-file-note','以下原始引用路径未匹配到返回文件：'+data.missingReferences.join('、')));
      const viewer=el('div','cah-file-viewer'),viewTools=el('div','cah-view-tools'),content=el('div','cah-file-content cah-detail-prompt');
      const preview=button('','cah-view-mode',()=>{sourceMode=false;renderFile();});preview.setAttribute('aria-label','预览 Skill 文件');preview.title='预览';preview.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
      const source=button('‹/›','cah-view-mode',()=>{sourceMode=true;renderFile();});source.setAttribute('aria-label','查看 Skill 源码');source.title='源码';
      const copy=button('复制','cah-copy-file',async()=>{try{await navigator.clipboard.writeText(files[fileIndex].content);deps.toast?.('已复制当前文件','✓');}catch{deps.toast?.('复制失败，请重试','×');}});copy.setAttribute('aria-label','复制当前 Skill 文件');
      viewTools.append(copy,preview,source);viewer.append(viewTools,content);section.append(viewer);body.append(section);
      function chooseFile(index){fileIndex=index;picker.value=String(index);renderFile();}
      function renderFile(){content.replaceChildren();const file=files[fileIndex];preview.classList.toggle('is-active',!sourceMode);source.classList.toggle('is-active',sourceMode);preview.setAttribute('aria-pressed',String(!sourceMode));source.setAttribute('aria-pressed',String(sourceMode));content.dataset.file=file.path;
        if(sourceMode||!(/\.md$/i.test(file.path)||file.contentType==='text/markdown'))content.append(el('pre','cah-source-code',file.content));else content.append(renderMarkdown(file.content,files,chooseFile));
      }
      picker.addEventListener('change',()=>chooseFile(Number(picker.value)));renderFile();
      panel.append(close,head,body);document.body.append(panel);
      dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDetail();}});
      dialog.addEventListener('close',()=>{panel.querySelectorAll('video,audio').forEach(media=>media.pause());opener?.focus();});dialog.showModal();
    }
    function render(){
      closeCardMenu();
      const tabs=root.querySelector('.cah-tabs');tabs.replaceChildren();
      for(const [key,label] of [['skill','Skill'],['fav','收藏'],['mine','我的']]){const b=button(label,`cah-tab${tab===key?' is-active':''}`,()=>{tab=key;category='推荐';save();render();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(tab===key));tabs.append(b);}
      const mine=root.querySelector('.cah-mine-actions');mine.hidden=tab!=='mine';
      if(!mine.firstChild){const create=button('＋ 创建Skill ⌄','cah-create',()=>controls.createMenu(create));create.setAttribute('aria-expanded','false');create.setAttribute('aria-haspopup','dialog');mine.append(create);}
      root.querySelector('.cah-filterbar').hidden=tab==='mine';
      const cats=root.querySelector('.cah-categories');cats.replaceChildren();cats.hidden=tab==='mine';
      for(const label of categories){const b=button(label,`cah-category${label===category?' is-active':''}`,()=>{category=label;save();render();});b.setAttribute('aria-pressed',String(label===category));cats.append(b);}
      let items=tab==='mine'?skills.filter(s=>s.owned):tab==='fav'?skills.filter(s=>deps.favorites().includes(s.id)):skills.filter(s=>!s.owned);
      if(tab!=='mine'&&!['推荐','发现'].includes(category))items=items.filter(s=>category==='社区'?(s.communityId||s.inCommunity):s.cat===category);
      const needle=tab==='mine'?'':query.trim().toLowerCase();if(needle)items=items.filter(s=>`${s.title} ${s.desc} ${s.cat||''}`.toLowerCase().includes(needle));
      grid.replaceChildren();status.hidden=items.length>0;
      status.textContent=needle?'没有找到相关 Skill，试试其他关键词':tab==='fav'?'还没有收藏，点击技能卡片上的星标即可收藏':tab==='mine'?'当前暂无Skill':'这个分类暂时没有技能';
      if(tab==='mine'&&!items.length){const folder=el('div','cah-empty-folder');folder.innerHTML='<svg viewBox="0 0 80 70" aria-hidden="true"><path fill="#505050" d="M16 8h27l10 10v37H16z"/><path fill="#8c8c8c" d="M10 20h24l7 8h30l-4 35H14z"/><path fill="#c4c5c7" d="M10 25h25l8 8h30l-4 32H14z"/><path stroke="white" stroke-width="3" d="M58 38h7"/></svg>';status.prepend(folder);}
      paintCards(grid,items);refreshLibrary?.();
    }
    function paintCards(target,items,limit=48){
      target.replaceChildren();for(const skill of items.slice(0,limit)){
        const card=el('article',`cah-card${skill.owned?' cah-card-owned':''}`);const open=button('','cah-card-open',()=>detail(skill,open));open.setAttribute('aria-label',`查看技能：${skill.title}`);
        const art=el('div','cah-card-art');if(skill.cover){const img=el('img','');img.src=skill.cover;img.alt='';img.loading='lazy';art.append(img);}else art.append(el('span','cah-art-symbol',skill.icon==='film'?'▷':'✦'));
        art.append(el('span','cah-kind',skill.kind||'技能'));
        if(skill.owned){
          if(!skill.cover&&skill.kind==='图片')art.querySelector('.cah-art-symbol').innerHTML='<svg viewBox="0 0 48 36" fill="currentColor" aria-hidden="true"><circle cx="34" cy="8" r="4" opacity=".5"/><path d="m3 30 15-18 11 13 6-7 10 12z"/></svg>';
          const slug=el('span','cah-card-slug','/'+(skill.slug||'generic-assistant'));slug.title=slug.textContent;art.append(slug);
        }
        const author=skill.communityId?skill.author:publisher;
        const info=el('div','cah-card-info');info.append(el('h2','',skill.title),el('p','',skill.desc));const meta=el('div','cah-card-meta');meta.append(el('span','cah-avatar',author.slice(0,1)),el('span','',author),el('span','cah-card-category',skill.cat||'通用'));info.append(meta);open.append(art,info);
        card.append(open);
        if(skill.owned){
          const more=button('⋯','cah-card-more',()=>showCardMenu(skill,more));more.setAttribute('aria-label',`更多操作：${skill.title}`);more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');
          const add=button('添加','cah-card-add',()=>selectSkill(skill));add.setAttribute('aria-label',`添加技能：${skill.title}`);card.append(more,add);
        }else{
          const fav=button('','cah-favorite',()=>{deps.toggleFavorite(skill.id);render();});fav.innerHTML=icon('star');const favorite=deps.favorites().includes(skill.id);fav.classList.toggle('is-saved',favorite);fav.setAttribute('aria-label',`${favorite?'取消收藏':'收藏'}：${skill.title}`);fav.setAttribute('aria-pressed',String(favorite));card.append(fav);
        }target.append(card);
      }
      if(items.length>limit){const more=button(`加载更多（已显示 ${limit} / ${items.length}）`,'cah-text-button cah-list-end',()=>paintCards(target,items,limit+48));target.append(more);}
      if(items.length&&items.every(skill=>skill.owned))target.append(el('p','cah-list-end','没有更多了'));
    }
    async function load(){const id=++loadId;try{const list=await deps.listSkills();if(!alive||id!==loadId)return;skills=list;if(selected){selected=skills.find(s=>s.id===selected.id)||selected;updateComposer();save();}render();}catch{if(alive&&id===loadId){status.hidden=false;status.replaceChildren(el('span','','技能加载失败，请重试'),button('重新加载','cah-text-button',load));}}}
    input.addEventListener('input',()=>{updateComposer();save();});
    input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();root.querySelector('form').requestSubmit();}});
    root.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      const text=input.value.trim();if(!text&&!selected&&!attachments.length)return;
      const message=selected?`[[技能:${selected.tokenName||selected.title}]] ${text||'请先告诉我这个工作流需要哪些素材和信息，再开始规划。'}`:text||'请查看我提供的素材，先讨论创作方案。';
      busy=true;updateComposer();controls.close();
      try{
        if(await deps.start(message,attachments,{title:selected?.title||''})!==false){
          // Starting a workflow navigates away and unmounts this page before resolving.
          // Consume the submitted draft even after unmount, so returning cannot resend it.
          input.value='';selected=null;attachments=[];
          if(alive)controls.clearAttachments();
          save();
        }
      }catch(error){if(alive)deps.toast?.(error.message||'工作流启动失败','×');}
      finally{busy=false;if(alive){updateComposer();save();}}
    });
    const search=root.querySelector('.cah-search input');search.value=query;search.addEventListener('input',()=>{query=search.value;save();render();});
    root.querySelectorAll('.cah-top [data-action]').forEach(b=>b.addEventListener('click',()=>{controls.close();const action=b.dataset.action;if(action==='settings')window.CanvasFlowSettings?.open?.('providers');else deps.openTool(action,input.value);}));
    controls=window.CanvasFlowHubControls.mount({root,deps,attachments,skills:()=>skills,selected:()=>selected,select:selectSkill,showAll:openLibrary,importSkill:()=>openEditor(),beforeCreate:closeLibrary,changeAttachments:value=>{attachments=value;save();updateComposer();},busy:value=>{busy=value;updateComposer();}});
    const syncButton=root.querySelector('.cah-community-sync'),syncStatus=root.querySelector('.cah-community-status');
    async function syncCommunity(force=false){
      if(!deps.syncCommunity)return;
      syncButton.disabled=true;syncButton.textContent='同步中…';
      try{
        const result=await deps.syncCommunity(force);if(!alive)return;
        await load();if(!alive)return;
        syncStatus.textContent=result.error||`已同步 ${result.count} 个社区 Skill`;
        syncStatus.title=result.syncedAt?'最近同步：'+new Date(result.syncedAt*1000).toLocaleString():syncStatus.textContent;
        if(!result.stale&&selected?.communityId&&!skills.some(s=>s.id===selected.id)){selected=null;updateComposer();save();deps.toast?.('所选社区 Skill 已下架，请重新选择','ⓘ');}
      }catch{if(alive)syncStatus.textContent='社区暂时无法连接，本地技能仍可使用';}
      finally{if(alive){syncButton.disabled=false;syncButton.textContent='同步社区';}}
    }
    syncButton.addEventListener('click',()=>void syncCommunity(true));
    const refresh=()=>void load();window.addEventListener('canvasflow:skills-changed',refresh);
    updateComposer();void load();void syncCommunity();
    dispose=()=>{alive=false;save();controls.dispose();closeCardMenu();editor?.close();closeDetail();closeLibrary();document.removeEventListener('pointerdown',dismissCardMenu);document.removeEventListener('keydown',escapeCardMenu,true);window.removeEventListener('resize',closeCardMenu);window.removeEventListener('canvasflow:skills-changed',refresh);dispose=null;};
  }
  window.CanvasFlowAgentHub={presets,mount,unmount:()=>dispose?.()};
})();
