'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../tools/desktop/app/main.cjs'), 'utf8');

function harness(existingFiles = new Map(), version = '1.0.0', updateOptions = {}) {
  const files = existingFiles, handlers = new Map(), replies = [], errors = [];
  const updateEvents = [];
  let updateState = {status:updateOptions.status || 'idle',version:'1.0.1'};
  const updateManager = {
    getState:()=>({...updateState}),
    check:async()=>{updateEvents.push('check');updateState.status='available';},
    download:async()=>{updateEvents.push('download');updateState.status='ready';return '/profile/updates/test/CanvasFlow-Setup.exe';},
    verifyInstaller:async()=>{updateEvents.push('verify');if(updateOptions.invalidFile)throw Error('invalid installer');return '/profile/updates/test/CanvasFlow-Setup.exe';},
    cancel:async()=>{updateEvents.push('cancel');},
    installing:()=>{updateState.status='installing';},ready:()=>{updateState.status='ready';},
    fail:message=>{updateState={...updateState,status:'error',message};}
  };
  const counters = {hidden:0, shown:0, closed:0, prompts:0, saves:0};
  let failWrite = false, failTray = false, saveOK = true;
  const window = {
    isDestroyed:()=>false, isMinimized:()=>false, restore(){}, focus(){},
    show(){counters.shown++;}, hide(){counters.hidden++;}, close(){counters.closed++;updateEvents.push('close');},
    getNormalBounds:()=>({width:1440,height:940}), isMaximized:()=>false,
    webContents:{isDestroyed:()=>false, mainFrame:{url:'http://127.0.0.1:5181/'}}
  };
  const tray = {setToolTip(){}, setContextMenu(menu){this.menu=menu;},
    on(name, callback){this[name]=callback;}, isDestroyed:()=>false, destroy(){}};
  const app = {setName(){},setAppUserModelId(){},setPath(){},getPath:()=>'/profile',
    requestSingleInstanceLock:()=>false,quit(){},getVersion:()=> version,isPackaged:updateOptions.packaged===true};
  const electron = {app, BrowserWindow:function(){}, session:{}, shell:{openPath:async()=>{updateEvents.push('open-installer');return updateOptions.openError || '';}},
    Tray:function(){if(failTray) throw Error('Tray failed'); return tray;},
    Menu:{buildFromTemplate:x=>x}, ipcMain:{on:(n,f)=>handlers.set(n,f),handle:(n,f)=>handlers.set(n,f)},
    dialog:{showErrorBox:(...args)=>errors.push(args),showMessageBox:async()=>{
      counters.prompts++; return replies.shift() || {response:2,checkboxChecked:false};
    }}};
  const fakeFS = {
    existsSync:()=>false, readFileSync:file=>{if(!files.has(file))throw Error('missing');return files.get(file);},
    mkdirSync(){}, appendFileSync(){},
    writeFileSync(file, data){if(failWrite)throw Error('disk full');files.set(file,data);},
    renameSync(from,to){files.set(to,files.get(from));files.delete(from);}
  };
  const context = vm.createContext({require:name=>{
    if(name==='electron')return electron;
    if(name==='node:fs')return fakeFS;
    if(name==='./updater.cjs')return {createUpdater:()=>updateManager};
    if(name.startsWith('./'))return require(path.join(__dirname,'../tools/desktop/app',name));
    return require(name);
  },process:{execPath:'/app/CanvasFlow.exe',platform:'win32',arch:'x64'},__dirname:'/app',setTimeout,clearTimeout});
  vm.runInContext(source + `
    globalThis.control = {
      initialize(window) { mainWindow=window; origin='http://127.0.0.1:5181'; rendererReady=true; },
      requestWindowClose, prepareClose, saveCloseAction, showWindow,
      get action(){return closeAction;}, get allowed(){return allowClose;}
    };
  `,context);
  const control = context.control;
  const event = {sender:window.webContents,senderFrame:window.webContents.mainFrame};
  window.webContents.send = () => {counters.saves++;updateEvents.push('save');handlers.get('desktop:close-result')(event,{ok:saveOK});};
  control.initialize(window);
  return {control,files,replies,errors,counters,tray,handlers,event,window,updateEvents,updateManager,
    failWrite:()=>{failWrite=true;},failTray:()=>{failTray=true;},failSave:()=>{saveOK=false;}};
}

