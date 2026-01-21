import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  titlebarDoubleClick: () => ipcRenderer.send('titlebar-double-click'),
  platform: process.platform,

  // Permission APIs
  checkFullDiskAccess: () => ipcRenderer.invoke('permissions:checkFDA'),
  requestFullDiskAccess: () => ipcRenderer.invoke('permissions:requestFDA'),
});
