// Re-export IPC types from shared
export type {
  Attachment,
  Reaction,
  IMessageConversation,
  IMessageMessage,
} from '../shared/ipcTypes';

// Renderer-specific UI types
export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  isFromMe: boolean;
  senderName?: string;
  // iMessage fields
  attachments?: Attachment[];
  reactions?: Reaction[];
}

export interface Conversation {
  id: string;
  source: 'imessage' | 'gmail' | 'instagram';
  name: string;
  preview: string;
  lastMessageTime: Date;
  waitingDays?: number;
  messages: Message[];
  // Gmail-specific
  subject?: string;
  // Instagram-specific
  username?: string;
  // iMessage-specific
  chatIdentifier?: string;
  isGroup?: boolean;
  participants?: string[];
}

// Import types for use in this file
import type { Attachment, Reaction } from '../shared/ipcTypes';
