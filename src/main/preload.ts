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
    // Auth
    authenticate: () => ipcRenderer.invoke('gmail:authenticate'),
    isAuthenticated: () => ipcRenderer.invoke('gmail:isAuthenticated'),
    getUserEmail: () => ipcRenderer.invoke('gmail:getUserEmail'),
    disconnect: () => ipcRenderer.invoke('gmail:disconnect'),
    // Data
    getThreads: (maxResults?: number) => ipcRenderer.invoke('gmail:getThreads', maxResults),
    getThread: (threadId: string) => ipcRenderer.invoke('gmail:getThread', threadId),
    getAttachment: (messageId: string, attachmentId: string) => ipcRenderer.invoke('gmail:getAttachment', messageId, attachmentId),
    // Send
    sendReply: (threadId: string, originalMessageId: string, to: string, subject: string, body: string, options?: { cc?: string; bcc?: string }) =>
      ipcRenderer.invoke('gmail:sendReply', threadId, originalMessageId, to, subject, body, options),
    sendReplyAll: (threadId: string, originalMessage: any, body: string, options?: { subject?: string }) =>
      ipcRenderer.invoke('gmail:sendReplyAll', threadId, originalMessage, body, options),
    forward: (originalMessage: any, to: string, additionalBody?: string) =>
      ipcRenderer.invoke('gmail:forward', originalMessage, to, additionalBody),
  },

  // Instagram APIs
  instagram: {
    // Auth
    authenticate: () => ipcRenderer.invoke('instagram:authenticate'),
    isAuthenticated: () => ipcRenderer.invoke('instagram:isAuthenticated'),
    getAccountInfo: () => ipcRenderer.invoke('instagram:getAccountInfo'),
    disconnect: () => ipcRenderer.invoke('instagram:disconnect'),
    // Data
    getConversations: (limit?: number) => ipcRenderer.invoke('instagram:getConversations', limit),
    getMessages: (conversationId: string, limit?: number) => ipcRenderer.invoke('instagram:getMessages', conversationId, limit),
    // Send
    sendMessage: (recipientId: string, text: string) => ipcRenderer.invoke('instagram:sendMessage', recipientId, text),
  },
});
