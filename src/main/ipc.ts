import { ipcMain, app } from 'electron';
import { iMessageService, fromAppleTime } from './services/iMessageService';
import { resolveHandle, buildContactCache, isContactsCacheBuilt } from './services/contactService';
import { checkFullDiskAccess, requestFullDiskAccess } from './services/permissionService';
import { TAPBACK_TYPES, isTapback } from './services/types';
import type { IMessageConversation, IMessageMessage, Attachment, Reaction } from '../shared/ipcTypes';

function expandTilde(filepath: string | null): string | null {
  if (!filepath) return null;
  if (filepath.startsWith('~')) {
    return filepath.replace('~', app.getPath('home'));
  }
  return filepath;
}

function extractParentGuid(associatedGuid: string): string {
  // Remove prefix like "p:0/" or "bp:"
  return associatedGuid.replace(/^(p:\d+\/|bp:)/, '');
}

export function registerIpcHandlers(): void {
  // Permission handlers
  ipcMain.handle('permissions:checkFDA', () => {
    return checkFullDiskAccess();
  });

  ipcMain.handle('permissions:requestFDA', () => {
    requestFullDiskAccess();
  });

  // Contact handlers
  ipcMain.handle('contacts:buildCache', async () => {
    await buildContactCache();
    return isContactsCacheBuilt();
  });

  // iMessage handlers
  ipcMain.handle('imessage:getConversations', async (_, limit?: number): Promise<IMessageConversation[]> => {
    const dbConversations = iMessageService.getConversations(limit || 50);

    return dbConversations.map(conv => {
      const contactInfo = resolveHandle(conv.handle_id);
      const isGroup = conv.style === 43;

      let participants: string[] | undefined;
      if (isGroup) {
        const dbParticipants = iMessageService.getGroupParticipants(conv.id);
        participants = dbParticipants.map(p => {
          const info = resolveHandle(p.handle_id);
          return info?.displayName || p.handle_id;
        });
      }

      return {
        id: conv.id,
        guid: conv.guid,
        chatIdentifier: conv.chat_identifier,
        displayName: conv.display_name,
        contactName: contactInfo?.displayName || null,
        isGroup,
        lastMessage: conv.last_message,
        lastMessageDate: fromAppleTime(conv.last_message_date),
        isFromMe: conv.is_from_me === 1,
        handleId: conv.handle_id,
        participants,
      };
    });
  });

  ipcMain.handle('imessage:getMessages', async (_, chatId: number, limit?: number): Promise<IMessageMessage[]> => {
    const dbMessages = iMessageService.getMessages(chatId, limit || 100);

    // Build a map of message guid -> reactions
    const reactionMap = new Map<string, Reaction[]>();
    const regularMessages: typeof dbMessages = [];

    for (const msg of dbMessages) {
      if (isTapback(msg.associated_message_type) && msg.associated_message_guid) {
        const parentGuid = extractParentGuid(msg.associated_message_guid);
        const tapbackInfo = TAPBACK_TYPES[msg.associated_message_type];

        if (tapbackInfo && !tapbackInfo.removed) {
          const senderInfo = resolveHandle(msg.sender_handle);
          const reaction: Reaction = {
            emoji: tapbackInfo.emoji,
            label: tapbackInfo.label,
            senderName: senderInfo?.displayName,
            senderId: msg.sender_handle || undefined,
          };

          const existing = reactionMap.get(parentGuid) || [];
          existing.push(reaction);
          reactionMap.set(parentGuid, existing);
        }
      } else {
        regularMessages.push(msg);
      }
    }

    return regularMessages.map(msg => {
      const senderInfo = resolveHandle(msg.sender_handle);

      // Get attachments
      const dbAttachments = msg.cache_has_attachments ? iMessageService.getAttachments(msg.id) : [];
      const attachments: Attachment[] = dbAttachments.map(att => ({
        id: att.guid,
        filename: att.transfer_name || att.filename,
        mimeType: att.mime_type,
        path: expandTilde(att.filename),
        size: att.total_bytes,
        isImage: att.mime_type?.startsWith('image/') || att.uti?.includes('image') || false,
      }));

      // Get reactions for this message
      const reactions = reactionMap.get(msg.guid) || [];

      return {
        id: msg.id,
        guid: msg.guid,
        text: msg.text,
        isFromMe: msg.is_from_me === 1,
        date: fromAppleTime(msg.date),
        senderHandle: msg.sender_handle,
        senderName: senderInfo?.displayName || null,
        attachments,
        reactions,
        isReaction: false,
      };
    });
  });

  ipcMain.handle('imessage:isAccessible', () => {
    return iMessageService.isAccessible();
  });
}
