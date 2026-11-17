/* Local Skill document editor. Uploads are staged until the user presses Save. */
(() => {
  'use strict';
  const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
  const button=(label,cls,run)=>{const n=make('button',cls,label);n.type='button';n.addEventListener('click',run);return n;};
  const paths={folder:'M3 7h7l2 3h9v11H3V7Zm0 0V4h7l2 3h7M12 12v6m-3-3h6',file:'M14 3H5v18h14V8l-5-5Zm0 0v5h5M12 11v7m-3-3h6',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',expand:'M14 3h7v7m0-7-7 7M10 21H3v-7m0 7 7-7',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',pin:'m9 3 6 0-1 6 4 3v2H6v-2l4-3-1-6Zm3 11v7'};
  const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.file}"/></svg>`;
  const hint='输入 Skill 内容，或上传 SKILL.md 文件直接替换\n\n## 做什么\n（一句话说明用途）例：把一句话故事想法做成一条短漫剧成片\n\n## 需要什么输入\n（最少提供什么）例：一句话想法，可选画风、时长、主角设定\n\n## 怎么做\n（写你在意的环节和要求，不用写全）例：脚本要反转多，画风固定成静漫\n\n## 产出什么\n（最终交付什么）例：成片，附脚本和分镜\n\n## 什么时候问你\n（什么情况下停下来问你）例：拿不准题材或风格时问一次，其余自己定';
  function validPath(path){return !!path&&!path.startsWith('/')&&!/[<>:"\\|?*\u0000-\u001f]/.test(path)&&path.split('/').every(p=>p&&p!=='.'&&p!=='..');}
  function open(o){
    const skill=o.skill,initial=skill?.details?.files;
    let files=initial?.length?initial.map(f=>({path:f.path,content:f.content})): [{path:'SKILL.md',content:skill?.prompt||''}];
    let primary=skill?.details?.primarySkillFilePath||'SKILL.md';if(!files.some(f=>f.path===primary))primary=files[0].path;
    let selected=primary,mode='preview',dirty=false,busy=false,closed=false,aux=null,folders=[],coverFile=null,coverUrl=skill?.cover||'',coverPreview='';
    const dialog=make('dialog','cse-dialog');dialog.setAttribute('aria-label',skill?'编辑 Skill':'创建 Skill');
    dialog.innerHTML=`<form class="cse-form"><header class="cse-header"><div class="cse-title"><button type="button" class="cse-back" aria-label="返回技能库">‹</button><h1>${skill?'编辑Skill':'创建Skill'}</h1></div><button type="submit" class="cse-save">保存</button></header><fieldset class="cse-fields"><label class="cse-field">Skill 名称 <span>*</span><input name="name" aria-label="Skill 名称" placeholder="给你的 Skill 起个名字" maxlength="60" required></label><label class="cse-field">一句话介绍 <span>*</span><input name="description" aria-label="一句话介绍" placeholder="简短描述该 Skill 的能力" maxlength="200" required></label><section class="cse-content"><div class="cse-toolbar"><h2>Skill 内容 <span>*</span></h2><div class="cse-tools"><div class="cse-modes"></div><div class="cse-upload-wrap"></div></div></div><div class="cse-workbench"><aside class="cse-directory"><div class="cse-directory-head"><span>目录</span><div></div></div><div class="cse-tree" aria-label="Skill 文件目录"></div></aside><div class="cse-document"><textarea aria-label="Skill 文件内容" spellcheck="false"></textarea><div class="cse-preview" tabindex="0" aria-label="Skill 内容预览"></div></div></div></section></fieldset><p class="cse-error" role="alert" hidden></p><input class="cse-file-input" type="file" accept=".md,.markdown,.txt" multiple hidden><input class="cse-folder-input" type="file" webkitdirectory multiple hidden></form>`;
    const form=dialog.querySelector('form'),name=form.elements.name,description=form.elements.description,area=dialog.querySelector('textarea'),preview=dialog.querySelector('.cse-preview'),tree=dialog.querySelector('.cse-tree'),error=dialog.querySelector('.cse-error'),fields=dialog.querySelector('fieldset'),save=dialog.querySelector('.cse-save');
    const closeButton=button('×','cse-close',()=>askClose());closeButton.setAttribute('aria-label','关闭 Skill 编辑器');
    const headerActions=make('div','cse-header-actions');save.replaceWith(headerActions);headerActions.append(save,closeButton);
    const metadata={};
    for(const [key,label,placeholder] of [
      ['useScenario','使用场景','详细描述该 Skill 的使用场景信息'],
      ['inputType','如何使用','描述用户如何使用该 Skill，需要输入什么信息（例如：剧本内容、故事梗概或任何叙事素材）'],
      ['outputContent','输出内容','描述用户使用该 Skill 后，预期输出的结果产物是什么（例如：90秒超现实主义数字片头视频）']
    ]){
      const field=make('label','cse-field',label+' ');field.append(make('span','','*'));
      const input=make('textarea','');input.name=key;input.required=true;input.maxLength=5000;input.placeholder=placeholder;input.setAttribute('aria-label',label);input.value=skill?.details?.[key]||'';
      input.addEventListener('input',()=>{dirty=true;});metadata[key]=input;field.append(input);fields.append(field);
    }
    const typeField=make('label','cse-field','选择类型'),type=make('select','');type.setAttribute('aria-label','选择类型');
    for(const value of ['图片','视频','音频','文本']){const option=make('option','',value);option.value=value;type.append(option);}type.value=['图片','视频','音频','文本'].includes(skill?.kind)?skill.kind:'图片';type.addEventListener('change',()=>{dirty=true;});typeField.append(type);fields.append(typeField);
    const coverField=make('div','cse-field','上传封面（选填）'),coverInput=make('input','cse-cover-input');coverInput.type='file';coverInput.accept='.png,.jpg,.jpeg,.webp,.gif';coverInput.hidden=true;
    const cover=button('＋','cse-cover',()=>coverInput.click());cover.setAttribute('aria-label','上传封面');
    const removeCover=button('移除封面','cse-cover-remove',()=>{coverFile=null;coverUrl='';if(coverPreview)URL.revokeObjectURL(coverPreview);coverPreview='';dirty=true;paintCover();});
    function paintCover(){cover.replaceChildren();const url=coverPreview||coverUrl;if(url){const image=make('img','');image.src=url;image.alt='Skill 封面';cover.append(image);}else cover.textContent='＋';removeCover.hidden=!url;}
    coverInput.addEventListener('change',async()=>{const file=coverInput.files[0];coverInput.value='';if(!file||busy)return;error.hidden=true;
      if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>10_000_000){fail('封面请选择不超过 10 MB 的 PNG、JPG、WebP 或 GIF 图片');return;}
      const url=URL.createObjectURL(file),image=new Image();busy=true;fields.disabled=true;save.disabled=true;
      try{image.src=url;await image.decode();if(closed){URL.revokeObjectURL(url);return;}if(coverPreview)URL.revokeObjectURL(coverPreview);coverPreview=url;coverFile=file;dirty=true;paintCover();}
      catch{URL.revokeObjectURL(url);fail('无法读取这张图片，请选择有效的封面');}
      finally{busy=false;fields.disabled=false;save.disabled=false;}
    });
    coverField.append(cover,removeCover,coverInput);fields.append(coverField);paintCover();
    name.value=skill?.title||'';description.value=skill?.desc||'';area.placeholder=hint;
    const derived=o.parse(files.find(f=>f.path===primary).content,name.value||'SKILL.md');
    if(skill&&(!description.value||/^[-*_]{3,}$/.test(description.value)))description.value=derived.desc;
    const fail=message=>{error.textContent=message;error.hidden=false;};
    function closeAux(){aux?.remove();aux=null;}
    function close(){if(closed)return;closed=true;if(coverPreview)URL.revokeObjectURL(coverPreview);closeAux();dialog.close();dialog.remove();o.onClose?.();}
    function askClose(){if(busy)return;if(!dirty){close();return;}confirm('放弃未保存的修改？','返回后，本次未保存的内容将丢失。','放弃修改',close);}
    function modal(title){closeAux();aux=make('dialog','cse-small-dialog');aux.setAttribute('aria-label',title);aux.append(make('h2','',title));dialog.append(aux);aux.addEventListener('cancel',e=>{e.preventDefault();closeAux();});aux.showModal();return aux;}
    function confirm(title,message,label,run){const box=modal(title);box.append(make('p','',message));const actions=make('div','cse-small-actions');actions.append(button('取消','',closeAux),button(label,'cse-danger',()=>{closeAux();run();}));box.append(actions);}
    function askPath(title,value,run){const box=modal(title),form=make('form',''),input=make('input','');input.value=value;input.required=true;input.setAttribute('aria-label','文件或文件夹路径');const note=make('p','cse-error');const actions=make('div','cse-small-actions');const ok=make('button','','确定');ok.type='submit';actions.append(button('取消','',closeAux),ok);form.append(input,note,actions);box.append(form);input.focus();form.addEventListener('submit',e=>{e.preventDefault();try{const path=input.value.trim();run(path);closeAux();}catch(e){note.textContent=e.message;}});}
    function unique(path,ignore=''){if(!validPath(path))throw Error('请输入有效的相对路径');if(files.some(f=>f.path!==ignore&&f.path.toLowerCase()===path.toLowerCase())||folders.includes(path))throw Error('已存在同名文件或文件夹');}
    function addFile(){askPath('新建文件',selected.includes('/')?selected.slice(0,selected.lastIndexOf('/')+1)+'reference.md':'reference.md',path=>{unique(path);if(!/\.(md|markdown|txt)$/i.test(path))throw Error('文件名需要以 .md、.markdown 或 .txt 结尾');if(files.length>=100)throw Error('最多添加 100 个文档');files.push({path,content:''});selected=path;mode='code';dirty=true;paint();area.focus();});}
    function addFolder(){askPath('新建文件夹','references',path=>{unique(path);folders.push(path);dirty=true;paintTree();});}
    function tool(label,svg,run){const b=button('','cse-icon',run);b.innerHTML=icon(svg);b.title=label;b.setAttribute('aria-label',label);return b;}
    const modes=dialog.querySelector('.cse-modes'),previewBtn=button('','',()=>{mode='preview';paintDocument();}),codeBtn=button('‹/› 代码','',()=>{mode='code';paintDocument();area.focus();});previewBtn.innerHTML=icon('eye')+'预览';previewBtn.setAttribute('aria-label','预览内容');codeBtn.setAttribute('aria-label','编辑代码');modes.append(previewBtn,codeBtn);
    const wrap=dialog.querySelector('.cse-upload-wrap'),upload=button('','cse-upload-button',()=>{uploadMenu.hidden=!uploadMenu.hidden;upload.setAttribute('aria-expanded',String(!uploadMenu.hidden));});upload.innerHTML=icon('upload')+'上传⌄';upload.setAttribute('aria-label','上传 Skill 文件');upload.setAttribute('aria-expanded','false');
    const uploadMenu=make('div','cse-upload-menu');uploadMenu.hidden=true;const hideUpload=()=>{uploadMenu.hidden=true;upload.setAttribute('aria-expanded','false');};uploadMenu.append(button('上传 .md 文件','',()=>{hideUpload();dialog.querySelector('.cse-file-input').click();}),button('上传文件夹','',()=>{hideUpload();dialog.querySelector('.cse-folder-input').click();}));wrap.append(upload,uploadMenu);
    dialog.querySelector('.cse-tools').append(tool('新建文件','file',addFile),tool('展开内容编辑区','expand',()=>{dialog.querySelector('.cse-content').classList.toggle('is-expanded');}));
    dialog.querySelector('.cse-directory-head div').append(tool('新建文件夹','folder',addFolder),tool('新建文件','file',addFile));
    function paintTree(){
      tree.replaceChildren();const dirs=new Set(folders);for(const f of files){const parts=f.path.split('/');for(let i=1;i<parts.length;i++)dirs.add(parts.slice(0,i).join('/'));}
      const walk=(prefix='',depth=0)=>{
        for(const dir of [...dirs].filter(d=>(d.includes('/')?d.slice(0,d.lastIndexOf('/')+1):'')===prefix).sort()){
          const row=make('div','cse-folder-row');row.style.paddingLeft=12+depth*14+'px';row.innerHTML=icon('folder');row.append(make('span','',dir.split('/').pop()));tree.append(row);walk(dir+'/',depth+1);
        }
        for(const file of files.filter(f=>(f.path.includes('/')?f.path.slice(0,f.path.lastIndexOf('/')+1):'')===prefix)){
          const row=make('div','cse-file-row');row.style.paddingLeft=8+depth*14+'px';row.classList.toggle('is-active',file.path===selected);const choose=button('','cse-file-select',()=>{selected=file.path;paint();});choose.innerHTML=icon('file');choose.append(make('span','',file.path.split('/').pop()));choose.title=file.path;choose.setAttribute('aria-label','打开文件：'+file.path);row.append(choose);
          if(file.path===primary){const pin=make('span','cse-pin');pin.innerHTML=icon('pin');pin.title='主 Skill 文件';row.append(pin);}else{
            row.append(button('⋯','cse-file-more',()=>askPath('重命名文件',file.path,path=>{unique(path,file.path);if(!/\.(md|markdown|txt)$/i.test(path))throw Error('只支持 Markdown 或文本文件');file.path=path;selected=path;dirty=true;paint();})),button('×','cse-file-remove',()=>confirm('删除文件',`从此 Skill 移除 ${file.path}？`,'删除',()=>{files=files.filter(f=>f!==file);if(selected===file.path)selected=primary;dirty=true;paint();})));
            row.querySelector('.cse-file-more').setAttribute('aria-label','重命名：'+file.path);row.querySelector('.cse-file-remove').setAttribute('aria-label','删除文件：'+file.path);
          }tree.append(row);
        }
      };walk();
    }
    function paintDocument(){const file=files.find(f=>f.path===selected);area.value=file.content;const editing=mode==='code'||!file.content;area.hidden=!editing;preview.hidden=editing;previewBtn.classList.toggle('is-active',mode==='preview');codeBtn.classList.toggle('is-active',mode==='code');previewBtn.setAttribute('aria-pressed',String(mode==='preview'));codeBtn.setAttribute('aria-pressed',String(mode==='code'));if(!editing){preview.replaceChildren(o.renderMarkdown(file.content,files,index=>{selected=files[index].path;paint();}));}}
    function paint(){paintTree();paintDocument();}
    area.addEventListener('input',()=>{files.find(f=>f.path===selected).content=area.value;dirty=true;});
    for(const input of [name,description])input.addEventListener('input',()=>{dirty=true;});
    const autofill=()=>{const data=o.parse(files.find(f=>f.path===primary).content,'SKILL.md');if(!name.value.trim())name.value=data.title.slice(0,60);if(!description.value.trim())description.value=data.desc.slice(0,200);};
    async function importFiles(picked,folder){
      if(!picked.length||busy)return;error.hidden=true;
      busy=true;fields.disabled=true;save.disabled=true;save.textContent='读取中…';
      try{
        const docs=picked.filter(f=>/\.(md|markdown|txt)$/i.test(f.name));if(!docs.length)throw Error('请选择 Markdown 文件');
        if(!folder&&docs.length!==picked.length)throw Error('包含不支持的文件，请仅选择 Markdown 或文本文件；本次未导入');
        if(docs.length>100||docs.reduce((sum,f)=>sum+f.size,0)>2_000_000)throw Error('最多导入 100 个文档，合计不超过 2 MB');
        const loaded=await Promise.all(docs.map(async f=>({path:folder?f.webkitRelativePath.split('/').slice(1).join('/'):docs.length>1?f.name:selected,content:await f.text()})));if(closed)return;
        if(loaded.some(f=>!validPath(f.path)))throw Error('文件夹包含无效路径');
        if(new Set(loaded.map(f=>f.path.toLowerCase())).size!==loaded.length)throw Error('文件路径重复，本次未导入');
        if(folder){const main=loaded.find(f=>/^SKILL\.md$/i.test(f.path));if(!main)throw Error('文件夹根目录需要包含 SKILL.md');if(new Set(loaded.map(f=>f.path.toLowerCase())).size!==loaded.length)throw Error('文件路径重复');files=loaded;primary=main.path;selected=primary;folders=[];}
        else {
          let next=files.map(f=>({...f}));
          for(const file of loaded){
            const existing=next.find(f=>f.path.toLowerCase()===file.path.toLowerCase());
            if(docs.length>1&&((existing&&existing.content.trim())||folders.some(f=>f.toLowerCase()===file.path.toLowerCase())))throw Error(`已有同名文件或文件夹：${file.path}。请逐个替换或上传完整文件夹；本次未导入`);
            if(existing)existing.content=file.content;else next.push(file);
          }
          if(next.length>100||next.reduce((sum,f)=>sum+new TextEncoder().encode(f.content).length,0)>2_000_000)throw Error('合并后最多 100 个文档、2 MB；本次未导入');
          files=next;
        }
        dirty=true;mode='preview';autofill();paint();
      }catch(e){fail(e.message||'文件读取失败');}
      finally{busy=false;if(!closed){fields.disabled=false;save.disabled=false;save.textContent='保存';}}
    }
    dialog.querySelector('.cse-file-input').addEventListener('change',e=>{const picked=[...e.target.files];e.target.value='';void importFiles(picked,false);});
    dialog.querySelector('.cse-folder-input').addEventListener('change',e=>{const picked=[...e.target.files];e.target.value='';void importFiles(picked,true);});
    dialog.querySelector('.cse-document').addEventListener('dragover',e=>{e.preventDefault();});
    dialog.querySelector('.cse-document').addEventListener('drop',e=>{e.preventDefault();void importFiles([...e.dataTransfer.files],false);});
    dialog.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))hideUpload();});
    dialog.addEventListener('cancel',e=>{e.preventDefault();if(aux)return;if(dialog.querySelector('.is-expanded'))dialog.querySelector('.is-expanded').classList.remove('is-expanded');else askClose();});
    dialog.querySelector('.cse-back').addEventListener('click',askClose);
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(busy)return;error.hidden=true;
      if(!name.value.trim()||!description.value.trim()){fail('请填写 Skill 名称和一句话介绍');return;}
      if(!files.find(f=>f.path===primary)?.content.trim()){fail('请填写主 Skill 文件内容');return;}
      if(files.reduce((sum,f)=>sum+new TextEncoder().encode(f.content).length,0)>2_000_000){fail('Skill 文档合计不能超过 2 MB');return;}
      const value={id:skill?.id,name:name.value.trim(),description:description.value.trim(),files:files.map(f=>({...f,primary:f.path===primary})),primarySkillFilePath:primary,prompt:files.length===1?files[0].content:files.map(f=>`文件：${f.path}\n${f.content}`).join('\n\n')};
      if(Object.values(metadata).some(input=>!input.value.trim())){fail('请填写使用场景、如何使用和输出内容');return;}
      value.metadata={...Object.fromEntries(Object.entries(metadata).map(([key,input])=>[key,input.value.trim()])),kind:type.value,cover:coverUrl};value.coverFile=coverFile;
      busy=true;fields.disabled=true;save.disabled=true;save.textContent='保存中…';
      try{const result=await o.save(value);if(!result)throw Error('当前页面已切换，请重新打开技能后保存');if(closed)return;dirty=false;await o.onSaved(result);close();}
      catch(e){if(!closed)fail(e.message||'保存失败，请重试');}
      finally{busy=false;if(!closed){fields.disabled=false;save.disabled=false;save.textContent='保存';}}
    });
    document.body.append(dialog);paint();dialog.showModal();name.focus();
    return {close,element:dialog};
  }
  window.CanvasFlowSkillEditor={open};
})();
