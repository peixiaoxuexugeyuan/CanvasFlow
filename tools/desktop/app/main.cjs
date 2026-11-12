'use strict';
const {app, BrowserWindow, Menu, dialog, shell, ipcMain, session, Tray} = require('electron');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {createInterface} = require('node:readline');
const {sameOrigin, externalURL, downloadName, parseDesktopConfig} = require('./policy.cjs');
const product = require('./product.cjs');
app.setName(product.name);
app.setAppUserModelId(product.appId);
let mainWindow, host, origin = '', rendererReady = false, closing = false, allowClose = false, quitting = false;
let config = {}, closeResult = null, tray = null, choosingClose = false;
const executableDirectory = path.dirname(process.execPath);
try {
  const configFile = path.join(executableDirectory, 'desktop-config.json');
  if (fs.existsSync(configFile)) {
    config = parseDesktopConfig(fs.readFileSync(configFile, 'utf8'));
  }
} catch (error) { dialog.showErrorBox('CanvasFlow 配置错误', error.message); app.exit(1); }
const dataDirectory = path.resolve(executableDirectory, config.dataDirectory || path.join(app.getPath('appData'), 'CanvasFlow', 'data'));
const profile = path.join(app.getPath('appData'), 'CanvasFlow', 'profiles', crypto.createHash('sha256').update(dataDirectory.toLowerCase()).digest('hex').slice(0,16));
app.setPath('userData', profile);
const stateFile = path.join(profile, 'desktop-window.json');
let saved = {};
try { saved = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};

function log(message) {
  try { fs.mkdirSync(path.join(dataDirectory, 'local-logs'), {recursive:true}); fs.appendFileSync(path.join(dataDirectory, 'local-logs', 'desktop.log'), `${new Date().toISOString()} ${message}\n`); } catch {}
}
function stopHost() {
  quitting = true;
  // EOF asks the supervisor to close its Job Object. A reused external server survives.
  if (host?.stdin && !host.stdin.destroyed) host.stdin.end();
}
function validSender(event) {
  return mainWindow && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame && sameOrigin(event.senderFrame.url, origin);
}
const closePreferencesFile = path.join(profile, 'close-preferences.json');
function readCloseAction() {
  try {
    const value = JSON.parse(fs.readFileSync(closePreferencesFile, 'utf8')).action;
    return ['ask', 'tray', 'quit'].includes(value) ? value : 'ask';
  } catch { return 'ask'; }
}
let closeAction = readCloseAction();
const releaseNotesFile = path.join(profile, 'release-notes.json');
function releaseNotesPending() {
  try { return JSON.parse(fs.readFileSync(releaseNotesFile, 'utf8')).version !== app.getVersion(); }
  catch { return true; }
}
function markReleaseNotesShown(version) {
  if (version !== app.getVersion()) throw Error('版本信息不匹配');
  fs.mkdirSync(profile, {recursive:true});
  const temporary = releaseNotesFile + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify({version}), 'utf8');
  fs.renameSync(temporary, releaseNotesFile);
  return {version};
}
function saveCloseAction(action) {
  if (!['ask', 'tray', 'quit'].includes(action)) throw Error('无效的关闭方式');
  fs.mkdirSync(profile, {recursive:true});
  const temporary = closePreferencesFile + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify({action}), 'utf8');
  fs.renameSync(temporary, closePreferencesFile);
  closeAction = action;
}
ipcMain.handle('desktop:info', event => {
  if (!validSender(event)) throw Error('无效的调用来源');
  return {version:app.getVersion(), closeAction, releaseNotesPending:releaseNotesPending()};
});
ipcMain.handle('desktop:release-notes-shown', (event, version) => {
  if (!validSender(event)) throw Error('无效的调用来源');
  return markReleaseNotesShown(version);
});
ipcMain.handle('desktop:set-close-action', (event, action) => {
  if (!validSender(event)) throw Error('无效的调用来源');
  saveCloseAction(action);
  return {closeAction};
});
const updater = require('./updater.cjs').createUpdater({version:app.getVersion(), directory:path.join(profile, 'updates'),
  onChange:status => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send('desktop:update-status', status);
  }});
