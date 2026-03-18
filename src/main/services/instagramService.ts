import { app } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import { instagramAuthService } from './instagramAuthService';
import type {
  InstagramConversation,
  InstagramMessage,
  InstagramSendResult,
  InstagramAttachment,
} from './instagramTypes';

// Python script paths
const SCRIPTS_DIR = path.join(app.getPath('home'), '.local', 'bin');
const BRIEF_SCRIPT = path.join(SCRIPTS_DIR, 'instagram-brief.py');
const SEND_SCRIPT = path.join(SCRIPTS_DIR, 'instagram-send.py');

// Error patterns that indicate session expiration
const SESSION_EXPIRED_PATTERNS = [
  '404 Client Error',
  '401 Client Error',
  'login_required',
  'LoginRequired',
  'challenge_required',
  'checkpoint_required',
  'Session expired',
  'Please wait a few minutes',
];

/**
 * Check if an error indicates the Instagram session has expired
 */
function isSessionExpiredError(errorMessage: string): boolean {
  return SESSION_EXPIRED_PATTERNS.some(pattern =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Run a Python script and return the JSON output
 */
function runPythonScript(scriptPath: string, args: string[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const homeDir = app.getPath('home');

    try {
      console.log(`Running Python script: ${scriptPath} ${args.join(' ')}`);
      console.log(`HOME directory: ${homeDir}`);
    } catch {
      // Ignore EPIPE errors from console.log during shutdown
    }

    const proc = spawn(pythonCmd, [scriptPath, ...args], {
      cwd: SCRIPTS_DIR,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', HOME: homeDir },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      // Check for session expiration errors in stderr
      if (stderr && isSessionExpiredError(stderr)) {
        instagramAuthService.invalidateSession();
        reject(new Error('Instagram session expired. Please reconnect in Settings.'));
        return;
      }

      if (code !== 0 && !stdout) {
        // Check if the error indicates session expiration
        const errorMsg = stderr || `Process exited with code ${code}`;
        if (isSessionExpiredError(errorMsg)) {
          instagramAuthService.invalidateSession();
          reject(new Error('Instagram session expired. Please reconnect in Settings.'));
        } else {
          reject(new Error(errorMsg));
        }
        return;
      }

      try {
        const trimmed = stdout.trim();
        if (trimmed) {
          const result = JSON.parse(trimmed);

          // Check for error responses from Python script
          if (result.error) {
            const errorMsg = result.message || 'Unknown error';
            if (isSessionExpiredError(errorMsg)) {
              instagramAuthService.invalidateSession();
              reject(new Error('Instagram session expired. Please reconnect in Settings.'));
              return;
            }
          }

          resolve(result);
        } else {
          resolve(null);
        }
      } catch (e) {
        resolve({ raw: stdout, stderr });
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

class InstagramServiceClass {
  /**
   * Ensure user is authenticated and session is valid before API calls
   */
  private async ensureAuthenticated(): Promise<void> {
    await instagramAuthService.ensureValidSession();
  }

  /**
   * Convert Python attachment format to TypeScript format
   */
  private convertAttachment(att: any): InstagramAttachment {
    return {
      type: att.type || 'unknown',
      url: att.url || att.thumbnail_url,
      thumbnailUrl: att.thumbnail_url,
      title: att.title,
      caption: att.caption,
      mediaType: att.media_type,
      width: att.width,
      height: att.height,
      duration: att.duration,
    };
  }

  /**
   * Get Instagram conversations (threads)
   */
  async getConversations(limit = 25): Promise<{ conversations: InstagramConversation[]; hasMore: boolean }> {
    await this.ensureAuthenticated();

    const result = await runPythonScript(BRIEF_SCRIPT, ['conversations', '--limit', String(limit)]);

    if (result.error) {
      throw new Error(result.message || 'Failed to get conversations');
    }

    const rawConversations = result.conversations || [];

    const conversations = rawConversations.map((conv: any) => {
      // Use actual timestamp if available, otherwise calculate from hours_ago
      const messageTime = conv.last_message_time
        ? new Date(conv.last_message_time)
        : new Date(Date.now() - (conv.hours_ago || 0) * 60 * 60 * 1000);

      return {
        id: conv.id,
        recipientId: conv.participant_id || '',
        recipientUsername: conv.participant || 'Unknown',
        recipientName: conv.participant_name || null,
        recipientProfilePic: conv.participant_profile_pic || null,
        recipientFollowerCount: conv.participant_follower_count || null,
        updatedTime: messageTime,
        lastMessage: conv.last_message
          ? {
              text: conv.last_message,
              time: messageTime,
              fromUser: !conv.last_from_me,
              attachments: (conv.last_message_attachments || []).map((a: any) => this.convertAttachment(a)),
            }
          : null,
        isGroup: conv.is_group || false,
        threadTitle: conv.thread_title || null,
        users: conv.users ? conv.users.map((u: any) => ({
          id: u.id,
          username: u.username,
          fullName: u.full_name || null,
          profilePicUrl: u.profile_pic_url || null,
        })) : null,
        windowStatus: this.calculateWindowStatus(
          conv.hours_ago || 0,
          conv.minutes_ago || 0
        ),
      };
    });

    return {
      conversations,
      // If we got the full limit, there may be more
      hasMore: rawConversations.length >= limit,
    };
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(threadId: string, limit = 50): Promise<InstagramMessage[]> {
    await this.ensureAuthenticated();

    const result = await runPythonScript(BRIEF_SCRIPT, ['messages', threadId, '--limit', String(limit)]);

    if (result.error) {
      throw new Error(result.message || 'Failed to get messages');
    }

    return (result.messages || []).map((msg: any) => ({
      id: msg.id,
      text: msg.text || null,
      time: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      fromUser: !msg.from_me,
      from: {
        id: msg.from_me ? 'me' : (result.participant?.id || 'unknown'),
        username: msg.from_username,
        name: msg.from_name,
        profilePicUrl: msg.from_profile_pic,
      },
      attachments: (msg.attachments || []).map((a: any) => this.convertAttachment(a)),
      reactions: msg.reactions || [],
      itemType: msg.item_type,
    }));
  }

  /**
   * Get thread info along with messages
   */
  async getThread(threadId: string, limit = 50): Promise<{
    participant: { id: string; username: string; fullName: string | null; profilePicUrl: string | null; followerCount: number | null };
    isGroup: boolean;
    users: Array<{ id: string; username: string; fullName: string; profilePicUrl: string | null }>;
    messages: InstagramMessage[];
  }> {
    await this.ensureAuthenticated();

    const result = await runPythonScript(BRIEF_SCRIPT, ['messages', threadId, '--limit', String(limit)]);

    if (result.error) {
      throw new Error(result.message || 'Failed to get thread');
    }

    const messages = (result.messages || []).map((msg: any) => ({
      id: msg.id,
      text: msg.text || null,
      time: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      fromUser: !msg.from_me,
      from: {
        id: msg.from_me ? 'me' : (result.participant?.id || 'unknown'),
        username: msg.from_username,
        name: msg.from_name,
        profilePicUrl: msg.from_profile_pic,
      },
      attachments: (msg.attachments || []).map((a: any) => this.convertAttachment(a)),
      reactions: msg.reactions || [],
      itemType: msg.item_type,
    }));

    return {
      participant: {
        id: result.participant?.id || '',
        username: result.participant?.username || 'Unknown',
        fullName: result.participant?.full_name || null,
        profilePicUrl: result.participant?.profile_pic_url || null,
        followerCount: result.participant?.follower_count || null,
      },
      isGroup: result.is_group || false,
      users: (result.users || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        profilePicUrl: u.profile_pic_url,
      })),
      messages,
    };
  }

  /**
   * Send a text message
   */
  async sendMessage(threadId: string, text: string): Promise<InstagramSendResult> {
    await this.ensureAuthenticated();

    if (text.length > 1000) {
      return {
        success: false,
        error: 'Message exceeds 1000 character limit',
        errorCode: 'MESSAGE_TOO_LONG',
      };
    }

    try {
      const result = await runPythonScript(SEND_SCRIPT, ['reply', '--thread', threadId, '--message', text]);

      if (result.success) {
        return {
          success: true,
          messageId: result.message_id,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send message',
          errorCode: 'SEND_FAILED',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Send a message to a user by username
   */
  async sendMessageToUser(username: string, text: string): Promise<InstagramSendResult> {
    await this.ensureAuthenticated();

    try {
      const result = await runPythonScript(SEND_SCRIPT, ['send', '--to', username, '--message', text]);

      if (result.success) {
        return {
          success: true,
          messageId: result.message_id,
          recipientId: result.recipient_id,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send message',
          errorCode: 'SEND_FAILED',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Send a photo
   */
  async sendPhoto(threadId: string, filePath: string): Promise<InstagramSendResult> {
    await this.ensureAuthenticated();

    try {
      const result = await runPythonScript(SEND_SCRIPT, ['photo', '--thread', threadId, '--file', filePath]);

      if (result.success) {
        return {
          success: true,
          messageId: result.message_id,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send photo',
          errorCode: 'SEND_FAILED',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Send a video
   */
  async sendVideo(threadId: string, filePath: string): Promise<InstagramSendResult> {
    await this.ensureAuthenticated();

    try {
      const result = await runPythonScript(SEND_SCRIPT, ['video', '--thread', threadId, '--file', filePath]);

      if (result.success) {
        return {
          success: true,
          messageId: result.message_id,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send video',
          errorCode: 'SEND_FAILED',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Send a file
   */
  async sendFile(threadId: string, filePath: string): Promise<InstagramSendResult> {
    await this.ensureAuthenticated();

    try {
      const result = await runPythonScript(SEND_SCRIPT, ['file', '--thread', threadId, '--file', filePath]);

      if (result.success) {
        return {
          success: true,
          messageId: result.message_id,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send file',
          errorCode: 'SEND_FAILED',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Like a message
   */
  async likeMessage(threadId: string, messageId: string): Promise<InstagramSendResult> {
    await this.ensureAuthenticated();

    try {
      const result = await runPythonScript(SEND_SCRIPT, ['like', '--thread', threadId, '--message-id', messageId]);

      return {
        success: result.success || false,
        error: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Unlike a message
   */
  async unlikeMessage(threadId: string, messageId: string): Promise<InstagramSendResult> {
    await this.ensureAuthenticated();

    try {
      const result = await runPythonScript(SEND_SCRIPT, ['unlike', '--thread', threadId, '--message-id', messageId]);

      return {
        success: result.success || false,
        error: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Get priority DMs (brief)
   */
  async getBrief(): Promise<any[]> {
    await this.ensureAuthenticated();

    const result = await runPythonScript(BRIEF_SCRIPT, ['brief']);

    if (Array.isArray(result)) {
      return result;
    }

    if (result.error) {
      throw new Error(result.message || 'Failed to get brief');
    }

    return [];
  }

  /**
   * Calculate time since last message for display
   * Note: With instagrapi (unofficial API), there's no 24-hour restriction
   * This just shows how long ago the message was received
   */
  private calculateWindowStatus(hoursAgo: number, minutesAgo: number): {
    isOpen: boolean;
    hoursRemaining: number;
    minutesRemaining: number;
    expiresAt: Date;
    urgency: 'normal' | 'warning' | 'expired';
  } {
    // Calculate total minutes ago for precise countdown
    const totalMinutesAgo = (hoursAgo * 60) + minutesAgo;

    // Calculate time left in 24-hour window
    const totalMinutesLeft = Math.max(0, (24 * 60) - totalMinutesAgo);
    const hoursLeft = Math.floor(totalMinutesLeft / 60);
    const minutesLeft = totalMinutesLeft % 60;

    // Urgency based on time left
    let urgency: 'normal' | 'warning' | 'expired' = 'normal';
    if (totalMinutesLeft <= 0) {
      urgency = 'expired';
    } else if (hoursLeft < 4) {
      urgency = 'warning';
    }

    return {
      isOpen: totalMinutesLeft > 0,
      hoursRemaining: hoursLeft,
      minutesRemaining: minutesLeft,
      expiresAt: new Date(Date.now() + totalMinutesLeft * 60 * 1000),
      urgency,
    };
  }
}

// Singleton instance
export const instagramService = new InstagramServiceClass();
