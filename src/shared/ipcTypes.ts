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
  hasAttachments?: boolean;
  attachmentType?: string | null; // e.g. 'image/jpeg', 'video/quicktime', 'application/pdf'
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
  threadOriginatorGuid: string | null; // For inline reply threads
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
  labelIds: string[];
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isInline: boolean;
  contentId?: string;
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
  recipientProfilePic: string | null;
  recipientFollowerCount: number | null;
  updatedTime: Date;
  lastMessage: {
    text: string | null;
    time: Date;
    fromUser: boolean;
  } | null;
  windowStatus: InstagramWindowStatus;
  isGroup: boolean;
  threadTitle: string | null;
  users: Array<{
    id: string;
    username: string;
    fullName: string | null;
    profilePicUrl: string | null;
  }> | null;
}

export interface InstagramMessage {
  id: string;
  text: string | null;
  time: Date;
  fromUser: boolean;
  from: { id: string; username?: string; name?: string; profilePicUrl?: string };
  attachments: InstagramAttachment[];
  reactions?: Array<{ emoji: string; userId?: string; username?: string }>;
  itemType?: string; // 'text' | 'media' | 'reel_share' | 'like' | etc.
}

export interface InstagramAttachment {
  type: string; // 'image' | 'video' | 'audio' | 'gif' | 'link' | 'xma' | 'reel' | 'story' | etc.
  url?: string;
  title?: string;
  caption?: string;
  thumbnailUrl?: string;
  mediaType?: string; // 'shared_post' | 'reel' | 'story' | 'reel_share' | 'voice_message' | etc.
  username?: string;
  width?: number;
  height?: number;
  duration?: number;
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

// ============ Pinned Dashboard Types ============

export interface PinnedChat {
  source: 'imessage' | 'gmail' | 'instagram';
  id: string;
  position: { x: number; y: number };
  addedAt: string;
}

export interface Cluster {
  id: string;       // UUID
  name: string;     // "Work", "Family"
  color: string;    // Hex
  position: { x: number; y: number };
  pins: PinnedChat[];
}

export interface PinnedDashboard {
  clusters: Cluster[];
  unclusteredPins: PinnedChat[];
  canvasOffset: { x: number; y: number };
}

// ============ App Config Types ============

export interface AppConfig {
  userName: string;
  onboardingComplete: boolean;
  appName: string;
}

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
}

// ============ Tag System Types ============

export type TagType = 'tier' | 'custom';

export interface Tag {
  id: string;           // 't1'|'t2'|'t3'|'t4' for tiers, UUID for custom
  name: string;         // Display name
  type: TagType;
  importance: number;   // 1-10 scale (t1=10, t2=7, t3=4, t4=1)
  color: string;        // Hex color
}

export interface ContactIdentifier {
  platform: 'imessage' | 'gmail' | 'instagram';
  identifier: string;   // handleId, email, or recipientId
}

export interface ContactTagAssignment {
  contact: ContactIdentifier;
  tagIds: string[];
  displayName?: string; // Cached for display
}

export const DEFAULT_TIER_TAGS: Tag[] = [
  { id: 't1', name: 'Tier 1', type: 'tier', importance: 10, color: '#ef4444' },
  { id: 't2', name: 'Tier 2', type: 'tier', importance: 7, color: '#f97316' },
  { id: 't3', name: 'Tier 3', type: 'tier', importance: 4, color: '#eab308' },
  { id: 't4', name: 'Tier 4', type: 'tier', importance: 1, color: '#6b7280' },
];

// ============ Dismissed Thread Types ============

export interface DismissedThread {
  id: string;               // imessage id as string, gmail threadId, instagram id
  source: 'imessage' | 'gmail' | 'instagram';
  dismissedAt: string;      // ISO date
  lastActivityKey: string;  // snapshot of activity state at dismiss time
}

// ============ Digest System Types ============

export interface DigestCategory {
  id: string;
  name: string;
  color: string;
  description?: string; // Hint for Claude about what belongs here
}

export interface DigestEmailItem {
  threadId: string;        // Gmail thread ID for linking
  subject: string;
  from: string;
  snippet: string;
  date: Date;
  categoryId: string;
  note: string;            // Claude's short action/context note
  priority: number;        // 1 = highest, within category ordering
}

export interface DigestImessageItem {
  conversationId: number;    // iMessage chat ROWID for navigation
  contactName: string;       // Resolved display name
  chatIdentifier: string;    // Phone/email fallback
  isGroup: boolean;
  lastMessage: string | null;
  lastMessageDate: Date;
  note: string;              // Claude's action note
  priority: number;          // 1 = highest
}

export interface Digest {
  id: string;
  generatedAt: Date;
  emailItems: DigestEmailItem[];
  imessageItems: DigestImessageItem[];
  imessageSummary: string;
  status: 'generating' | 'complete' | 'error';
  error?: string;
}
