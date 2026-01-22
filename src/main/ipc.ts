import { ipcMain, app, shell } from 'electron';
import { iMessageService, fromAppleTime, parseAttributedBody } from './services/iMessageService';
import { resolveHandle, buildContactCache, isContactsCacheBuilt } from './services/contactService';
import { checkFullDiskAccess, requestFullDiskAccess } from './services/permissionService';
import { sendMessage, sendToGroupChat, sendToChat } from './services/sendService';
import { getDisplayImagePath, isHeicImage } from './services/imageService';
import { TAPBACK_TYPES, isTapback } from './services/types';
import { gmailAuthService } from './services/gmailAuthService';
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

      // Extract last message text from attributedBody if text is null
      let lastMessageText = conv.last_message;
      if (!lastMessageText && conv.last_message_attributed_body) {
        lastMessageText = parseAttributedBody(conv.last_message_attributed_body);
      }

      return {
        id: conv.id,
        guid: conv.guid,
        chatIdentifier: conv.chat_identifier,
        displayName: conv.display_name,
        contactName: contactInfo?.displayName || null,
        isGroup,
        lastMessage: lastMessageText,
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

    return Promise.all(regularMessages.map(async msg => {
      const senderInfo = resolveHandle(msg.sender_handle);

      // Get attachments
      const dbAttachments = msg.cache_has_attachments ? iMessageService.getAttachments(msg.id) : [];
      const attachments: Attachment[] = await Promise.all(dbAttachments.map(async att => {
        const mime = att.mime_type?.toLowerCase() || '';
        const uti = att.uti?.toLowerCase() || '';
        const originalPath = expandTilde(att.filename);

        // Check if this is an image (including HEIC)
        const isImage = mime.startsWith('image/') || uti.includes('image') ||
          isHeicImage(originalPath, att.mime_type, att.uti);

        // Convert HEIC to JPEG for display
        let displayPath = originalPath;
        if (isImage && originalPath) {
          displayPath = await getDisplayImagePath(originalPath, att.mime_type, att.uti);
        }

        return {
          id: att.guid,
          filename: att.transfer_name || att.filename,
          mimeType: att.mime_type,
          path: displayPath,
          size: att.total_bytes,
          isImage,
          isVideo: mime.startsWith('video/') || uti.includes('video') || uti.includes('movie'),
          isAudio: mime.startsWith('audio/') || uti.includes('audio'),
        };
      }));

      // Get reactions for this message
      const reactions = reactionMap.get(msg.guid) || [];

      // Extract text from attributedBody if text is null
      let messageText = msg.text;
      if (!messageText && msg.attributedBody) {
        messageText = parseAttributedBody(msg.attributedBody);
      }

      return {
        id: msg.id,
        guid: msg.guid,
        text: messageText,
        isFromMe: msg.is_from_me === 1,
        date: fromAppleTime(msg.date),
        senderHandle: msg.sender_handle,
        senderName: senderInfo?.displayName || null,
        attachments,
        reactions,
        isReaction: false,
      };
    }));
  });

  ipcMain.handle('imessage:isAccessible', () => {
    return iMessageService.isAccessible();
  });

  ipcMain.handle('imessage:sendMessage', async (_, recipient: string, message: string) => {
    return sendMessage(recipient, message);
  });

  ipcMain.handle('imessage:sendToGroupChat', async (_, chatName: string, message: string) => {
    return sendToGroupChat(chatName, message);
  });

  ipcMain.handle('imessage:sendToChat', async (_, chatIdentifier: string, message: string) => {
    return sendToChat(chatIdentifier, message);
  });

  // Shell handlers
  ipcMain.handle('shell:openPath', async (_, filePath: string) => {
    return shell.openPath(filePath);
  });

  // Gmail auth handlers
  ipcMain.handle('gmail:authenticate', async () => {
    return gmailAuthService.authenticate();
  });

  ipcMain.handle('gmail:isAuthenticated', async () => {
    return gmailAuthService.isAuthenticated();
  });

  ipcMain.handle('gmail:getUserEmail', async () => {
    return gmailAuthService.getUserEmail();
  });

  ipcMain.handle('gmail:disconnect', async () => {
    return gmailAuthService.disconnect();
  });
}
