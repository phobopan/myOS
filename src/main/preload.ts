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
    getConversationsByIds: (ids: number[]) => ipcRenderer.invoke('imessage:getConversationsByIds', ids),
    resolveCanonicalIds: (ids: number[]) => ipcRenderer.invoke('imessage:resolveCanonicalIds', ids),
    getMessages: (chatId: number, limit?: number) => ipcRenderer.invoke('imessage:getMessages', chatId, limit),
    isAccessible: () => ipcRenderer.invoke('imessage:isAccessible'),
    sendMessage: (recipient: string, message: string) => ipcRenderer.invoke('imessage:sendMessage', recipient, message),
    sendToGroupChat: (chatName: string, message: string) => ipcRenderer.invoke('imessage:sendToGroupChat', chatName, message),
    sendToChat: (chatIdentifier: string, message: string) => ipcRenderer.invoke('imessage:sendToChat', chatIdentifier, message),
    sendReaction: (chatId: number, targetGuid: string, reactionType: string, remove?: boolean) => ipcRenderer.invoke('imessage:sendReaction', chatId, targetGuid, reactionType, remove),
  },

  // Shell APIs for opening files and URLs
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // Gmail APIs
  gmail: {
    // Auth
    authenticate: () => ipcRenderer.invoke('gmail:authenticate'),
    isAuthenticated: () => ipcRenderer.invoke('gmail:isAuthenticated'),
    getUserEmail: () => ipcRenderer.invoke('gmail:getUserEmail'),
    disconnect: () => ipcRenderer.invoke('gmail:disconnect'),
    // Data
    getThreads: (maxResults?: number, pageToken?: string) => ipcRenderer.invoke('gmail:getThreads', maxResults, pageToken),
    getThread: (threadId: string) => ipcRenderer.invoke('gmail:getThread', threadId),
    getAttachment: (messageId: string, attachmentId: string) => ipcRenderer.invoke('gmail:getAttachment', messageId, attachmentId),
    // Send
    sendReply: (threadId: string, originalMessageId: string, to: string, subject: string, body: string, options?: { cc?: string; bcc?: string }) =>
      ipcRenderer.invoke('gmail:sendReply', threadId, originalMessageId, to, subject, body, options),
    sendReplyAll: (threadId: string, originalMessage: any, body: string, options?: { subject?: string }) =>
      ipcRenderer.invoke('gmail:sendReplyAll', threadId, originalMessage, body, options),
    forward: (originalMessage: any, to: string, additionalBody?: string) =>
      ipcRenderer.invoke('gmail:forward', originalMessage, to, additionalBody),
    // Credentials
    setCredentials: (clientId: string, clientSecret: string) =>
      ipcRenderer.invoke('gmail:setCredentials', clientId, clientSecret),
    hasCredentials: () => ipcRenderer.invoke('gmail:hasCredentials'),
  },

  // Instagram APIs (using instagrapi)
  instagram: {
    // Auth - uses username/password for longer-lasting sessions
    authenticateWithCredentials: (username: string, password: string) => ipcRenderer.invoke('instagram:authenticateWithCredentials', username, password),
    completeWithTwoFactor: (username: string, password: string, code: string) => ipcRenderer.invoke('instagram:completeWithTwoFactor', username, password, code),
    checkStatus: () => ipcRenderer.invoke('instagram:checkStatus'),
    isAuthenticated: () => ipcRenderer.invoke('instagram:isAuthenticated'),
    getAccountInfo: () => ipcRenderer.invoke('instagram:getAccountInfo'),
    disconnect: () => ipcRenderer.invoke('instagram:disconnect'),
    // Data
    getConversations: (limit?: number) => ipcRenderer.invoke('instagram:getConversations', limit),
    getMessages: (threadId: string, limit?: number) => ipcRenderer.invoke('instagram:getMessages', threadId, limit),
    getThread: (threadId: string, limit?: number) => ipcRenderer.invoke('instagram:getThread', threadId, limit),
    getBrief: () => ipcRenderer.invoke('instagram:getBrief'),
    // Send text
    sendMessage: (threadId: string, text: string) => ipcRenderer.invoke('instagram:sendMessage', threadId, text),
    sendMessageToUser: (username: string, text: string) => ipcRenderer.invoke('instagram:sendMessageToUser', username, text),
    // Send media
    sendPhoto: (threadId: string, filePath: string) => ipcRenderer.invoke('instagram:sendPhoto', threadId, filePath),
    sendVideo: (threadId: string, filePath: string) => ipcRenderer.invoke('instagram:sendVideo', threadId, filePath),
    sendFile: (threadId: string, filePath: string) => ipcRenderer.invoke('instagram:sendFile', threadId, filePath),
    // Reactions
    likeMessage: (threadId: string, messageId: string) => ipcRenderer.invoke('instagram:likeMessage', threadId, messageId),
    unlikeMessage: (threadId: string, messageId: string) => ipcRenderer.invoke('instagram:unlikeMessage', threadId, messageId),
  },

  // Dashboard APIs
  dashboard: {
    get: () => ipcRenderer.invoke('dashboard:get'),
    save: (dashboard: any) => ipcRenderer.invoke('dashboard:save', dashboard),
    createCluster: (cluster: any) => ipcRenderer.invoke('dashboard:createCluster', cluster),
    updateCluster: (clusterId: string, updates: any) => ipcRenderer.invoke('dashboard:updateCluster', clusterId, updates),
    deleteCluster: (clusterId: string) => ipcRenderer.invoke('dashboard:deleteCluster', clusterId),
    pinChat: (pin: any, clusterId?: string) => ipcRenderer.invoke('dashboard:pinChat', pin, clusterId),
    unpinChat: (source: string, id: string) => ipcRenderer.invoke('dashboard:unpinChat', source, id),
    movePin: (source: string, id: string, targetClusterId: string | null) => ipcRenderer.invoke('dashboard:movePin', source, id, targetClusterId),
  },

  isDev: process.env.NODE_ENV === 'development',

  // App settings
  settings: {
    getNotificationsEnabled: () => ipcRenderer.invoke('settings:getNotificationsEnabled'),
    setNotificationsEnabled: (enabled: boolean) => ipcRenderer.invoke('settings:setNotificationsEnabled', enabled),
  },

  // App APIs (notifications, config)
  app: {
    showNotification: (options: { title: string; body: string; subtitle?: string }) =>
      ipcRenderer.invoke('app:showNotification', options),
    getUserName: () => ipcRenderer.invoke('app:getUserName'),
    setUserName: (name: string) => ipcRenderer.invoke('app:setUserName', name),
    getOnboardingComplete: () => ipcRenderer.invoke('app:getOnboardingComplete'),
    setOnboardingComplete: (complete: boolean) => ipcRenderer.invoke('app:setOnboardingComplete', complete),
    getAppName: () => ipcRenderer.invoke('app:getAppName'),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    restartApp: () => ipcRenderer.invoke('app:restartApp'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    installUpdate: (url: string) => ipcRenderer.invoke('app:installUpdate', url),
    onUpdateAvailable: (callback: (info: { version: string; url: string }) => void) => {
      const handler = (_: unknown, info: { version: string; url: string }) => callback(info);
      ipcRenderer.on('update-available', handler);
      return () => { ipcRenderer.removeListener('update-available', handler); };
    },
    onUpdateProgress: (callback: (progress: any) => void) => {
      const handler = (_: unknown, progress: any) => callback(progress);
      ipcRenderer.on('update-progress', handler);
      return () => { ipcRenderer.removeListener('update-progress', handler); };
    },
  },

  // Tags API
  tags: {
    getAll: () => ipcRenderer.invoke('tags:getAll'),
    getCustom: () => ipcRenderer.invoke('tags:getCustom'),
    create: (tag: { name: string; importance: number; color: string }) => ipcRenderer.invoke('tags:create', tag),
    update: (tagId: string, updates: { name?: string; color?: string; importance?: number }) =>
      ipcRenderer.invoke('tags:update', tagId, updates),
    delete: (tagId: string) => ipcRenderer.invoke('tags:delete', tagId),
    getAssignments: () => ipcRenderer.invoke('tags:getAssignments'),
    getContactTags: (contact: { platform: string; identifier: string }) =>
      ipcRenderer.invoke('tags:getContactTags', contact),
    assignToContact: (contact: { platform: string; identifier: string }, tagIds: string[], displayName?: string) =>
      ipcRenderer.invoke('tags:assignToContact', contact, tagIds, displayName),
    onChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('tags:changed', handler);
      return () => { ipcRenderer.removeListener('tags:changed', handler); };
    },
  },

  // Threads (dismiss/done)
  threads: {
    getDismissed: () => ipcRenderer.invoke('threads:getDismissed'),
    dismiss: (thread: { id: string; source: string; dismissedAt: string; lastActivityKey: string }) =>
      ipcRenderer.invoke('threads:dismiss', thread),
    undismiss: (id: string, source: string) => ipcRenderer.invoke('threads:undismiss', id, source),
  },

  // LLM Provider
  llm: {
    getProvider: () => ipcRenderer.invoke('llm:getProvider'),
    setProvider: (providerId: string) => ipcRenderer.invoke('llm:setProvider', providerId),
    getApiKey: (provider: string) => ipcRenderer.invoke('llm:getApiKey', provider),
    setApiKey: (provider: string, key: string) => ipcRenderer.invoke('llm:setApiKey', provider, key),
    testConnection: (providerId?: string) => ipcRenderer.invoke('llm:testConnection', providerId),
  },

  // Claude CLI
  claude: {
    isAvailable: () => ipcRenderer.invoke('claude:isAvailable'),
    generateDraft: (
      platform: 'imessage' | 'gmail' | 'instagram',
      messages: Array<{ sender: string; text: string }>,
      context?: { contactName?: string; subject?: string }
    ) => ipcRenderer.invoke('claude:generateDraft', platform, messages, context),
    generateDraftStream: (
      platform: 'imessage' | 'gmail' | 'instagram',
      messages: Array<{ sender: string; text: string }>,
      context?: { contactName?: string; subject?: string }
    ) => ipcRenderer.invoke('claude:generateDraftStream', platform, messages, context),
    onDraftChunk: (callback: (chunk: string) => void) => {
      const handler = (_: unknown, chunk: string) => callback(chunk);
      ipcRenderer.on('claude:draft-chunk', handler);
      return () => { ipcRenderer.removeListener('claude:draft-chunk', handler); };
    },
  },

  // Digest API
  digest: {
    generate: () => ipcRenderer.invoke('digest:generate'),
    getLast: () => ipcRenderer.invoke('digest:getLast'),
    getCategories: () => ipcRenderer.invoke('digest:getCategories'),
    createCategory: (category: { name: string; color: string; description?: string }) =>
      ipcRenderer.invoke('digest:createCategory', category),
    updateCategory: (id: string, updates: { name?: string; color?: string; description?: string }) =>
      ipcRenderer.invoke('digest:updateCategory', id, updates),
    deleteCategory: (id: string) => ipcRenderer.invoke('digest:deleteCategory', id),
    getAutoSettings: () => ipcRenderer.invoke('digest:getAutoSettings'),
    setAutoSettings: (enabled: boolean, time: string, frequency: string, lookbackDays: number, intervalHours: number, weekday: number) => ipcRenderer.invoke('digest:setAutoSettings', enabled, time, frequency, lookbackDays, intervalHours, weekday),
    onAutoGenerated: (callback: () => void) => {
      ipcRenderer.on('digest:auto-generated', callback);
      return () => ipcRenderer.removeListener('digest:auto-generated', callback);
    },
  },
});
