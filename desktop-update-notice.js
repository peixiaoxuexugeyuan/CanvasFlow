/* Desktop-only update notice. Checking and verified installation stay in Electron. */
(() => {
  'use strict';
  const desktop=window.CanvasFlowDesktop;
  if(!desktop?.getUpdateState||!desktop?.dismissUpdateNotice||!desktop?.onUpdateStatus)return;
  let state={status:'idle'},panel=null,submitting=false,dismissed=false,revision=0;
  const key=value=>`${value.version}:${value.buildNumber||0}`;
  let dismissedKey='';
  const busy=value=>['checking','downloading','verifying','installing'].includes(value.status);
  function rememberChoice(){
    dismissedKey=key(state);dismissed=true;
    return desktop.dismissUpdateNotice({version:state.version,buildNumber:state.buildNumber||0}).catch(()=>{});
  }
  function close(){if(!panel)return;void rememberChoice();panel.close();}
  function paint(){
    if(!panel)return;
    panel.querySelector('[data-update-version]').textContent=state.currentVersion===state.version?`版本 v${state.version}`:`v${state.currentVersion||''} → v${state.version||''}`;
    const build=panel.querySelector('[data-update-build]');
    build.textContent=state.buildNumber?`新构建 ${state.buildNumber}`:'';build.hidden=!state.buildNumber;
    panel.querySelector('[data-update-title]').textContent=busy(state)?'正在更新 CanvasFlow':state.status==='error'?'更新未完成':'发现 CanvasFlow 新版本';
    const message=panel.querySelector('[data-update-message]');
    message.textContent=state.status==='downloading'?`正在下载更新，已完成 ${state.progress||0}%`:
      state.status==='verifying'?'正在校验安装包…':state.status==='installing'?'正在保存项目并打开安装程序…':
      state.status==='checking'?'正在重新检查更新…':state.status==='error'?(state.message||'更新失败，请重试'):
      state.status==='ready'?'安装包已就绪。继续安装前会保存当前项目。':'新版本已准备好。你可以现在更新，也可以稍后在“设置 → 关于 CanvasFlow”中更新。';
    message.setAttribute('role',state.status==='error'?'alert':'status');
    const progress=panel.querySelector('progress');progress.hidden=!['downloading','verifying'].includes(state.status);progress.value=Math.max(0,Math.min(100,state.progress||0));
    const install=panel.querySelector('[data-update-now]');install.disabled=submitting||busy(state);
    install.textContent=busy(state)?'更新中…':state.status==='error'?'重试更新':state.status==='ready'?'继续安装':'立即更新';
    panel.querySelector('[data-update-later]').textContent=['downloading','verifying'].includes(state.status)?'后台下载':'稍后更新';
  }
  function attempt(){
    if(panel||!['available','ready'].includes(state.status)||state.notificationDismissed||dismissedKey===key(state))return;
    const root=document.documentElement;
    if(document.visibilityState==='hidden'||root.dataset.canvasflowReady!=='true'||root.dataset.canvasflowNoticesReady!=='true'||window.CanvasFlowStartup?.isPlaying()||root.classList.contains('cf-startup-pending')||document.querySelector('dialog[open]'))return;
    dismissed=false;
    const dialog=document.createElement('dialog');panel=dialog;dialog.className='desktop-update-dialog';
    dialog.setAttribute('aria-labelledby','desktopUpdateTitle');
    dialog.innerHTML='<button type="button" class="desktop-update-close" aria-label="稍后更新，关闭提示">×</button><div class="desktop-update-icon" aria-hidden="true">↑</div><h2 id="desktopUpdateTitle" data-update-title></h2><p class="desktop-update-version"><span data-update-version></span><small data-update-build></small></p><p class="desktop-update-message" data-update-message aria-live="polite"></p><progress max="100" value="0" aria-label="更新下载进度" hidden></progress><div class="desktop-update-actions"><button type="button" data-update-later>稍后更新</button><button type="button" class="desktop-update-primary" data-update-now>立即更新</button></div>';
    dialog.querySelector('.desktop-update-close').addEventListener('click',close);
    dialog.querySelector('[data-update-later]').addEventListener('click',close);
    const onKey=event=>{if(event.key==='Escape'&&dialog.open){event.preventDefault();event.stopImmediatePropagation();close();}};
    window.addEventListener('keydown',onKey,true);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('close',()=>{window.removeEventListener('keydown',onKey,true);if(!dismissed)void rememberChoice();dialog.remove();if(panel===dialog)panel=null;},{once:true});
    dialog.querySelector('[data-update-now]').addEventListener('click',async()=>{
      if(submitting||busy(state))return;
      submitting=true;paint();await rememberChoice();
      try{
        if(state.status==='error')receive(await desktop.checkForUpdates());
        if(['available','ready'].includes(state.status))receive(await desktop.installUpdate());
      }catch(error){receive({...state,status:'error',message:error.message||'更新失败，请重试'});}
      finally{submitting=false;paint();}
    });
    document.body.append(dialog);paint();
    try{dialog.showModal();dialog.querySelector('[data-update-later]').focus();}
    catch{window.removeEventListener('keydown',onKey,true);dialog.remove();panel=null;}
  }
  function receive(value){
    if(!value)return;state=value;
    if(panel&&['up-to-date','unsupported'].includes(state.status)){close();return;}
    paint();attempt();
  }
  const unsubscribe=desktop.onUpdateStatus(value=>{revision++;receive(value);});
  const startRevision=revision;
  void desktop.getUpdateState().then(value=>{if(revision===startRevision)receive(value);}).catch(()=>{});
  const observer=new MutationObserver(attempt);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-canvasflow-ready','data-canvasflow-notices-ready']});
  document.addEventListener('visibilitychange',attempt);
  document.addEventListener('close',()=>queueMicrotask(attempt),true);
  window.addEventListener('pagehide',()=>{unsubscribe?.();observer.disconnect();},{once:true});
})();
