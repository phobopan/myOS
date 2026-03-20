import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import { DBConversation, DBMessage, DBAttachment, DBGroupParticipant } from './types';

// Apple's Cocoa epoch: seconds from Unix epoch to 2001-01-01 00:00:00 UTC
const APPLE_EPOCH = 978307200;

/**
 * Convert Apple nanoseconds timestamp to JavaScript Date
 * chat.db stores dates as nanoseconds since 2001-01-01
 */
export function fromAppleTime(appleNanoseconds: number): Date {
  const unixSeconds = (appleNanoseconds / 1_000_000_000) + APPLE_EPOCH;
  return new Date(unixSeconds * 1000);
}

/**
 * Convert JavaScript Date to Apple nanoseconds
 * Useful for filtering queries by date
 */
export function toAppleTime(date: Date): number {
  const unixSeconds = date.getTime() / 1000;
  return (unixSeconds - APPLE_EPOCH) * 1_000_000_000;
}

/**
 * Parse attributedBody blob to extract message text.
 *
 * attributedBody uses Apple's typedstream format (NOT standard bplist).
 * The structure is:
 *   [header...] NSString [5-byte preamble] [length field] [UTF-8 text]
 *
 * Length field encoding:
 *   - If first byte != 0x81: single byte is the length (max 127)
 *   - If first byte == 0x81: next 2 bytes are little-endian length (max 65535)
 */