test('cancel keeps window open and does not remember a choice', async()=>{
  const h=harness(); h.replies.push({response:2,checkboxChecked:true});
  await h.control.requestWindowClose();
  assert.equal(h.control.action,'ask'); assert.equal(h.counters.hidden+h.counters.closed,0);
});
test('remember tray choice across launches and restore from tray', async()=>{
  const h=harness(); h.replies.push({response:0,checkboxChecked:true});
  await h.control.requestWindowClose();
  assert.equal(h.counters.hidden,1); assert.equal(h.counters.saves,0);
  h.tray.click(); assert.equal(h.counters.shown,1);
  const next=harness(h.files); await next.control.requestWindowClose();
  assert.equal(next.counters.prompts,0); assert.equal(next.counters.hidden,1);
});
test('remember exit choice and save before closing',async()=>{
  const h=harness(); h.replies.push({response:1,checkboxChecked:true});
  await h.control.requestWindowClose();
  assert.equal(h.counters.saves,1); assert.equal(h.counters.closed,1);
  const next=harness(h.files); await next.control.requestWindowClose();
  assert.equal(next.counters.prompts,0); assert.equal(next.counters.saves,1);
});
test('save failure can cancel an exit even when exit was remembered',async()=>{
  const h=harness(); h.control.saveCloseAction('quit'); h.failSave();
  h.replies.push({response:0}); await h.control.requestWindowClose();
  assert.equal(h.counters.closed,0); assert.equal(h.control.allowed,false);
  h.replies.push({response:1}); await h.control.requestWindowClose();
  assert.equal(h.counters.closed,1);
});
test('repeated close while choosing shows one dialog',async()=>{
  const h=harness(); h.replies.push({response:0});
  await Promise.all([h.control.requestWindowClose(),h.control.requestWindowClose()]);
  assert.equal(h.counters.prompts,1); assert.equal(h.counters.hidden,1);
});
test('tray failure never leaves an inaccessible hidden application',async()=>{
  const h=harness(); h.failTray(); h.replies.push({response:0});
  await h.control.requestWindowClose();
  assert.equal(h.counters.hidden,0); assert.equal(h.errors.length,1);
});
test('failed preference write keeps existing preference and window',async()=>{
  const h=harness(); h.failWrite(); h.replies.push({response:1,checkboxChecked:true});
  await h.control.requestWindowClose();
  assert.equal(h.control.action,'ask'); assert.equal(h.counters.closed,0);
});
test('preference IPC rejects untrusted senders and invalid choices',()=>{
  const h=harness(); const update=h.handlers.get('desktop:set-close-action');
  assert.throws(()=>update({},'quit'));
  assert.throws(()=>update(h.event,'invalid'));
  update(h.event,'tray'); assert.equal(h.control.action,'tray');
  update(h.event,'ask'); assert.equal(h.control.action,'ask');
});
test('explicit tray exit ignores remembered hide action and saves',async()=>{
  const h=harness(); h.control.saveCloseAction('tray');
  await h.control.requestWindowClose();
  h.tray.menu[2].click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.counters.saves,1); assert.equal(h.counters.closed,1);
});

test('renderer IPC failure preserves window and allows another exit attempt',async()=>{
  const h=harness(); h.control.saveCloseAction('quit');
  const original=h.window.webContents.send;
  h.window.webContents.send=()=>{throw Error('renderer gone');};
  h.replies.push({response:0}); await h.control.requestWindowClose();
  assert.equal(h.counters.closed,0);
  h.window.webContents.send=original;
  await h.control.requestWindowClose();
  assert.equal(h.counters.closed,1);
});

