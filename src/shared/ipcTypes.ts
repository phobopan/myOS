/**
 * Shared types for IPC communication between main and renderer processes.
 * These types are used in both tsconfig.main.json and tsconfig.json.
 */

// Attachment metadata for iMessage media
export interface Attachment {
  id: string;
  filename: string | null;
  mimeType: string | null;
  path: string | null; // Full path (tilde expanded)
  size: number;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
}

// Reaction (tapback) on a message
export interface Reaction {
  emoji: string;
  label: string;
  senderName?: string;
  senderId?: string;
}

// IPC response types (what main process sends to renderer)
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

// Gmail auth types
export interface GmailAuthStatus {
  isAuthenticated: boolean;
  email?: string;
}

// Gmail data types (duplicated from gmailTypes.ts for renderer access)
// TypeScript rootDir restrictions prevent direct import across main/renderer boundary

export interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailMessage[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  date: Date;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  messageId: string;
  body: {
    html: string;
    text: string;
  };
  attachments: GmailAttachment[];
  snippet: string;
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isInline: boolean;
}

// Instagram types (duplicated from instagramTypes.ts for renderer access)
// TypeScript rootDir restrictions prevent direct import across main/renderer boundary

export interface InstagramWindowStatus {
  isOpen: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  expiresAt: Date;
  urgency: 'normal' | 'warning' | 'expired';
}

export interface InstagramConversation {
  id: string;
  recipientId: string;
  recipientUsername: string;
  recipientName: string | null;
  updatedTime: Date;
  lastMessage: {
    text: string | null;
    time: Date;
    fromUser: boolean;
  } | null;
  windowStatus: InstagramWindowStatus;
}

export interface InstagramMessage {
  id: string;
  text: string | null;
  time: Date;
  fromUser: boolean;
  from: { id: string; username?: string; name?: string };
  attachments: InstagramAttachment[];
}

export interface InstagramAttachment {
  type: 'image' | 'video' | 'audio' | 'share' | 'story_mention' | 'story_reply';
  url?: string;
  title?: string;
  thumbnailUrl?: string;
}

export interface InstagramSendResult {
  success: boolean;
  messageId?: string;
  recipientId?: string;
  error?: string;
  errorCode?: string;
}

export interface InstagramAccountInfo {
  pageId: string;
  pageName: string;
  instagramAccountId: string;
  instagramUsername: string;
  instagramName: string | null;
}
