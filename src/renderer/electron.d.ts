import type {
  IMessageConversation,
  IMessageMessage,
  GmailThread,
  GmailMessage,
  GmailAttachment,
  InstagramConversation,
  InstagramMessage,
  InstagramSendResult,
  InstagramAccountInfo,
  Tag,
  ContactIdentifier,
  ContactTagAssignment,
  DismissedThread,
  DigestCategory,
  Digest,
  PinnedChat,
  Cluster,
  PinnedDashboard,
} from './types';

export type PermissionStatus = 'authorized' | 'denied' | 'not-determined';

export interface SendResult {
  success: boolean;
  error?: string;
}

interface ElectronAPI {
  titlebarDoubleClick: () => void;
  platform: string;
  isDev: boolean;

  // Permission APIs
  checkFullDiskAccess: () => Promise<PermissionStatus>;
  requestFullDiskAccess: () => Promise<void>;

  // Contact APIs
  buildContactCache: () => Promise<boolean>;

  // iMessage APIs
  imessage: {
    getConversations: (limit?: number) => Promise<IMessageConversation[]>;
    getConversationsByIds: (ids: number[]) => Promise<IMessageConversation[]>;
    resolveCanonicalIds: (ids: number[]) => Promise<Record<number, number>>;
    getMessages: (chatId: number, limit?: number) => Promise<IMessageMessage[]>;
    isAccessible: () => Promise<boolean>;
    sendMessage: (recipient: string, message: string) => Promise<SendResult>;
    sendToGroupChat: (chatName: string, message: string) => Promise<SendResult>;
    sendToChat: (chatIdentifier: string, message: string) => Promise<SendResult>;
    sendReaction: (chatId: number, targetGuid: string, reactionType: string, remove?: boolean) => Promise<{ success: boolean; error?: string }>;
  };

  // Shell APIs for opening files
  shell: {
    openPath: (path: string) => Promise<string>;
    openExternal: (url: string) => Promise<void>;
  };

  // App settings
  settings: {
    getNotificationsEnabled: () => Promise<boolean>;
    setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  };

  // App APIs (notifications, config)
  app: {
    showNotification: (options: { title: string; body: string; subtitle?: string }) => Promise<void>;
    getUserName: () => Promise<string>;
    setUserName: (name: string) => Promise<void>;
    getOnboardingComplete: () => Promise<boolean>;
    setOnboardingComplete: (complete: boolean) => Promise<void>;
    getAppName: () => Promise<string>;
    getVersion: () => Promise<string>;
    restartApp: () => Promise<void>;
    checkForUpdates: () => Promise<void>;
    openDownloadUrl: (url: string) => Promise<void>;
    onUpdateAvailable: (callback: (info: { version: string; url: string }) => void) => () => void;
  };

  // Gmail APIs
  gmail: {
    // Auth
    authenticate: () => Promise<boolean>;
    isAuthenticated: () => Promise<boolean>;
    getUserEmail: () => Promise<string | null>;
    disconnect: () => Promise<void>;
    // Data
    getThreads: (maxResults?: number, pageToken?: string) => Promise<{ threads: GmailThread[]; nextPageToken?: string }>;
    getThread: (threadId: string) => Promise<GmailThread>;
    getAttachment: (messageId: string, attachmentId: string) => Promise<string>;  // base64
    // Send
    sendReply: (threadId: string, originalMessageId: string, to: string, subject: string, body: string, options?: { cc?: string; bcc?: string }) => Promise<GmailMessage>;
    sendReplyAll: (threadId: string, originalMessage: GmailMessage, body: string, options?: { subject?: string }) => Promise<GmailMessage>;
    forward: (originalMessage: GmailMessage, to: string, additionalBody?: string) => Promise<GmailMessage>;
    // Credentials
    setCredentials: (clientId: string, clientSecret: string) => Promise<{ success: boolean }>;
    hasCredentials: () => Promise<boolean>;
  };

