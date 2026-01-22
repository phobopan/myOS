/**
 * Gmail type definitions for OAuth tokens and email data structures.
 * Used by gmailAuthService and future Gmail API services.
 */

/**
 * OAuth2 tokens structure from Google
 */
export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}

/**
 * Thread summary for list view
 */
export interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailMessage[];
}

/**
 * Individual email message
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  date: Date;
  from: string; // Full "Name <email>" format
  to: string;
  cc: string; // Empty string if none
  bcc: string; // Empty string if none
  subject: string;
  messageId: string; // Message-ID header for threading
  body: {
    html: string;
    text: string;
  };
  attachments: GmailAttachment[];
  snippet: string; // Preview text
}

/**
 * Email attachment metadata
 */
export interface GmailAttachment {
  id: string; // attachmentId for fetching
  filename: string;
  mimeType: string;
  size: number;
  isInline: boolean;
}

/**
 * Options for sending replies
 */
export interface SendReplyOptions {
  cc?: string;
  bcc?: string;
  subject?: string; // For overriding reply subject
}