let installingUpdate = false;
function updateSupported() { return app.isPackaged && process.platform === 'win32' && process.arch === 'x64'; }
function requireUpdateSender(event) {
  if (!validSender(event)) throw Error('无效的调用来源');
  if (!updateSupported()) throw Error('请在 Windows 安装版中检查更新');
}
ipcMain.handle('desktop:update-state', event => {
  if (!validSender(event)) throw Error('无效的调用来源');
  return updateSupported() ? updater.getState() : {status:'unsupported', message:'请在 Windows 安装版中检查更新'};
});
ipcMain.handle('desktop:check-update', async event => {
  requireUpdateSender(event);
  if (!installingUpdate) await updater.check();
  return updater.getState();
});
ipcMain.handle('desktop:install-update', async event => {
  requireUpdateSender(event);
  if (installingUpdate || !['available', 'ready'].includes(updater.getState().status)) return updater.getState();
  installingUpdate = true;
  try {
    const file = await updater.download();
    if (!file || !mainWindow || mainWindow.isDestroyed()) return updater.getState();
    const choice = await dialog.showMessageBox(mainWindow, {type:'info', title:'安装 CanvasFlow 更新',
      message:`新版本 v${updater.getState().version} 已下载完成`,
      detail:'立即安装会先保存项目并退出 CanvasFlow，然后打开安装向导。安装后重新打开应用即可使用新版本。',
      buttons:['立即安装', '稍后'], defaultId:0, cancelId:1, noLink:true});
    if (choice.response !== 0) return updater.getState();
    const closed = await prepareClose(async () => {
      try {
        const verifiedFile = await updater.verifyInstaller();
        updater.installing();
        const error = await shell.openPath(verifiedFile);
        if (error) throw Error('无法打开更新安装程序：' + error);
      } catch (error) {updater.fail(error.message); throw error;}
    });
    if (!closed && updater.getState().status !== 'error') updater.ready();
  } catch (error) { updater.fail(error.message); }
  finally { installingUpdate = false; }
  return updater.getState();
});
function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.ico'));
  tray.setToolTip('CanvasFlow');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'打开 CanvasFlow', click:showWindow},
    {type:'separator'},
    {label:'退出 CanvasFlow', click:() => {showWindow(); void prepareClose();}}
  ]));
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}
async function requestWindowClose() {
  if (choosingClose || closing) return;
  choosingClose = true;
  try {
    let action = closeAction;
    if (action === 'ask') {
      const choice = await dialog.showMessageBox(mainWindow, {
        type:'question', title:'关闭 CanvasFlow', message:'关闭窗口后如何处理？',
        detail:'收起到系统托盘后，应用和正在进行的任务将继续运行。直接退出会关闭应用。',
        buttons:['收起到系统托盘', '直接退出', '取消'], defaultId:0, cancelId:2,
        checkboxLabel:'不再提醒，记住本次选择', checkboxChecked:false, noLink:true
      });
      if (choice.response === 2) return;
      action = choice.response === 0 ? 'tray' : 'quit';
      if (choice.checkboxChecked) saveCloseAction(action);
    }
    if (action === 'tray') {
      if (!tray || tray.isDestroyed()) createTray();
      mainWindow.hide();
    } else {
      await prepareClose();
    }
  } catch (error) {
    log('Close window failed: ' + error.message);
    showWindow();
    dialog.showErrorBox('无法关闭窗口', '操作未完成，请重试。' + error.message);
  } finally {
    choosingClose = false;
  }
}

ipcMain.on('desktop:ready', event => { if (validSender(event)) rendererReady = true; });
ipcMain.on('desktop:close-result', (event, payload) => { if (validSender(event) && typeof payload?.ok === 'boolean') closeResult?.(payload.ok); });

