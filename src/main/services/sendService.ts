import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface SendResult {
  success: boolean;
  error?: string;
}

/**
 * Send a message to a 1:1 conversation via AppleScript
 * @param recipient - Phone number or email address (e.g., "+15551234567" or "user@icloud.com")
 * @param message - The message text to send
 */
export async function sendMessage(recipient: string, message: string): Promise<SendResult> {
  // Escape special characters for AppleScript string
  const escapedMessage = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  const escapedRecipient = recipient
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  // Try method 1: Using buddy
  const buddyScript = `
    tell application "Messages"
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${escapedRecipient}" of targetService
      send "${escapedMessage}" to targetBuddy
    end tell
  `;

  try {
    await execFileAsync('osascript', ['-e', buddyScript]);
    return { success: true };
  } catch {
    // Try method 2: Using participant in a chat
    const participantScript = `
      tell application "Messages"
        set targetChat to a reference to 1st chat whose participants contains participant "${escapedRecipient}"
        send "${escapedMessage}" to targetChat
      end tell
    `;

    try {
      await execFileAsync('osascript', ['-e', participantScript]);
      return { success: true };
    } catch {
      // Try method 3: Create new conversation
      const newChatScript = `
        tell application "Messages"
          send "${escapedMessage}" to participant "${escapedRecipient}"
        end tell
      `;

      try {
        await execFileAsync('osascript', ['-e', newChatScript]);
        return { success: true };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        console.error('Failed to send message:', error);
        return { success: false, error };
      }
    }
  }
}

/**
 * Send a message to a named group chat via AppleScript
 * NOTE: This only works for group chats that have been named
 * @param chatName - The display name of the group chat
 * @param message - The message text to send
 */
export async function sendToGroupChat(chatName: string, message: string): Promise<SendResult> {
  const escapedMessage = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  const escapedChatName = chatName
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  const script = `
    tell application "Messages"
      set targetChat to chat "${escapedChatName}"
      send "${escapedMessage}" to targetChat
    end tell
  `;

  try {
    await execFileAsync('osascript', ['-e', script]);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to send to group chat:', error);
    return { success: false, error };
  }
}

/**
 * Send a message to a chat using its identifier (works for both 1:1 and group chats)
 * Parses the chat_identifier to determine the best sending method
 * @param chatIdentifier - The chat identifier (e.g., "iMessage;+;chat123456789" or "iMessage;-;+15551234567")
 * @param message - The message text to send
 */
export async function sendToChat(chatIdentifier: string, message: string): Promise<SendResult> {
  // Parse the chat identifier to determine the type
  // Format: "service;type;identifier"
  // Type "-" = 1:1 chat (identifier is phone/email)
  // Type "+" = group chat (identifier is chat ID)
  const parts = chatIdentifier.split(';');

  if (parts.length >= 3) {
    const chatType = parts[1];
    const identifier = parts.slice(2).join(';'); // Rejoin in case identifier has semicolons

    if (chatType === '-') {
      // 1:1 chat - use buddy with the phone/email
      return sendMessage(identifier, message);
    }
  }

  // For group chats, we need to use a different approach
  const escapedMessage = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  const escapedChatId = chatIdentifier
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  // Extract just the chat ID part (e.g., "chat123456789" from "iMessage;+;chat123456789")
  const chatIdMatch = chatIdentifier.match(/chat\d+/);
  const shortChatId = chatIdMatch ? chatIdMatch[0] : '';

  // Also extract any numeric ID
  const numericIdMatch = chatIdentifier.match(/\d{10,}/);
  const numericId = numericIdMatch ? numericIdMatch[0] : '';

  // Method 1: Try using text chat id with full identifier
  const script1 = `
    tell application "Messages"
      set targetChat to text chat id "${escapedChatId}"
      send "${escapedMessage}" to targetChat
    end tell
  `;

  try {
    await execFileAsync('osascript', ['-e', script1]);
    return { success: true };
  } catch {
    // Method 2: Find chat by iterating and checking if id contains chat number
    if (shortChatId) {
      const script2 = `
        tell application "Messages"
          repeat with aChat in chats
            set chatId to id of aChat
            if chatId contains "${shortChatId}" then
              send "${escapedMessage}" to aChat
              return "sent"
            end if
          end repeat
          error "Chat not found"
        end tell
      `;

      try {
        await execFileAsync('osascript', ['-e', script2]);
        return { success: true };
      } catch {
        // Continue to next method
      }
    }

    // Method 3: Try matching by numeric ID portion
    if (numericId) {
      const script3 = `
        tell application "Messages"
          repeat with aChat in chats
            set chatId to id of aChat as string
            if chatId contains "${numericId}" then
              send "${escapedMessage}" to aChat
              return "sent"
            end if
          end repeat
          error "Chat not found"
        end tell
      `;

      try {
        await execFileAsync('osascript', ['-e', script3]);
        return { success: true };
      } catch {
        // Continue to next method
      }
    }

    // Method 4: Try exact match or contains
    const script4 = `
      tell application "Messages"
        repeat with aChat in chats
          set chatId to id of aChat
          if chatId is "${escapedChatId}" or chatId contains "${escapedChatId}" then
            send "${escapedMessage}" to aChat
            return "sent"
          end if
        end repeat
        error "Chat not found"
      end tell
    `;

    try {
      await execFileAsync('osascript', ['-e', script4]);
      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to send to chat. Identifier:', chatIdentifier, 'Error:', error);
      return { success: false, error: `Could not find chat. Try opening this conversation in Messages.app first.` };
    }
  }
}
