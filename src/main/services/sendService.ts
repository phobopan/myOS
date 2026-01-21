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