export function parseAttributedBody(buffer: Buffer | null): string | null {
  if (!buffer || buffer.length === 0) return null;

  try {
    // Find the NSString marker
    const marker = Buffer.from('NSString');
    const markerIndex = buffer.indexOf(marker);
    if (markerIndex === -1) return null;

    // Skip marker (8 bytes) + 5-byte preamble (0x01 0x94 0x84 0x01 0x2B or similar)
    const contentStart = markerIndex + marker.length + 5;
    if (contentStart >= buffer.length) return null;

    let length: number;
    let textStart: number;

    // Check length encoding
    if (buffer[contentStart] === 0x81) {
      // 3-byte length: 0x81 followed by 2 bytes little-endian
      if (contentStart + 3 > buffer.length) return null;
      length = buffer.readUInt16LE(contentStart + 1);
      textStart = contentStart + 3;
    } else {
      // 1-byte length
      length = buffer[contentStart];
      textStart = contentStart + 1;
    }

    // Validate bounds
    if (length <= 0 || textStart + length > buffer.length) return null;

    // Extract and decode UTF-8 text
    const text = buffer.subarray(textStart, textStart + length).toString('utf-8');

    // Return trimmed text (but preserve the actual content)
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * SQL expression that produces a dedup key for a chat row.
 * - Named group chats (style=43 with a display_name): dedup by display_name
 *   so iMessage and SMS versions of the same group merge into one.
 * - Everything else: dedup by chat_identifier (handles iMessage/SMS 1:1 dupes).
 */
const DEDUP_KEY = `CASE WHEN c.style = 43 AND c.display_name IS NOT NULL AND c.display_name != '' THEN 'group:' || c.display_name ELSE c.chat_identifier END`;

/**
 * SQL subquery that finds all sibling chat ROWIDs for a given chat ROWID.
 * Siblings are chats that would merge under the same dedup key (e.g. the
 * iMessage and SMS versions of the same group chat, or iMessage/SMS rows
 * for the same phone number).
 */
function siblingChatsSql(chatIdParam = '?'): string {
  return `
    SELECT c2.ROWID FROM chat c2
    WHERE (${DEDUP_KEY.replace(/\bc\./g, 'c2.')}) = (
      SELECT ${DEDUP_KEY.replace(/\bc\./g, 'c3.')} FROM chat c3 WHERE c3.ROWID = ${chatIdParam}
    )
  `;
}

class IMessageService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    const home = app.getPath('home');
    this.dbPath = path.join(home, 'Library', 'Messages', 'chat.db');
  }

  /**
   * Get or initialize the database connection
   * Opens in readonly mode for safety
   * Reopens on each call to ensure we see latest WAL changes from Messages.app
   */
  private getDb(): Database.Database {
    if (this.db) {
      try { this.db.close(); } catch { /* ignore */ }
    }
    this.db = new Database(this.dbPath, { readonly: true });
    return this.db;
  }

  /**
   * Close the database connection
   * Should be called when app is quitting
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get conversations awaiting reply (where last message is not from me)
   * Returns chats with their last message for preview
   */
  getConversations(limit = 50): DBConversation[] {
    const db = this.getDb();
    // Deduplicate chats so each unique conversation appears once:
    // - 1:1 chats: dedup by chat_identifier (merges iMessage + SMS for same number)
    // - Named group chats: dedup by display_name (merges iMessage + SMS group siblings)
    // Keeps the row with the most recent message in each group.
    const stmt = db.prepare(`
      SELECT * FROM (
        SELECT
          c.ROWID as id,
          c.guid,
          c.chat_identifier,
          c.display_name,
          c.style,
          m.text as last_message,
          m.attributedBody as last_message_attributed_body,
          m.is_from_me,
          m.date as last_message_date,
          h.id as handle_id,
          m.cache_has_attachments,
          (SELECT a.mime_type FROM attachment a
           JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
           WHERE maj.message_id = m.ROWID
           LIMIT 1) as attachment_mime_type,
          ROW_NUMBER() OVER (
            PARTITION BY ${DEDUP_KEY}
            ORDER BY m.date DESC
          ) as rn
        FROM chat c
        LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
        LEFT JOIN message m ON cmj.message_id = m.ROWID
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        WHERE m.ROWID = (
          SELECT m2.ROWID
          FROM message m2
          JOIN chat_message_join cmj2 ON m2.ROWID = cmj2.message_id
          WHERE cmj2.chat_id = c.ROWID
            AND (m2.associated_message_type IS NULL OR m2.associated_message_type = 0)
          ORDER BY m2.date DESC
          LIMIT 1
        )
      )
      WHERE rn = 1
      ORDER BY last_message_date DESC
      LIMIT ?
    `);
    return stmt.all(limit) as DBConversation[];
  }

  /**
   * Get specific conversations by their ROWIDs (no is_from_me filter)
   * Used to load pinned conversations that may not appear in the recent list.
   * Expands each ROWID to its dedup key, finds ALL sibling chat rows, then
   * deduplicates keeping the one with the most recent message.
   */
  getConversationsByIds(ids: number[]): DBConversation[] {
    if (ids.length === 0) return [];
    const db = this.getDb();
    const placeholders = ids.map(() => '?').join(',');
    // Resolve each requested ROWID to its dedup key, find all sibling chats,
    // then return only the freshest per dedup key.
    const stmt = db.prepare(`
      SELECT * FROM (
        SELECT
          c.ROWID as id,
          c.guid,
          c.chat_identifier,
          c.display_name,
          c.style,
          m.text as last_message,
          m.attributedBody as last_message_attributed_body,
          m.is_from_me,
          m.date as last_message_date,
          h.id as handle_id,
          m.cache_has_attachments,
          (SELECT a.mime_type FROM attachment a
           JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
           WHERE maj.message_id = m.ROWID
           LIMIT 1) as attachment_mime_type,
          ROW_NUMBER() OVER (
            PARTITION BY ${DEDUP_KEY}
            ORDER BY m.date DESC
          ) as rn
        FROM chat c
        LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
        LEFT JOIN message m ON cmj.message_id = m.ROWID
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        WHERE (${DEDUP_KEY}) IN (
          SELECT ${DEDUP_KEY.replace(/\bc\./g, 'c0.')} FROM chat c0 WHERE c0.ROWID IN (${placeholders})
        )
        AND m.ROWID = (
          SELECT m2.ROWID
          FROM message m2
          JOIN chat_message_join cmj2 ON m2.ROWID = cmj2.message_id
          WHERE cmj2.chat_id = c.ROWID
            AND (m2.associated_message_type IS NULL OR m2.associated_message_type = 0)
          ORDER BY m2.date DESC
          LIMIT 1
        )
      )
      WHERE rn = 1
      ORDER BY last_message_date DESC
    `);
    return stmt.all(...ids) as DBConversation[];
  }

  /**
   * Resolve ROWIDs to their canonical (freshest) ROWID per dedup key.
   * Returns a map of requested ROWID → canonical ROWID (only includes entries
   * where the canonical differs from the requested).
   */
  resolveCanonicalIds(ids: number[]): Map<number, number> {
    const result = new Map<number, number>();
    if (ids.length === 0) return result;
    const db = this.getDb();
    const placeholders = ids.map(() => '?').join(',');
    const dedupKeyC = DEDUP_KEY;
    const dedupKeyReq = DEDUP_KEY.replace(/\bc\./g, 'req.');
    const stmt = db.prepare(`
      SELECT
        req.ROWID as requested_id,
        canonical.id as canonical_id
      FROM chat req
      JOIN (
        SELECT * FROM (
          SELECT
            c.ROWID as id,
            ${dedupKeyC} as dedup_key,
            ROW_NUMBER() OVER (
              PARTITION BY ${dedupKeyC}
              ORDER BY (
                SELECT m.date FROM message m
                JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
                WHERE cmj.chat_id = c.ROWID
                  AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)
                ORDER BY m.date DESC LIMIT 1
              ) DESC
            ) as rn
          FROM chat c
        ) WHERE rn = 1
      ) canonical ON canonical.dedup_key = (${dedupKeyReq})
      WHERE req.ROWID IN (${placeholders})
        AND req.ROWID != canonical.id
    `);
    const rows = stmt.all(...ids) as Array<{ requested_id: number; canonical_id: number }>;
    for (const row of rows) {
      result.set(row.requested_id, row.canonical_id);
    }
    return result;
  }

  /**
   * Get messages for a specific chat
   * Ordered by date descending (most recent first)
   * Includes reactions as separate message rows.
   * Merges messages from all sibling chat rows (same dedup key) so the
   * thread view shows the complete conversation across iMessage + SMS.
   */
  getMessages(chatId: number, limit = 50): DBMessage[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT DISTINCT
        m.ROWID as id,
        m.guid,
        m.text,
        m.attributedBody,
        m.is_from_me,
        m.date,
        m.cache_has_attachments,
        m.associated_message_guid,
        m.associated_message_type,
        h.id as sender_handle,
        m.thread_originator_guid
      FROM message m
      JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE cmj.chat_id IN (${siblingChatsSql()})
      ORDER BY m.date DESC
      LIMIT ?
    `);
    return stmt.all(chatId, limit) as DBMessage[];
  }

  /**
   * Get attachments for a specific message
   * Returns file metadata, not the actual file content
   */
  getAttachments(messageId: number): DBAttachment[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT
        a.ROWID as id,
        a.guid,
        a.filename,
        a.mime_type,
        a.uti,
        a.total_bytes,
        a.transfer_name
      FROM attachment a
      JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
      WHERE maj.message_id = ?
    `);
    return stmt.all(messageId) as DBAttachment[];
  }

  /**
   * Get participants for a group chat
   * Returns phone numbers/emails and their service type.
   * Unions participants across all sibling chat rows (iMessage/SMS) and
   * deduplicates by handle_id.
   */
  getGroupParticipants(chatId: number): DBGroupParticipant[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT DISTINCT h.id as handle_id, h.service
      FROM handle h
      JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
      WHERE chj.chat_id IN (${siblingChatsSql()})
    `);
    return stmt.all(chatId) as DBGroupParticipant[];
  }

  /**
   * Check if the database is accessible
   * Full Disk Access (FDA) must be granted for the app to read chat.db
   * Without FDA, the database opens but returns 0 rows (silent failure)
   */
  isAccessible(): boolean {
    try {
      const db = this.getDb();
      const result = db.prepare('SELECT COUNT(*) as count FROM chat').get() as { count: number };
      return result.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the path to chat.db
   * Useful for debugging and permission checks
   */
  getDatabasePath(): string {
    return this.dbPath;
  }
}

// Singleton instance
export const iMessageService = new IMessageService();
