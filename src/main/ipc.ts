import { ipcMain, app, shell } from 'electron';
import { iMessageService, fromAppleTime, parseAttributedBody } from './services/iMessageService';
import { resolveHandle, buildContactCache, isContactsCacheBuilt } from './services/contactService';
import { checkFullDiskAccess, requestFullDiskAccess } from './services/permissionService';
import { sendMessage, sendToGroupChat, sendToChat } from './services/sendService';
import { sendReaction } from './services/reactionService';
import { getDisplayImagePath, isHeicImage } from './services/imageService';
import { TAPBACK_TYPES, isTapback } from './services/types';
import { gmailAuthService } from './services/gmailAuthService';
import { gmailService } from './services/gmailService';
import { instagramAuthService } from './services/instagramAuthService';
import { instagramService } from './services/instagramService';
import { llmService } from './services/llmService';
import type { IMessageConversation, IMessageMessage, Attachment, Reaction } from '../shared/ipcTypes';
import type { GmailMessage } from './services/gmailTypes';

// Safe logging to prevent EPIPE errors during shutdown
function safeLog(...args: unknown[]) {
  try {
    console.log(...args);
  } catch {
    // Ignore EPIPE errors
  }
}

function safeError(...args: unknown[]) {
  try {
    console.error(...args);
  } catch {
    // Ignore EPIPE errors
  }
}

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

  // Helper to transform DB conversations to IPC format
  function mapDbConversation(conv: ReturnType<typeof iMessageService.getConversations>[number]): IMessageConversation {
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
    // Strip Unicode object replacement char (\uFFFC) used as attachment placeholder
    if (lastMessageText) {
      lastMessageText = lastMessageText.replace(/\uFFFC/g, '').trim() || null;
    }

    return {
      id: conv.id,
      guid: conv.guid,
      chatIdentifier: conv.chat_identifier,
      displayName: conv.display_name,
      contactName: isGroup ? null : (contactInfo?.displayName || null),
      isGroup,
      lastMessage: lastMessageText,
      lastMessageDate: fromAppleTime(conv.last_message_date),
      isFromMe: conv.is_from_me === 1,
      handleId: conv.handle_id,
      participants,
      hasAttachments: conv.cache_has_attachments === 1,
      attachmentType: conv.attachment_mime_type || null,
    };
  }

  // iMessage handlers
  ipcMain.handle('imessage:getConversations', async (_, limit?: number): Promise<IMessageConversation[]> => {
    const dbConversations = iMessageService.getConversations(limit || 50);
    return dbConversations.map(mapDbConversation);
  });

  ipcMain.handle('imessage:getConversationsByIds', async (_, ids: number[]): Promise<IMessageConversation[]> => {
    const dbConversations = iMessageService.getConversationsByIds(ids);
    return dbConversations.map(mapDbConversation);
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

    const results: IMessageMessage[] = [];

    for (const msg of regularMessages) {
      try {
        const senderInfo = resolveHandle(msg.sender_handle);

        // Get attachments (with per-attachment error handling)
        let attachments: Attachment[] = [];
        if (msg.cache_has_attachments) {
          const dbAttachments = iMessageService.getAttachments(msg.id);
          attachments = await Promise.all(dbAttachments.map(async att => {
            try {
              const mime = att.mime_type?.toLowerCase() || '';
              const uti = att.uti?.toLowerCase() || '';
              const originalPath = expandTilde(att.filename);

              const isImage = mime.startsWith('image/') || uti.includes('image') ||
                isHeicImage(originalPath, att.mime_type, att.uti);

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
            } catch {
              return {
                id: att.guid,
                filename: att.transfer_name || att.filename,
                mimeType: att.mime_type,
                path: expandTilde(att.filename),
                size: att.total_bytes,
                isImage: false,
                isVideo: false,
                isAudio: false,
              };
            }
          }));
        }

        // Get reactions for this message
        const reactions = reactionMap.get(msg.guid) || [];

        // Extract text from attributedBody if text is null
        let messageText = msg.text;
        if (!messageText && msg.attributedBody) {
          messageText = parseAttributedBody(msg.attributedBody);
        }
        // Strip Unicode object replacement char (attachment placeholder)
        if (messageText) {
          messageText = messageText.replace(/\uFFFC/g, '').trim() || null;
        }

        results.push({
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
          threadOriginatorGuid: msg.thread_originator_guid || null,
        });
      } catch (err) {
        safeError(`Failed to process message ${msg.id}:`, err);
      }
    }

    return results;
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

  ipcMain.handle('imessage:sendReaction', async (_, chatId: number, targetGuid: string, reactionType: string, remove?: boolean) => {
    return sendReaction(chatId, targetGuid, reactionType, remove);
  });

  // Shell handlers
  ipcMain.handle('shell:openPath', async (_, filePath: string) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    return shell.openExternal(url);
  });

  // Gmail auth handlers
  ipcMain.handle('gmail:authenticate', async () => {
    return gmailAuthService.authenticate();
  });

  ipcMain.handle('gmail:isAuthenticated', async () => {
    return gmailAuthService.isAuthenticated();
  });

  ipcMain.handle('gmail:getUserEmail', async () => {
    return gmailAuthService.fetchUserEmail();
  });

  ipcMain.handle('gmail:disconnect', async () => {
    return gmailAuthService.disconnect();
  });

  // Gmail data handlers
  ipcMain.handle('gmail:getThreads', async (_, maxResults?: number, pageToken?: string) => {
    try {
      safeLog('Gmail: Fetching threads...');
      const result = await gmailService.getThreads(maxResults, pageToken);
      safeLog(`Gmail: Fetched ${result.threads.length} threads`);
      return result;
    } catch (error) {
      safeError('Gmail: Failed to fetch threads:', error);
      throw error;
    }
  });

  ipcMain.handle('gmail:getThread', async (_, threadId: string) => {
    return gmailService.getThread(threadId);
  });

  ipcMain.handle('gmail:getAttachment', async (_, messageId: string, attachmentId: string) => {
    const buffer = await gmailService.getAttachment(messageId, attachmentId);
    return buffer.toString('base64');  // Send as base64 string over IPC
  });

  ipcMain.handle('gmail:sendReply', async (
    _,
    threadId: string,
    originalMessageId: string,
    to: string,
    subject: string,
    body: string,
    options?: { cc?: string; bcc?: string }
  ) => {
    return gmailService.sendReply(threadId, originalMessageId, to, subject, body, options);
  });

  ipcMain.handle('gmail:sendReplyAll', async (
    _,
    threadId: string,
    originalMessage: GmailMessage,
    body: string,
    options?: { subject?: string }
  ) => {
    return gmailService.sendReplyAll(threadId, originalMessage, body, options);
  });

  ipcMain.handle('gmail:forward', async (
    _,
    originalMessage: GmailMessage,
    to: string,
    additionalBody?: string
  ) => {
    return gmailService.forward(originalMessage, to, additionalBody);
  });

  // Instagram auth handlers
  // Authenticate with username/password (creates longer-lasting session)
  ipcMain.handle('instagram:authenticateWithCredentials', async (_, username: string, password: string) => {
    return instagramAuthService.authenticateWithCredentials(username, password);
  });

  // Complete 2FA if required
  ipcMain.handle('instagram:completeWithTwoFactor', async (_, username: string, password: string, code: string) => {
    return instagramAuthService.completeWithTwoFactor(username, password, code);
  });

  // Check session status
  ipcMain.handle('instagram:checkStatus', async () => {
    return instagramAuthService.checkStatus();
  });

  ipcMain.handle('instagram:isAuthenticated', async () => {
    return instagramAuthService.isAuthenticated();
  });

  ipcMain.handle('instagram:getAccountInfo', async () => {
    return instagramAuthService.getAccountInfo();
  });

  ipcMain.handle('instagram:disconnect', async () => {
    return instagramAuthService.disconnect();
  });

  // Instagram data handlers
  ipcMain.handle('instagram:getConversations', async (_, limit?: number) => {
    try {
      safeLog('Instagram: Fetching conversations...');
      const result = await instagramService.getConversations(limit);
      safeLog(`Instagram: Fetched ${result.conversations.length} conversations`);
      return result;
    } catch (error) {
      safeError('Instagram: Failed to fetch conversations:', error);
      throw error;
    }
  });

  ipcMain.handle('instagram:getMessages', async (_, conversationId: string, limit?: number) => {
    try {
      return await instagramService.getMessages(conversationId, limit);
    } catch (error) {
      safeError('Instagram: Failed to fetch messages:', error);
      throw error;
    }
  });

  ipcMain.handle('instagram:getThread', async (_, threadId: string, limit?: number) => {
    try {
      return await instagramService.getThread(threadId, limit);
    } catch (error) {
      safeError('Instagram: Failed to fetch thread:', error);
      throw error;
    }
  });

  ipcMain.handle('instagram:sendMessage', async (_, threadId: string, text: string) => {
    return instagramService.sendMessage(threadId, text);
  });

  ipcMain.handle('instagram:sendMessageToUser', async (_, username: string, text: string) => {
    return instagramService.sendMessageToUser(username, text);
  });

  ipcMain.handle('instagram:sendPhoto', async (_, threadId: string, filePath: string) => {
    return instagramService.sendPhoto(threadId, filePath);
  });

  ipcMain.handle('instagram:sendVideo', async (_, threadId: string, filePath: string) => {
    return instagramService.sendVideo(threadId, filePath);
  });

  ipcMain.handle('instagram:sendFile', async (_, threadId: string, filePath: string) => {
    return instagramService.sendFile(threadId, filePath);
  });

  ipcMain.handle('instagram:likeMessage', async (_, threadId: string, messageId: string) => {
    return instagramService.likeMessage(threadId, messageId);
  });

  ipcMain.handle('instagram:unlikeMessage', async (_, threadId: string, messageId: string) => {
    return instagramService.unlikeMessage(threadId, messageId);
  });

  ipcMain.handle('instagram:getBrief', async () => {
    return instagramService.getBrief();
  });

  // Claude draft generation (non-streaming)
  ipcMain.handle('claude:generateDraft', async (
    _,
    platform: 'imessage' | 'gmail' | 'instagram',
    messages: Array<{ sender: string; text: string }>,
    context?: { contactName?: string; subject?: string }
  ) => {
    return llmService.generateDraft(platform, messages, context);
  });

  // Claude draft generation (streaming - sends chunks via events)
  ipcMain.handle('claude:generateDraftStream', async (
    event,
    platform: 'imessage' | 'gmail' | 'instagram',
    messages: Array<{ sender: string; text: string }>,
    context?: { contactName?: string; subject?: string }
  ) => {
    return llmService.generateDraftStream(platform, messages, context, (chunk) => {
      try {
        event.sender.send('claude:draft-chunk', chunk);
      } catch {
        // Window may have been closed
      }
    });
  });
}