function startHost() {
  return new Promise((resolve, reject) => {
    const backend = path.resolve(executableDirectory, config.backendDirectory || path.join(process.resourcesPath, 'backend'));
    const python = path.join(process.resourcesPath, 'python', 'python.exe');
    const native = path.join(backend, 'CanvasFlowBackend.exe');
    const compiled = fs.existsSync(native);
    if (!compiled && (!fs.existsSync(python) || !fs.existsSync(path.join(backend, 'desktop_host.py')))) return reject(Error('桌面运行文件缺失，请解压完整应用目录，不能单独移动 CanvasFlow.exe。'));
    const port = Number.isInteger(config.port) && config.port > 0 && config.port < 65536 ? config.port : 5173;
    const args = ['--root', backend, '--data', dataDirectory, '--port', String(port)];
    host = spawn(compiled ? native : python, compiled ? ['host', ...args] : ['-u', path.join(backend, 'desktop_host.py'), ...args], {
      cwd:backend, windowsHide:true, stdio:['pipe','pipe','pipe'],
      env:{...process.env, PYTHONIOENCODING:'utf-8'}
    });
    let ready = false;
    const timer = setTimeout(() => reject(Error('本地服务启动超时，请查看数据目录的 local-logs。')), 60000);
    const lines = createInterface({input:host.stdout});
    lines.on('line', line => {
      let value; try { value = JSON.parse(line); } catch { return; }
      if (value.event === 'ready') {
        let url; try { url = new URL(value.url); } catch { return; }
        if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return;
        ready = true; clearTimeout(timer); log(`Service ready (${value.reused ? 'reused' : 'owned'}), ${url.origin}`); resolve(url.origin);
      } else if (value.event === 'error') { clearTimeout(timer); reject(Error(value.message)); log(value.message); }
    });
    host.stderr.on('data', chunk => log(chunk.toString('utf8').slice(0,8000)));
    host.once('error', error => {clearTimeout(timer); reject(error);});
    host.once('exit', code => {
      clearTimeout(timer);
      if (!ready) reject(Error(`本地服务启动失败（${code}），请查看 local-logs。`));
      else if (!quitting) {
        allowClose = true;
        dialog.showErrorBox('CanvasFlow 本地服务已停止', '请关闭并重新打开 CanvasFlow。项目和素材保存在本机数据目录。');
        app.quit();
      }
    });
  });
}

async function prepareClose(beforeClose) {
  if (closing) return false;
  closing = true;
  try {
    let ok = true;
    if (rendererReady && !mainWindow.webContents.isDestroyed()) {
      ok = await new Promise(resolve => {
        const timer = setTimeout(() => {closeResult = null; resolve(false);}, 10000);
        closeResult = result => {clearTimeout(timer); closeResult = null; resolve(result);};
        try { mainWindow.webContents.send('desktop:prepare-close'); }
        catch { closeResult(false); }
      });
    }
    if (!ok) {
      const choice = await dialog.showMessageBox(mainWindow, {type:'warning', title:'项目尚未保存完成',
        message:'项目尚未保存到文件，是否仍要退出？', detail:'返回工作台可以重试保存。当前浏览器缓存可能保留编辑内容，但不能替代项目文件。',
        buttons:['返回工作台','仍然退出'], defaultId:0, cancelId:0, noLink:true});
      if (choice.response !== 1) {closing = false; return false;}
    }
    log('Window close: final save ' + (ok ? 'confirmed' : 'explicitly skipped'));
    try {
      fs.mkdirSync(profile, {recursive:true});
      fs.writeFileSync(stateFile, JSON.stringify({bounds:mainWindow.getNormalBounds(), maximized:mainWindow.isMaximized()}));
    } catch {}
    if (beforeClose) await beforeClose();
    else await updater.cancel();
    allowClose = true;
    mainWindow.close();
    return true;
  } catch (error) {
    log('Exit failed: ' + error.message);
    showWindow();
    dialog.showErrorBox('退出未完成', '请返回工作台保存项目后重试。');
    return false;
  } finally {
    if (!allowClose) closing = false;
  }
}

function openExternal(value) { const target = externalURL(value); if (target) void shell.openExternal(target).catch(error => log(error.message)); }
function configureSession() {
  const allowed = permission => ['clipboard-sanitized-write', 'fullscreen'].includes(permission);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(contents === mainWindow?.webContents && sameOrigin(details.requestingUrl || contents.getURL(), origin) && allowed(permission));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => contents === mainWindow?.webContents && sameOrigin(requestingOrigin, origin) && allowed(permission));
  session.defaultSession.on('will-download', (_event, item) => item.setSaveDialogOptions({title:'保存 CanvasFlow 文件', defaultPath:path.join(app.getPath('downloads'), downloadName(item.getFilename()))}));
}

