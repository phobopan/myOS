// Existing types (extended for iMessage)
export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  isFromMe: boolean;
  senderName?: string;
  // New iMessage fields
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

// New types for iMessage attachments and reactions
export interface Attachment {
  id: string;
  filename: string | null;
  mimeType: string | null;
  path: string | null; // Full path (tilde expanded)
  size: number;
  isImage: boolean;
}

export interface Reaction {
  emoji: string;
  label: string;
  senderName?: string;
  senderId?: string;
}

// Types for IPC responses (what main process sends to renderer)
export interface IMessageConversation {
  id: number;
  guid: string;
  chatIdentifier: string;
  displayName: string | null;
  contactName: string | null; // Resolved from handle
  isGroup: boolean;
  lastMessage: string | null;
  lastMessageDate: Date;
  isFromMe: boolean;
  handleId: string | null;
  participants?: string[]; // For group chats
}

export interface IMessageMessage {
  id: number;
  guid: string;
  text: string | null;
  isFromMe: boolean;
  date: Date;
  senderHandle: string | null;
  senderName: string | null; // Resolved contact name
  attachments: Attachment[];
  reactions: Reaction[];
  isReaction: boolean; // True if this message is a tapback
}
