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

  const script = `
    tell application "Messages"
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${recipient}" of targetService
      send "${escapedMessage}" to targetBuddy
    end tell
  `;

  try {
    await execFileAsync('osascript', ['-e', script]);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to send message:', error);
    return { success: false, error };
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
  // AppleScript can send to a chat by finding it through iteration
  const escapedMessage = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  // Try using "text chat id" format which some macOS versions support
  const escapedChatId = chatIdentifier
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  // First try: Use the full chat identifier as text chat id
  const script = `
    tell application "Messages"
      set targetChat to text chat id "${escapedChatId}"
      send "${escapedMessage}" to targetChat
    end tell
  `;

  try {
    await execFileAsync('osascript', ['-e', script]);
    return { success: true };
  } catch (firstErr) {
    // Second try: Find the chat by iterating through all chats
    const fallbackScript = `
      tell application "Messages"
        set allChats to every chat
        repeat with aChat in allChats
          try
            if id of aChat is "${escapedChatId}" then
              send "${escapedMessage}" to aChat
              return "sent"
            end if
          end try
        end repeat
        error "Chat not found"
      end tell
    `;

    try {
      await execFileAsync('osascript', ['-e', fallbackScript]);
      return { success: true };
    } catch (secondErr) {
      const error = secondErr instanceof Error ? secondErr.message : 'Unknown error';
      console.error('Failed to send to chat:', error);
      return { success: false, error: `Could not find chat. Try opening this conversation in Messages.app first.` };
    }
  }
}
