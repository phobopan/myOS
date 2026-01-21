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
   */
  private getDb(): Database.Database {
    if (!this.db) {
      this.db = new Database(this.dbPath, { readonly: true });
    }
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
   * Get conversations ordered by most recent message
   * Returns chats with their last message for preview
   */
  getConversations(limit = 50): DBConversation[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT
        c.ROWID as id,
        c.guid,
        c.chat_identifier,
        c.display_name,
        c.style,
        m.text as last_message,
        m.is_from_me,
        m.date as last_message_date,
        h.id as handle_id
      FROM chat c
      LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
      LEFT JOIN message m ON cmj.message_id = m.ROWID
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE m.ROWID = (
        SELECT MAX(m2.ROWID)
        FROM message m2
        JOIN chat_message_join cmj2 ON m2.ROWID = cmj2.message_id
        WHERE cmj2.chat_id = c.ROWID
      )
      ORDER BY m.date DESC
      LIMIT ?
    `);
    return stmt.all(limit) as DBConversation[];
  }

  /**
   * Get messages for a specific chat
   * Ordered by date descending (most recent first)
   * Includes reactions as separate message rows
   */
  getMessages(chatId: number, limit = 50): DBMessage[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT
        m.ROWID as id,
        m.guid,
        m.text,
        m.attributedBody,
        m.is_from_me,
        m.date,
        m.cache_has_attachments,
        m.associated_message_guid,
        m.associated_message_type,
        h.id as sender_handle
      FROM message m
      JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE cmj.chat_id = ?
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
   * Returns phone numbers/emails and their service type
   */
  getGroupParticipants(chatId: number): DBGroupParticipant[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT h.id as handle_id, h.service
      FROM handle h
      JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
      WHERE chj.chat_id = ?
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
