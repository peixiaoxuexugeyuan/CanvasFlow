/* Composer controls stay on the Agent landing page; execution uses the existing Agent. */
(() => {
  'use strict';
  const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
  const btn=(text,cls,run)=>{const n=make('button',cls,text);n.type='button';n.addEventListener('click',run);return n;};
  const paths={hand:'M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v6c0 5-3 7-6 7h-1c-2 0-3-1-4-2l-5-6a1.5 1.5 0 0 1 2-2l2 2',auto:'m10 2-6 12h7l-1 8 10-13h-8l2-7M16 2h-6',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',folder:'M3 7h7l2 3h9l-2 11H4L3 7Zm0 0V4h7l2 3h7v3',chat:'M8 3H3v15h4v4l5-4h9V8M17 2v8m-4-4h8',file:'M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 13h8M8 17h5',cube:'m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v8',check:'m5 12 4 4L19 6',tool:'m14 6 4-4a6 6 0 0 1-7 8L4 20a2 2 0 0 1-3-3l10-7a6 6 0 0 1 8-7l-5 3Z'};
  const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.file}"/></svg>`;
  function mount(o){
    const {root,deps}=o,events=new AbortController();let alive=true,pop=null,anchor=null,subMenu=null,subAnchor=null,kind='',request=0,modelTab='text',skillTab='all',skillQuery='',attachments=o.attachments||[],busy=false;
    const listen=(target,event,fn)=>target.addEventListener(event,fn,{signal:events.signal});
    function closeSub(focus=false){subMenu?.remove();subMenu=null;subAnchor?.setAttribute('aria-expanded','false');if(focus)subAnchor?.focus();subAnchor=null;}
    function close(focus=false){closeSub();request++;pop?.remove();pop=null;anchor?.setAttribute('aria-expanded','false');if(focus)anchor?.focus();anchor=null;kind='';}
    function positionSub(){if(!subMenu||!subAnchor)return;const r=subAnchor.getBoundingClientRect(),w=subMenu.offsetWidth,h=subMenu.offsetHeight;subMenu.style.left=Math.max(10,Math.min(r.right-w,innerWidth-w-10))+'px';subMenu.style.top=Math.max(10,Math.min(r.bottom+4,innerHeight-h-10))+'px';}
    function position(){if(!pop||!anchor)return;const r=anchor.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;let x=r.left+r.width/2-w/2,y=r.bottom+10;
      if(kind==='create')x=r.right-w;
      if(['attach','gen'].includes(kind)&&r.top>h+18)y=r.top-h-10;
      else if(y+h>innerHeight-10&&r.top>h+18)y=r.top-h-10;
      pop.style.left=Math.max(10,Math.min(x,innerWidth-w-10))+'px';pop.style.top=Math.max(10,Math.min(y,innerHeight-h-10))+'px';
      positionSub();
    }
    function open(type,trigger,label){if(kind===type&&anchor===trigger){close();return null;}close();kind=type;anchor=trigger;pop=make('div',`cah-popover cah-popover-${type}`);pop.setAttribute('role','dialog');pop.setAttribute('aria-label',label);pop.tabIndex=-1;
      trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-haspopup','dialog');(trigger.closest('dialog[open]')||document.body).append(pop);return pop;
    }
    function row(title,desc,icon,run){const b=btn('','cah-option',run),art=make('span','cah-option-icon');art.innerHTML=svg(icon);const text=make('span','cah-option-copy');text.append(make('strong','',title));if(desc)text.append(make('small','',desc));b.append(art,text);return b;}
    function ready(){position();pop?.focus({preventScroll:true});}
    function createMenu(trigger){const p=open('create',trigger,'创建 Skill');if(!p)return;
      p.append(row('创建新的Skill','通过与Agent对话创建','chat',()=>{close();o.beforeCreate?.();deps.createSkill();}),row('导入已有Skill','上传 .md 文件或文件夹','upload',()=>{close();importDialog(trigger);}));ready();
    }
    function importDialog(){close();o.importSkill();}
    async function models(trigger){const p=open('model',trigger,'选择模型');if(!p)return;const id=++request;p.append(make('h3','','选择模型'),make('p','cah-pop-empty','正在读取模型…'));ready();
      try{const data=await deps.listModels();if(!alive||p!==pop||request!==id)return;
        function render(){p.replaceChildren(make('h3','','选择模型'));const tabs=make('div','cah-segments');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','模型类型');
          for(const [key,label] of [['text','文本'],['image','图片'],['video','视频']]){const b=btn(label,modelTab===key?'is-active':'',()=>{modelTab=key;render();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(modelTab===key));tabs.append(b);}p.append(tabs,make('div','cah-pop-caption',{text:'文本',image:'图片',video:'视频'}[modelTab]));
          const list=make('div','cah-pop-list'),choice=deps.modelChoices(),selected=choice[modelTab]||({text:data.brainDefaultId,image:data.autoPick?.t2i,video:data.autoPick?.video}[modelTab]);
          const items=(data.models||[]).filter(m=>m.enabled&&(modelTab==='text'?!['t2i','video','tts'].includes(m.type):m.type===(modelTab==='image'?'t2i':'video')));
          for(const m of items){const b=row(m.name||m.model||'未命名模型',!m.hasKey?'未配置 Key':m.description||(m.model!==m.name?m.model:'')||'已启用，可用于当前工作流','cube',()=>{deps.selectModel(modelTab,m.id);sync();close(true);});b.dataset.modelId=m.id;b.disabled=!m.hasKey;b.setAttribute('aria-pressed',String(selected===m.id));const mark=make('span','cah-option-mark',selected===m.id?'✓':'⊕');b.append(mark);list.append(b);}
          if(!items.length)list.append(make('p','cah-pop-empty','暂无可用模型'),btn('前往供应商设置','cah-inline-button',()=>{close();window.CanvasFlowSettings?.open?.('providers');}));p.append(list);position();
        }render();
      }catch{if(p===pop){p.replaceChildren(make('p','cah-pop-empty','模型读取失败'),btn('重新加载','cah-inline-button',()=>{close();models(trigger);}));position();}}
    }
    function skills(trigger){const p=open('skill',trigger,'选择 Skill');if(!p)return;const heading=make('div','cah-pop-heading'),create=btn('＋ 创建 ⌄','cah-inline-button',()=>{
        if(subMenu){closeSub();return;}subAnchor=create;subMenu=make('div','cah-popover cah-create-submenu');subMenu.setAttribute('role','dialog');subMenu.setAttribute('aria-label','创建 Skill 菜单');
        subMenu.append(row('创建新的Skill','通过与Agent对话创建','chat',()=>{close();deps.createSkill();}),row('导入已有Skill','上传 .md 文件或文件夹','upload',()=>{close();importDialog(trigger);}));
        document.body.append(subMenu);create.setAttribute('aria-expanded','true');positionSub();
      });create.setAttribute('aria-expanded','false');create.setAttribute('aria-haspopup','dialog');
      heading.append(make('h3','','Skill'),create,btn('全部','cah-inline-button',()=>{close();o.showAll();}));const controls=make('div','cah-picker-controls'),tabs=make('div','cah-picker-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','选择技能来源');
      const search=make('input','cah-picker-search');search.type='search';search.placeholder='搜索 Skill';search.setAttribute('aria-label','搜索可选 Skill');search.value=skillQuery;const list=make('div','cah-pop-list');
      function render(){tabs.replaceChildren();for(const [key,label] of [['all','通用'],['fav','收藏'],['mine','我的']]){const b=btn(label,skillTab===key?'is-active':'',()=>{skillTab=key;render();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(skillTab===key));tabs.append(b);}list.replaceChildren();
        const q=skillQuery.trim().toLowerCase(),items=o.skills().filter(s=>skillTab==='mine'?s.owned:skillTab==='fav'?deps.favorites().includes(s.id):!s.owned).filter(s=>`${s.title} ${s.desc} ${s.id}`.toLowerCase().includes(q));
        for(const s of items){const b=row(s.title,s.desc,'tool',()=>{o.select(s);close();});const slug=s.prompt?.match(/^name:\s*(\S+)/m)?.[1]||s.id.replace(/^hub-/,'');b.querySelector('strong').append(make('code','',`/${slug}`));b.setAttribute('aria-pressed',String(o.selected()?.id===s.id));list.append(b);}if(!items.length)list.append(make('p','cah-pop-empty','当前暂无Skill'));position();
      }listen(search,'input',()=>{skillQuery=search.value;render();});controls.append(tabs,search);p.append(heading,controls,list);render();ready();
    }
    function sync(){const gen=root.querySelector('[data-action="gen"]');if(gen){const auto=deps.genMode?.()==='auto';gen.innerHTML=svg(auto?'auto':'hand');gen.title=gen.ariaLabel=auto?'自动生成':'手动生成';}}
    function generation(trigger){const p=open('gen',trigger,'生成方式');if(!p)return;for(const [id,title,desc,icon] of [['manual','手动生成','CanvasFlow Agent 每次生成前询问','hand'],['auto','自动生成','CanvasFlow Agent 可直接提交生成任务','auto']]){const b=row(title,desc,icon,()=>{deps.setGenMode(id);sync();close(true);});const chosen=(deps.genMode?.()||'manual')===id;b.setAttribute('aria-pressed',String(chosen));b.append(make('span','cah-option-mark',chosen?'✓':''));p.append(b);}ready();}
    function paintAttachments(){const area=root.querySelector('.cah-attachments');area.replaceChildren();area.hidden=!attachments.length;attachments.forEach((item,i)=>{const chip=make('span','cah-attachment');if(item.kind==='image'&&(item.thumbnail||item.url)){const img=make('img','');img.src=item.thumbnail||item.url;img.alt='';chip.append(img);}chip.append(make('span','',item.name),btn('×','',()=>{attachments.splice(i,1);paintAttachments();}));chip.lastChild.setAttribute('aria-label',`移除附件：${item.name}`);area.append(chip);});o.changeAttachments(attachments.slice());}
    const add=rows=>{for(const row of rows)if(!attachments.some(a=>a.id===row.id))attachments.push(row);paintAttachments();};
    function attach(trigger){const p=open('attach',trigger,'添加附件');if(!p)return;p.append(row('本地上传','','upload',()=>{close();root.querySelector('.cah-upload').click();}),row('素材库添加','','folder',()=>library(trigger)));ready();}
    async function library(trigger){const p=open('assets',trigger,'素材库添加');if(!p)return;const id=++request;p.append(make('h3','','素材库添加'),make('p','cah-pop-empty','正在读取当前工作区素材…'));ready();
      try{const rows=await deps.listMaterials();if(!alive||p!==pop||id!==request)return;const search=make('input','cah-picker-search');search.placeholder='搜索素材';search.setAttribute('aria-label','搜索可选素材');const list=make('div','cah-pop-list'),picked=new Map(),done=btn('添加所选素材','cah-create',()=>{add([...picked.values()]);close(true);});done.disabled=true;
        function render(){list.replaceChildren();for(const item of rows.filter(r=>r.name.toLowerCase().includes(search.value.toLowerCase()))){const b=row(item.name,{image:'图片',video:'视频',audio:'音频'}[item.kind]||'素材','file',()=>{picked.has(item.id)?picked.delete(item.id):picked.set(item.id,item);render();});const art=b.querySelector('.cah-option-icon');if(item.thumbnail||item.kind==='image'&&item.url){const img=make('img','');img.src=item.thumbnail||item.url;img.alt='';art.replaceChildren(img);}b.setAttribute('aria-pressed',String(picked.has(item.id)));b.append(make('span','cah-option-mark',picked.has(item.id)?'✓':'＋'));list.append(b);}if(!list.childElementCount)list.append(make('p','cah-pop-empty','暂无可选素材，请先本地上传'));done.disabled=!picked.size;done.textContent=picked.size?`添加所选素材（${picked.size}）`:'添加所选素材';position();}
        listen(search,'input',render);p.replaceChildren(make('h3','','素材库添加'),search,list,done);render();
      }catch{if(p===pop){p.replaceChildren(make('p','cah-pop-empty','素材读取失败'),btn('重新加载','cah-inline-button',()=>{close();library(trigger);}));position();}}
    }
    listen(root.querySelector('.cah-upload'),'change',async e=>{const files=[...e.target.files];e.target.value='';if(!files.length||busy)return;busy=true;const progress=root.querySelector('.cah-attachment-status');progress.hidden=false;progress.textContent='正在添加附件…';o.busy(true);
      try{for(const file of files){if(!alive)break;const item=await deps.uploadAttachment(file);if(alive&&item)add([item]);}}catch(error){if(alive)deps.toast?.(error.message||'附件添加失败','×');}finally{busy=false;if(alive){progress.hidden=true;o.busy(false);}}});
    for(const b of root.querySelectorAll('.cah-tools [data-action]')){const action=b.dataset.action;listen(b,'click',()=>({attach,model:models,skill:skills,gen:generation}[action]?.(b)));b.setAttribute('aria-expanded','false');b.setAttribute('aria-haspopup','dialog');}
    listen(document,'pointerdown',e=>{const insideSub=subMenu?.contains(e.target);if(subMenu&&!insideSub&&!subAnchor?.contains(e.target))closeSub();if(pop&&!insideSub&&!pop.contains(e.target)&&!anchor?.contains(e.target))close();});
    listen(document,'keydown',e=>{if(e.key==='Escape'&&pop){e.preventDefault();e.stopPropagation();if(subMenu)closeSub(true);else close(true);}});
    listen(window,'resize',position);document.addEventListener('scroll',position,{capture:true,signal:events.signal});
    listen(window,'canvasflow:models-changed',()=>{if(kind==='model'){const a=anchor;close();models(a);}});
    sync();paintAttachments();
    return {createMenu,close,refresh:sync,attachments:()=>attachments.slice(),clearAttachments:()=>{attachments=[];paintAttachments();},dispose(){alive=false;events.abort();close();}};
  }
  window.CanvasFlowHubControls={mount};
})();
