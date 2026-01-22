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
    sendMessage: (recipient: string, message: string) => ipcRenderer.invoke('imessage:sendMessage', recipient, message),
    sendToGroupChat: (chatName: string, message: string) => ipcRenderer.invoke('imessage:sendToGroupChat', chatName, message),
    sendToChat: (chatIdentifier: string, message: string) => ipcRenderer.invoke('imessage:sendToChat', chatIdentifier, message),
  },

  // Shell APIs for opening files
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },

  // Gmail APIs
  gmail: {
    authenticate: () => ipcRenderer.invoke('gmail:authenticate'),
    isAuthenticated: () => ipcRenderer.invoke('gmail:isAuthenticated'),
    getUserEmail: () => ipcRenderer.invoke('gmail:getUserEmail'),
    disconnect: () => ipcRenderer.invoke('gmail:disconnect'),
  },
});