  // Instagram APIs
  instagram: {
    // Auth
    authenticate: () => Promise<InstagramAccountInfo>;
    authenticateWithCredentials: (username: string, password: string) => Promise<InstagramAccountInfo>;
    completeWithTwoFactor: (username: string, password: string, code: string) => Promise<InstagramAccountInfo>;
    checkStatus: () => Promise<any>;
    isAuthenticated: () => Promise<boolean>;
    getAccountInfo: () => Promise<InstagramAccountInfo | null>;
    disconnect: () => Promise<void>;
    // Data
    getConversations: (limit?: number) => Promise<{ conversations: InstagramConversation[]; hasMore: boolean }>;
    getMessages: (conversationId: string, limit?: number) => Promise<InstagramMessage[]>;
    getThread: (threadId: string, limit?: number) => Promise<{
      participant: { id: string; username: string; fullName: string | null; profilePicUrl: string | null; followerCount: number | null };
      isGroup: boolean;
      users: Array<{ id: string; username: string; fullName: string; profilePicUrl: string | null }>;
      messages: InstagramMessage[];
    }>;
    // Send
    sendMessage: (recipientId: string, text: string) => Promise<InstagramSendResult>;
  };

  // Dashboard APIs
  dashboard: {
    get: () => Promise<PinnedDashboard>;
    save: (dashboard: PinnedDashboard) => Promise<{ success: boolean }>;
    createCluster: (cluster: Omit<Cluster, 'id'>) => Promise<Cluster>;
    updateCluster: (clusterId: string, updates: Partial<Pick<Cluster, 'name' | 'color' | 'position'>>) => Promise<Cluster | null>;
    deleteCluster: (clusterId: string) => Promise<{ success: boolean }>;
    pinChat: (pin: PinnedChat, clusterId?: string) => Promise<{ success: boolean }>;
    unpinChat: (source: string, id: string) => Promise<{ success: boolean }>;
    movePin: (source: string, id: string, targetClusterId: string | null) => Promise<{ success: boolean }>;
  };

  // Tags API
  tags: {
    getAll: () => Promise<Tag[]>;
    getCustom: () => Promise<Tag[]>;
    create: (tag: { name: string; importance: number; color: string }) => Promise<Tag>;
    update: (tagId: string, updates: { name?: string; color?: string; importance?: number }) => Promise<Tag | null>;
    delete: (tagId: string) => Promise<{ success: boolean }>;
    getAssignments: () => Promise<ContactTagAssignment[]>;
    getContactTags: (contact: ContactIdentifier) => Promise<string[]>;
    assignToContact: (contact: ContactIdentifier, tagIds: string[], displayName?: string) => Promise<{ success: boolean }>;
    onChanged: (callback: () => void) => () => void;
  };

  // Threads (dismiss/done)
  threads: {
    getDismissed: () => Promise<DismissedThread[]>;
    dismiss: (thread: DismissedThread) => Promise<void>;
    undismiss: (id: string, source: string) => Promise<void>;
  };

  // LLM Provider
  llm: {
    getProvider: () => Promise<string>;
    setProvider: (providerId: string) => Promise<{ success: boolean }>;
    getApiKey: (provider: string) => Promise<{ hasKey: boolean }>;
    setApiKey: (provider: string, key: string) => Promise<{ success: boolean }>;
    testConnection: (providerId?: string) => Promise<{ success: boolean; error?: string }>;
  };

  // Claude CLI
  claude: {
    isAvailable: () => Promise<boolean>;
    generateDraft: (
      platform: 'imessage' | 'gmail' | 'instagram',
      messages: Array<{ sender: string; text: string }>,
      context?: { contactName?: string; subject?: string }
    ) => Promise<string>;
    generateDraftStream: (
      platform: 'imessage' | 'gmail' | 'instagram',
      messages: Array<{ sender: string; text: string }>,
      context?: { contactName?: string; subject?: string }
    ) => Promise<string>;
    onDraftChunk: (callback: (chunk: string) => void) => () => void;
  };

  // Digest API
  digest: {
    generate: () => Promise<Digest>;
    getLast: () => Promise<Digest | null>;
    getCategories: () => Promise<DigestCategory[]>;
    createCategory: (category: { name: string; color: string; description?: string }) => Promise<DigestCategory>;
    updateCategory: (id: string, updates: { name?: string; color?: string; description?: string }) => Promise<DigestCategory | null>;
    deleteCategory: (id: string) => Promise<{ success: boolean }>;
    getAutoSettings: () => Promise<{ enabled: boolean; time: string; frequency: 'hourly' | 'daily' | 'weekly'; lookbackDays: number; intervalHours: number; weekday: number }>;
    setAutoSettings: (enabled: boolean, time: string, frequency: string, lookbackDays: number, intervalHours: number, weekday: number) => Promise<{ success: boolean }>;
    onAutoGenerated: (callback: () => void) => () => void;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
