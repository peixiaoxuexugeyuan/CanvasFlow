// Renderer-only fixture: no real update downloads or installation, no user profile access.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const os=require('node:os'),{spawn}=require('node:child_process');
const {chromium}=require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),output=path.join(root,'build-private/startup-update-check');fs.mkdirSync(output,{recursive:true});
let browser,server;
(async()=>{
  browser=await chromium.launch({executablePath:path.join(root,'.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'),headless:true});
  async function pageFor(status='available',options={}){
    const page=await browser.newPage({viewport:{width:1092,height:871}});
    await page.setContent('<!doctype html><html><body style="background:#121212"><h1 style="color:#eee">CanvasFlow</h1></body></html>');
    await page.addStyleTag({path:path.join(root,'desktop-update-notice.css')});
    await page.evaluate(({status,options})=>{
      document.documentElement.dataset.canvasflowReady=options.waitReady?'false':'true';
      document.documentElement.dataset.canvasflowNoticesReady=options.waitNotes?'false':'true';
      window.counts={checks:0,installs:0,dismisses:0};
      let listener;
      window.update={status,currentVersion:'1.0.0',version:'1.0.1',buildNumber:2026111801,progress:0,notificationDismissed:!!options.dismissed};
      window.publish=value=>{Object.assign(window.update,value);listener?.({...window.update});};
      if(!options.browser)window.CanvasFlowDesktop={
        getUpdateState:async()=>({...window.update}),
        dismissUpdateNotice:async()=>{window.counts.dismisses++;window.update.notificationDismissed=true;},
        onUpdateStatus:fn=>{listener=fn;return()=>{listener=null;};},
        checkForUpdates:async()=>{window.counts.checks++;window.publish({status:'available'});return {...window.update};},
        installUpdate:async()=>{window.counts.installs++;window.publish({status:'downloading',progress:35});return await new Promise(resolve=>window.finishUpdate=value=>{window.publish(value);resolve({...window.update});});}
      };
    },{status,options});
    await page.addScriptTag({path:path.join(root,'desktop-update-notice.js')});
    return page;
  }
  const page=await pageFor('available',{waitReady:true,waitNotes:true});
  assert.equal(await page.locator('dialog').count(),0);
  await page.evaluate(()=>document.documentElement.dataset.canvasflowReady='true');
  assert.equal(await page.locator('dialog').count(),0);
  await page.evaluate(()=>document.documentElement.dataset.canvasflowNoticesReady='true');
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('button',{name:'立即更新',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'稍后更新',exact:true}).count(),1);
  await page.screenshot({path:path.join(output,'startup-update-dark.png')});
  await page.getByRole('button',{name:'稍后更新',exact:true}).click();
  await page.locator('dialog').waitFor({state:'detached'});
  assert.equal(await page.locator('dialog').count(),0);
  await page.evaluate(()=>window.publish({status:'available'}));
  assert.equal(await page.locator('dialog').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.counts),{checks:0,installs:0,dismisses:1});
  for(const [status,options] of [['up-to-date',{}],['error',{}],['unsupported',{}],['available',{browser:true}],['available',{dismissed:true}]]){
    const quiet=await pageFor(status,options);assert.equal(await quiet.locator('dialog').count(),0);await quiet.close();
  }
  const next=await pageFor();await next.getByRole('dialog').waitFor();
  await next.evaluate(()=>document.documentElement.classList.add('light'));
  await next.screenshot({path:path.join(output,'startup-update-light.png')});
  await next.getByRole('button',{name:'立即更新',exact:true}).click();
  await next.getByText('正在下载更新，已完成 35%').waitFor();
  assert.equal(await next.locator('progress').getAttribute('value'),'35');
  assert.equal(await next.getByRole('button',{name:'更新中…',exact:true}).isDisabled(),true);
  await next.screenshot({path:path.join(output,'startup-update-progress.png')});
  await next.evaluate(()=>window.finishUpdate({status:'error',message:'下载失败，请重试'}));
  await next.getByRole('button',{name:'重试更新',exact:true}).waitFor();
  await next.getByRole('button',{name:'重试更新',exact:true}).click();
  assert.deepEqual(await next.evaluate(()=>window.counts),{checks:1,installs:2,dismisses:2});
  await next.getByRole('button',{name:'后台下载',exact:true}).click();
  await next.locator('dialog').waitFor({state:'detached'});
  await next.evaluate(()=>window.finishUpdate({status:'ready',progress:100}));
  assert.equal(await next.locator('dialog').count(),0);
  const escaped=await pageFor();await escaped.getByRole('dialog').waitFor();await escaped.keyboard.press('Escape');
  await escaped.locator('dialog').waitFor({state:'detached'});
  assert.equal(await escaped.locator('dialog').count(),0);assert.equal(await escaped.evaluate(()=>window.counts.installs),0);
  const deferred=await pageFor('idle');
  await deferred.evaluate(()=>{const dialog=document.createElement('dialog');dialog.id='existing';document.body.append(dialog);dialog.showModal();window.publish({status:'available'});});
  assert.equal(await deferred.locator('.desktop-update-dialog').count(),0);
  await deferred.evaluate(()=>document.querySelector('#existing').close());await deferred.locator('.desktop-update-dialog').waitFor();
  // Also exercise the real application bootstrap, theme and recent-release modal together.
  const data=fs.mkdtempSync(path.join(os.tmpdir(),'canvasflow-startup-update-')),origin='http://127.0.0.1:5201';
  server=spawn(path.join(root,'.runtime/python/python.exe'),['server.py','5201'],{cwd:root,env:{...process.env,CANVASFLOW_DATA_DIR:data, LOCALAPPDATA:data},windowsHide:true,stdio:'ignore'});
  for(let i=0;i<60;i++){try{if((await fetch(origin+'/local-connect')).ok)break;}catch{}if(i===59)throw Error('Isolated server did not start');await new Promise(resolve=>setTimeout(resolve,250));}
  const full=await browser.newPage({viewport:{width:1092,height:871}});
  await full.addInitScript(()=>{
    localStorage.setItem('canvasflow-startup-animation',JSON.stringify({enabled:false}));
    let listener,dismissed=false;
    const state=()=>({status:'available',currentVersion:'1.0.0',version:'1.0.0',currentBuildNumber:2026111701,buildNumber:2026111801,notificationDismissed:dismissed});
    window.CanvasFlowDesktop={getInfo:async()=>({version:'1.0.0',releaseNotesPending:true}),markReleaseNotesShown:async()=>{},onBeforeClose:()=>{},
      getUpdateState:async()=>state(),onUpdateStatus:fn=>{listener=fn;return()=>{};},dismissUpdateNotice:async()=>{dismissed=true;},
      checkForUpdates:async()=>state(),installUpdate:async()=>state()};
  });
  const errors=[];full.on('pageerror',error=>errors.push(error.message));
  await full.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await full.goto(require('./local-browser-access.cjs')(root,data,origin).link);
  await full.waitForURL(origin+'/');
  await full.locator('#startupUpdatesDialog').waitFor();
  assert.equal(await full.locator('.desktop-update-dialog').count(),0);
  await full.locator('#startupUpdatesDialog').getByRole('button',{name:'知道了',exact:true}).click();
  await full.locator('.desktop-update-dialog').waitFor();
  await full.screenshot({path:path.join(output,'startup-update-in-app.png')});
  await full.getByRole('button',{name:'稍后更新',exact:true}).click();
  await full.locator('.desktop-update-dialog').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,checks:['wait for startup and release notes','later never downloads or repeats','quiet current/offline/browser','restart notification','immediate update and progress','failure retry','background download','Escape postpones','existing dialogs are respected'],screenshots:output}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.kill();});