test('release notes are pending on first install and only once per installed version',()=>{
  const first = harness();
  const info = h => h.handlers.get('desktop:info')(h.event);
  assert.equal(info(first).releaseNotesPending, true);
  assert.equal(info(harness(first.files)).releaseNotesPending, true, 'reading must not mark notes shown');
  first.handlers.get('desktop:release-notes-shown')(first.event, '1.0.0');
  assert.equal(info(first).releaseNotesPending, false);
  const restart = harness(first.files);
  assert.equal(info(restart).releaseNotesPending, false);
  const upgrade = harness(first.files, '1.1.0');
  assert.equal(info(upgrade).releaseNotesPending, true);
  upgrade.handlers.get('desktop:release-notes-shown')(upgrade.event, '1.1.0');
  assert.equal(info(harness(first.files, '1.1.0')).releaseNotesPending, false);
});

test('release notes acknowledgement rejects foreign frames and mismatched versions',()=>{
  const h = harness(), mark = h.handlers.get('desktop:release-notes-shown');
  assert.throws(()=>mark({}, '1.0.0'));
  assert.throws(()=>mark({...h.event, senderFrame:{url:'http://127.0.0.1:5181/'}}, '1.0.0'));
  assert.throws(()=>mark(h.event, '1.1.0'));
  assert.equal(h.handlers.get('desktop:info')(h.event).releaseNotesPending, true);
});

test('failed release notes persistence keeps the notice pending on next launch',()=>{
  const h = harness(); h.failWrite();
  assert.throws(()=>h.handlers.get('desktop:release-notes-shown')(h.event, '1.0.0'));
  const restart = harness(h.files);
  assert.equal(restart.handlers.get('desktop:info')(restart.event).releaseNotesPending, true);
});

test('confirmed update saves the project and verifies installer before opening and quitting',async()=>{
  const h=harness(new Map(),'1.0.0',{packaged:true,status:'available'});
  h.replies.push({response:0});
  await h.handlers.get('desktop:install-update')(h.event);
  assert.deepEqual(h.updateEvents,['download','save','verify','open-installer','close']);
  assert.equal(h.counters.closed,1);
});
test('postponed update and cancelled failed save do not open installer or close the application',async()=>{
  for(const saveFails of [false,true]){
    const h=harness(new Map(),'1.0.0',{packaged:true,status:'available'});
    if(saveFails){h.failSave();h.replies.push({response:0},{response:0});}else h.replies.push({response:1});
    await h.handlers.get('desktop:install-update')(h.event);
    assert.equal(h.updateEvents.includes('open-installer'),false);
    assert.equal(h.counters.closed,0); assert.equal(h.updateManager.getState().status,'ready');
  }
});
test('installer verification and launch failure leave the app open and surface an error',async()=>{
  for(const options of [{invalidFile:true},{openError:'blocked by OS'}]){
    const h=harness(new Map(),'1.0.0',{packaged:true,status:'available',...options});h.replies.push({response:0});
    await h.handlers.get('desktop:install-update')(h.event);
    assert.equal(h.counters.closed,0); assert.equal(h.control.allowed,false);
    assert.equal(h.updateManager.getState().status,'error');
    if(options.invalidFile) assert.equal(h.updateEvents.includes('open-installer'),false);
  }
});
test('updater IPC rejects foreign callers and unpackaged runtimes',async()=>{
  for(const packaged of [false,true]){
    const h=harness(new Map(),'1.0.0',{packaged,status:'available'});
    await assert.rejects(h.handlers.get('desktop:install-update')({}));
    await assert.rejects(h.handlers.get('desktop:check-update')({}));
    if(!packaged) await assert.rejects(h.handlers.get('desktop:check-update')(h.event));
    assert.equal(h.updateEvents.length,0);
  }
});
