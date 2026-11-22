'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const appDirectory=path.resolve(__dirname,'../tools/desktop/app');
const source=fs.readFileSync(path.join(appDirectory,'main.cjs'),'utf8');
async function harness() {
  const opened=[],downloads=[];
  let prepareHeaders;
  class Window extends EventEmitter {
    constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=fn=>{this.openWindow=fn;};this.webContents.downloadURL=url=>downloads.push(url);}
    isDestroyed(){return false;} isVisible(){return true;} setTitle(){} async loadURL(url){this.loadedURL=url;}
  }
  const electron={BrowserWindow:Window,
    app:{setName(){},setAppUserModelId(){},setPath(){},getPath:()=>'/profile',requestSingleInstanceLock:()=>false,quit(){},getVersion:()=> '1.0.0'},
    session:{defaultSession:{webRequest:{onBeforeSendHeaders(fn){prepareHeaders=fn;}},setPermissionRequestHandler(){},setPermissionCheckHandler(){},on(){}}},
    Menu:{buildFromTemplate:items=>items,setApplicationMenu(){}},
    ipcMain:{handle(){},on(){}},dialog:{showErrorBox(){}},
    shell:{openExternal:async url=>{opened.push(url);}}
  };
  const context=vm.createContext({require:name=>{
    if(name==='electron')return electron;
    if(name==='node:fs')return {existsSync:()=>false,readFileSync(){throw Error('missing fixture');}};
    if(name.startsWith('./'))return require(path.join(appDirectory,name));
    return require(name);
  },process:{execPath:'/app/CanvasFlow.exe',platform:'win32',arch:'x64'},__dirname:appDirectory,setTimeout,clearTimeout});
  vm.runInContext(source+'\nglobalThis.createTestWindow=async()=>{origin="http://127.0.0.1:5173";sessionToken="test-session";await createWindow();return mainWindow;};',context);
  const window=await context.createTestWindow();
  function navigate(eventName,url,isMainFrame,legacy=false){
    let prevented=false;
    const event={preventDefault(){prevented=true;},...(!legacy?{url,isMainFrame}:{})};
    if(legacy)window.webContents.emit(eventName,event,url,false,isMainFrame);
    else window.webContents.emit(eventName,event);
    return prevented;
  }
  return {window,opened,downloads,navigate,prepareHeaders};
}
test('workbench subresources carry the local credential only at the authenticated service origin',async()=>{
  const {prepareHeaders}=await harness();
  let previous={Range:'bytes=0-1023'};
  prepareHeaders({url:'http://127.0.0.1:5173/media/test.webm',requestHeaders:previous},({requestHeaders})=>{previous=requestHeaders;});
  assert.equal(previous['X-CanvasFlow-Session'],'test-session');
  prepareHeaders({url:'http://127.0.0.1:62042/open',requestHeaders:previous},({requestHeaders})=>{
    assert.equal(requestHeaders['X-CanvasFlow-Session'],undefined);
    assert.equal(requestHeaders.Range,'bytes=0-1023');
  });
});
test('OpenFilm iframe authentication redirects stay embedded without opening a browser',async()=>{
  for(const legacy of [false,true]){
    const h=await harness();
    const target='http://127.0.0.1:62042/projects/example?key=fixture-session-key';
    assert.equal(h.navigate('will-redirect',target,false,legacy),false);
    assert.deepEqual(h.opened,[]);
    assert.equal(h.window.options.webPreferences.sandbox,true);
    assert.equal(h.window.options.webPreferences.webSecurity,true);
    assert.equal(h.window.options.webPreferences.nodeIntegration,false);
  }
});
test('main-frame navigations and redirects still enforce the application origin',async()=>{
  for(const legacy of [false,true])for(const eventName of ['will-navigate','will-redirect']){
    const h=await harness();
    assert.equal(h.navigate(eventName,'http://127.0.0.1:5173/?project=one',true,legacy),false);
    assert.equal(h.navigate(eventName,'https://example.com/help',true,legacy),true);
    assert.deepEqual(h.opened,['https://example.com/help']);
    for(const target of ['file:///C:/Windows','javascript:alert(1)','https://user:pass@example.com/'])assert.equal(h.navigate(eventName,target,true,legacy),true);
    assert.equal(h.opened.length,1);
  }
});
test('frame redirects do not weaken popup download or external-link handling',async()=>{
  const h=await harness();
  assert.equal(h.window.openWindow({url:'http://127.0.0.1:5173/export.json'}).action,'deny');
  assert.deepEqual(h.downloads,['http://127.0.0.1:5173/export.json']);
  assert.equal(h.window.openWindow({url:'https://example.com/help'}).action,'deny');
  assert.deepEqual(h.opened,['https://example.com/help']);
});
