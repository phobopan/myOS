/**
 * Instagram type definitions for OAuth tokens and API data structures.
 * Used by instagramAuthService and instagramService.
 */

/**
 * Token storage structure for Instagram (Facebook long-lived tokens)
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
}

/**
 * 24-hour messaging window status
 * Instagram only allows replies within 24 hours of the user's last message
 */
export interface WindowStatus {
  isOpen: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  expiresAt: Date;
  urgency: 'normal' | 'warning' | 'expired';
}

/**
 * Conversation from Instagram Graph API
 */
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
  windowStatus: WindowStatus;
}

/**
 * Individual message from Instagram Graph API
 */
export interface InstagramMessage {
  id: string;
  text: string | null;
  time: Date;
  fromUser: boolean;
  from: { id: string; username?: string; name?: string };
  attachments: InstagramAttachment[];
}

/**
 * Attachment types for Instagram messages
 */
export interface InstagramAttachment {
  type: 'image' | 'video' | 'audio' | 'share' | 'story_mention' | 'story_reply';
  url?: string;
  title?: string;
  thumbnailUrl?: string;
}

/**
 * Result from sending an Instagram message
 */
export interface InstagramSendResult {
  success: boolean;
  messageId?: string;
  recipientId?: string;
  error?: string;
  errorCode?: string;
}
