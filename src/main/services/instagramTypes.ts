/**
 * Instagram type definitions for session-based auth and API data structures.
 * Used by instagramAuthService and instagramService.
 * Now using instagrapi (unofficial API) instead of Meta Graph API.
 */

/**
 * Token storage structure (kept for compatibility)
 */
export interface InstagramTokens {
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
}

/**
 * Account info returned after successful authentication
 */
export interface InstagramAccountInfo {
  pageId: string;
  pageName: string;
  instagramAccountId: string;
  instagramUsername: string;
  instagramName: string | null;
  profilePicUrl?: string | null;
}

/**
 * 24-hour messaging window status
 * Note: With unofficial API there's no 24-hour restriction,
 * but we keep this for UI display purposes
 */
export interface WindowStatus {
  isOpen: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  expiresAt: Date;
  urgency: 'normal' | 'warning' | 'expired';
}

/**
 * Conversation from Instagram DMs
 */
export interface InstagramConversation {
  id: string;
  recipientId: string;
  recipientUsername: string;
  recipientName: string | null;
  recipientProfilePic?: string | null;
  updatedTime: Date;
  lastMessage: {
    text: string | null;
    time: Date;
    fromUser: boolean;
    attachments?: InstagramAttachment[];
  } | null;
  isGroup?: boolean;
  users?: Array<{
    id: string;
    username: string;
    fullName: string;
    profilePicUrl: string | null;
  }> | null;
  windowStatus: WindowStatus;
}

/**
 * Individual message from Instagram DMs
 */
export interface InstagramMessage {
  id: string;
  text: string | null;
  time: Date;
  fromUser: boolean;
  from: {
    id: string;
    username?: string;
    name?: string;
    profilePicUrl?: string | null;
  };
  attachments: InstagramAttachment[];
  reactions?: Array<{
    emoji: string;
    userId: string;
    username?: string;
  }>;
  itemType?: string;
}

/**
 * Attachment types for Instagram messages
 * Expanded to support all media types from instagrapi
 */
export interface InstagramAttachment {
  type: 'image' | 'video' | 'audio' | 'gif' | 'link' | 'xma' | 'unknown';
  url?: string;
  thumbnailUrl?: string;
  title?: string;
  caption?: string;
  mediaType?: 'shared_post' | 'reel' | 'story' | 'reel_share' | 'voice_message' | 'gif' | 'link' | 'external';
  width?: number;
  height?: number;
  duration?: number;
  username?: string;
  summary?: string;
  imageUrl?: string;
  previewUrl?: string;
  subtitle?: string;
}

/**
 * Result from sending an Instagram message
 */
export interface InstagramSendResult {
  success: boolean;
  messageId?: string;
  recipientId?: string;
  threadId?: string;
  error?: string;
  errorCode?: string;
}
