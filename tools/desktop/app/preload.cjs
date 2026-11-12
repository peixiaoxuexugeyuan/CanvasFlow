'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('CanvasFlowDesktop', Object.freeze({
  getInfo: () => ipcRenderer.invoke('desktop:info'),
  markReleaseNotesShown: version => ipcRenderer.invoke('desktop:release-notes-shown', version),
  getUpdateState: () => ipcRenderer.invoke('desktop:update-state'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-update'),
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  onUpdateStatus(handler) {
    if (typeof handler !== 'function') return () => {};
    const listener = (_event, status) => handler(status);
    ipcRenderer.on('desktop:update-status', listener);
    return () => ipcRenderer.removeListener('desktop:update-status', listener);
  },
  setCloseAction: action => ipcRenderer.invoke('desktop:set-close-action', action),
  onBeforeClose(handler) {
    if (typeof handler !== 'function') return;
    ipcRenderer.removeAllListeners('desktop:prepare-close');
    ipcRenderer.on('desktop:prepare-close', async () => {
      try { ipcRenderer.send('desktop:close-result', {ok: await handler() !== false}); }
      catch { ipcRenderer.send('desktop:close-result', {ok:false}); }
    });
    ipcRenderer.send('desktop:ready');
  }
}));
