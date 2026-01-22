import type { IMessageConversation, IMessageMessage } from './types';

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
    authenticate: () => Promise<boolean>;
    isAuthenticated: () => Promise<boolean>;
    getUserEmail: () => Promise<string | null>;
    disconnect: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
