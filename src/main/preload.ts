import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  titlebarDoubleClick: () => ipcRenderer.send('titlebar-double-click'),
  platform: process.platform,

  // Permission APIs
  checkFullDiskAccess: () => ipcRenderer.invoke('permissions:checkFDA'),
  requestFullDiskAccess: () => ipcRenderer.invoke('permissions:requestFDA'),

  // Contact APIs
  buildContactCache: () => ipcRenderer.invoke('contacts:buildCache'),

  // iMessage APIs
  imessage: {
    getConversations: (limit?: number) => ipcRenderer.invoke('imessage:getConversations', limit),
    getMessages: (chatId: number, limit?: number) => ipcRenderer.invoke('imessage:getMessages', chatId, limit),
    isAccessible: () => ipcRenderer.invoke('imessage:isAccessible'),
  },
});