async function createWindow() {
  const bounds = saved.bounds || {};
  mainWindow = new BrowserWindow({title:'CanvasFlow', width:Math.max(1000, Math.min(Number(bounds.width) || 1440, 3840)),
    height:Math.max(700, Math.min(Number(bounds.height) || 940, 2160)), minWidth:1000, minHeight:700,
    show:true, backgroundColor:'#111111', autoHideMenuBar:true, icon:path.join(__dirname, 'icon.png'),
    webPreferences:{preload:path.join(__dirname, 'preload.cjs'), nodeIntegration:false, contextIsolation:true, sandbox:true,
      webSecurity:true, allowRunningInsecureContent:false, webviewTag:false, spellcheck:false, navigateOnDragDrop:false, backgroundThrottling:false}
  });
  if (saved.maximized) mainWindow.maximize();
  configureSession();
  mainWindow.on('page-title-updated', event => {event.preventDefault(); mainWindow.setTitle('CanvasFlow');});
  mainWindow.on('close', event => {if (!allowClose) {event.preventDefault(); void requestWindowClose();}});
  mainWindow.webContents.on('did-start-navigation', (_event, _url, inPlace, isMainFrame) => {if (isMainFrame && !inPlace) rendererReady = false;});
  for (const eventName of ['will-navigate','will-redirect']) mainWindow.webContents.on(eventName, (event, url) => {
    if (!sameOrigin(url, origin)) {event.preventDefault(); openExternal(url);}
  });
  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (sameOrigin(url, origin) || url.startsWith('blob:' + origin + '/')) mainWindow.webContents.downloadURL(url);
    else openExternal(url);
    return {action:'deny'};
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {rendererReady = false; log('Renderer exited: ' + details.reason);});
  mainWindow.webContents.on('console-message', details => {if (details.level === 'error') log('Renderer: ' + details.message);});
  const showMainWindow = () => {
    if (mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    if (saved.maximized) mainWindow.maximize();
    mainWindow.show();
  };
  mainWindow.once('ready-to-show', showMainWindow);
  // Some Windows/GPU configurations do not emit ready-to-show for a hidden window.
  // DOM readiness also provides a reliable path to the application's loading screen.
  mainWindow.webContents.once('dom-ready', showMainWindow);
  const menu = Menu.buildFromTemplate([
    {label:'CanvasFlow', submenu:[{label:'打开数据文件夹', click:() => {void shell.openPath(dataDirectory);}},
      {label:'打开日志文件夹', click:() => {void shell.openPath(path.join(dataDirectory,'local-logs'));}}, {type:'separator'},
      {label:'退出', accelerator:'Alt+F4', click:() => {showWindow(); void prepareClose();}}]},
    {label:'编辑', submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'窗口', submenu:[{role:'togglefullscreen'},{role:'minimize'},{role:'zoom'}]},
    {label:'帮助', submenu:[{label:'关于 CanvasFlow', click:() => dialog.showMessageBox(mainWindow, {title:'CanvasFlow', message:'CanvasFlow', detail:'本地项目 · 无限画布 · Blender 建模\n版本 ' + app.getVersion()})}]}
  ]);
  Menu.setApplicationMenu(menu);
  // Every launch starts a fresh in-memory canvas; saved projects are opened explicitly.
  await mainWindow.loadURL(origin + '/');
  showMainWindow();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {if (mainWindow) {if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus();}});
  app.on('before-quit', event => {if (mainWindow && !mainWindow.isDestroyed() && !allowClose) {event.preventDefault(); showWindow(); void prepareClose();}});
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => {tray?.destroy(); stopHost();});
  app.whenReady().then(async () => {
    try {
      origin = await startHost(); await createWindow();
      try { createTray(); } catch (error) { log('Tray unavailable: ' + error.message); }
      // Optional build acceptance run: exercise the actual preload/IPC/close path.
      if (process.argv.includes('--desktop-self-test')) {
        for (let attempt=0; attempt<40 && !rendererReady; attempt++) await new Promise(resolve => setTimeout(resolve,250));
        if (!rendererReady) throw Error('Desktop self-test: renderer bridge did not become ready');
        log('Desktop self-test: renderer bridge ready');
        await new Promise(resolve => setTimeout(resolve,1000));
        await prepareClose();
      }
    }
    catch (error) {log(error.stack || error.message); allowClose = true; dialog.showErrorBox('CanvasFlow 启动失败', error.message); stopHost(); app.quit();}
  });
}
