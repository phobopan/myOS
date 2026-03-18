import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import crypto from 'crypto';

// Apple's Cocoa epoch: seconds from Unix epoch to 2001-01-01 00:00:00 UTC
const APPLE_EPOCH = 978307200;

/**
 * Tapback associated_message_type values:
 * 2000 = love, 2001 = like, 2002 = dislike, 2003 = laugh, 2004 = emphasize, 2005 = question
 * 3000-3005 = removed versions of above
 */
const REACTION_TYPE_MAP: Record<string, number> = {
  love: 2000,
  like: 2001,
  dislike: 2002,
  laugh: 2003,
  emphasize: 2004,
  question: 2005,
};

/**
 * Send a tapback reaction by directly inserting into chat.db.
 *
 * Opens a separate read-write connection briefly, inserts the reaction message,
 * links it to the chat, and closes the connection immediately.
 */
export async function sendReaction(
  chatId: number,
  targetMessageGuid: string,
  reactionType: string,
  remove = false,
): Promise<{ success: boolean; error?: string }> {
  const typeCode = REACTION_TYPE_MAP[reactionType];
  if (typeCode === undefined) {
    return { success: false, error: `Unknown reaction type: ${reactionType}` };
  }

  const associatedType = remove ? typeCode + 1000 : typeCode;
  const associatedGuid = `p:0/${targetMessageGuid}`;

  const home = app.getPath('home');
  const dbPath = path.join(home, 'Library', 'Messages', 'chat.db');

  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: false });

    // Generate a unique guid for this reaction message
    const guid = crypto.randomUUID().toUpperCase();

    // Apple nanosecond timestamp
    const nowUnix = Date.now() / 1000;
    const appleNano = Math.floor((nowUnix - APPLE_EPOCH) * 1_000_000_000);

    // Insert reaction message
    const insertMsg = db.prepare(`
      INSERT INTO message (
        guid, text, replace, service_center, handle_id, subject, country,
        attributedBody, version, type, service, account, account_guid,
        error, date, date_read, date_delivered, is_delivered, is_finished,
        is_emote, is_from_me, is_empty, is_delayed, is_auto_reply, is_prepared,
        is_read, is_system_message, is_sent, has_dd_results, is_service_message,
        is_forward, was_downgraded, is_archive, cache_has_attachments,
        cache_roomnames, was_data_detected, was_deduplicated,
        is_audio_message, is_played, date_played, item_type, other_handle,
        group_title, group_action_type, share_status, share_direction,
        is_expirable, expire_state, message_action_type, message_source,
        associated_message_guid, associated_message_type,
        balloon_bundle_id, payload_data, expressive_send_style_id,
        associated_message_range_location, associated_message_range_length,
        time_expressive_send_played, message_summary_info,
        ck_sync_state, ck_record_id, ck_record_change_tag,
        destination_caller_id, sr_ck_sync_state, sr_ck_record_id,
        sr_ck_record_change_tag, is_corrupt, reply_to_guid,
        sort_id, is_spam, has_unseen_mention, thread_originator_guid,
        thread_originator_part, synced_syndication_ranges,
        was_filtered, part_count, is_stewie, is_kt_verified
      ) VALUES (
        ?, '', 0, NULL, 0, NULL, NULL,
        NULL, 10, 0, 'iMessage', NULL, NULL,
        0, ?, 0, 0, 0, 1,
        0, 1, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0,
        NULL, 0, 0,
        0, 0, 0, 0, 0,
        NULL, 0, 0, 0,
        0, 0, 0, 0,
        ?, ?,
        NULL, NULL, NULL,
        0, 0,
        0, NULL,
        0, NULL, NULL,
        NULL, 0, NULL,
        NULL, 0, NULL,
        0, NULL, 1, 0, NULL,
        NULL, NULL,
        0, 1, 0, 0
      )
    `);

    const result = insertMsg.run(guid, appleNano, associatedGuid, associatedType);
    const messageRowId = result.lastInsertRowid;

    // Link message to chat
    const insertJoin = db.prepare(`
      INSERT INTO chat_message_join (chat_id, message_id, message_date)
      VALUES (?, ?, ?)
    `);
    insertJoin.run(chatId, messageRowId, appleNano);

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send reaction:', err);
    return { success: false, error: err?.message || 'Failed to insert reaction' };
  } finally {
    if (db) {
      try { db.close(); } catch { /* ignore */ }
    }
  }
}
