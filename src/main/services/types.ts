// Database row types (what comes from SQLite)
export interface DBConversation {
  id: number;
  guid: string;
  chat_identifier: string;
  display_name: string | null;
  style: number; // 45 = 1:1, 43 = group
  last_message: string | null;
  last_message_date: number; // Apple nanoseconds
  is_from_me: number;
  handle_id: string | null;
}

export interface DBMessage {
  id: number;
  guid: string;
  text: string | null;
  attributedBody: Buffer | null;
  is_from_me: number;
  date: number; // Apple nanoseconds
  cache_has_attachments: number;
  associated_message_guid: string | null;
  associated_message_type: number;
  sender_handle: string | null;
}

export interface DBAttachment {
  id: number;
  guid: string;
  filename: string | null;
  mime_type: string | null;
  uti: string | null;
  total_bytes: number;
  transfer_name: string | null;
}

export interface DBGroupParticipant {
  handle_id: string;
  service: string;
}

// Tapback (reaction) types
// 2000-2005: Added reactions
// 3000-3005: Removed reactions
export const TAPBACK_TYPES: Record<number, { emoji: string; label: string; removed: boolean }> = {
  2000: { emoji: '\u2764\uFE0F', label: 'love', removed: false },
  2001: { emoji: '\uD83D\uDC4D', label: 'like', removed: false },
  2002: { emoji: '\uD83D\uDC4E', label: 'dislike', removed: false },
  2003: { emoji: '\uD83D\uDE02', label: 'laugh', removed: false },
  2004: { emoji: '\u203C\uFE0F', label: 'emphasize', removed: false },
  2005: { emoji: '\u2753', label: 'question', removed: false },
  3000: { emoji: '\u2764\uFE0F', label: 'love', removed: true },
  3001: { emoji: '\uD83D\uDC4D', label: 'like', removed: true },
  3002: { emoji: '\uD83D\uDC4E', label: 'dislike', removed: true },
  3003: { emoji: '\uD83D\uDE02', label: 'laugh', removed: true },
  3004: { emoji: '\u203C\uFE0F', label: 'emphasize', removed: true },
  3005: { emoji: '\u2753', label: 'question', removed: true },
};

export function isTapback(type: number): boolean {
  return type >= 2000 && type <= 3005;
}
