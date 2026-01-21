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
