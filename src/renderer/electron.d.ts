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
} from './types';

export type PermissionStatus = 'authorized' | 'denied' | 'not-determined';

export interface SendResult {
  success: boolean;
  error?: string;
}

interface ElectronAPI {
  titlebarDoubleClick: () => void;
  platform: string;

  // Permission APIs
  checkFullDiskAccess: () => Promise<PermissionStatus>;
  requestFullDiskAccess: () => Promise<void>;

  // Contact APIs
  buildContactCache: () => Promise<boolean>;

  // iMessage APIs
  imessage: {
    getConversations: (limit?: number) => Promise<IMessageConversation[]>;
    getMessages: (chatId: number, limit?: number) => Promise<IMessageMessage[]>;
    isAccessible: () => Promise<boolean>;
    sendMessage: (recipient: string, message: string) => Promise<SendResult>;
    sendToGroupChat: (chatName: string, message: string) => Promise<SendResult>;
    sendToChat: (chatIdentifier: string, message: string) => Promise<SendResult>;
  };

  // Shell APIs for opening files
  shell: {
    openPath: (path: string) => Promise<string>;
  };

  // Gmail APIs
  gmail: {
    // Auth
    authenticate: () => Promise<boolean>;
    isAuthenticated: () => Promise<boolean>;
    getUserEmail: () => Promise<string | null>;
    disconnect: () => Promise<void>;
    // Data
    getThreads: (maxResults?: number) => Promise<GmailThread[]>;
    getThread: (threadId: string) => Promise<GmailThread>;
    getAttachment: (messageId: string, attachmentId: string) => Promise<string>;  // base64
    // Send
    sendReply: (threadId: string, originalMessageId: string, to: string, subject: string, body: string, options?: { cc?: string; bcc?: string }) => Promise<GmailMessage>;
    sendReplyAll: (threadId: string, originalMessage: GmailMessage, body: string, options?: { subject?: string }) => Promise<GmailMessage>;
    forward: (originalMessage: GmailMessage, to: string, additionalBody?: string) => Promise<GmailMessage>;
  };

  // Instagram APIs
  instagram: {
    // Auth
    authenticate: () => Promise<InstagramAccountInfo>;
    isAuthenticated: () => Promise<boolean>;
    getAccountInfo: () => Promise<InstagramAccountInfo | null>;
    disconnect: () => Promise<void>;
    // Data
    getConversations: (limit?: number) => Promise<InstagramConversation[]>;
    getMessages: (conversationId: string, limit?: number) => Promise<InstagramMessage[]>;
    // Send
    sendMessage: (recipientId: string, text: string) => Promise<InstagramSendResult>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
