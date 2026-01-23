import axios from 'axios';
import { instagramAuthService } from './instagramAuthService';
import type {
  InstagramConversation,
  InstagramMessage,
  InstagramSendResult,
  WindowStatus
} from './instagramTypes';

// Instagram API with Instagram Login uses graph.instagram.com
const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';

/**
 * Rate limiter to prevent exceeding 200 requests/hour
 * Uses sliding window algorithm
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 180; // Leave 20 buffer
  private readonly windowMs = 60 * 60 * 1000; // 1 hour

  async throttle(): Promise<void> {
    const now = Date.now();
    // Remove requests outside the window
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      console.log(`Instagram rate limiter: waiting ${Math.ceil(waitTime / 1000)}s`);
      await new Promise(r => setTimeout(r, waitTime + 100));
      return this.throttle();
    }

    this.requests.push(now);
  }
}

class InstagramServiceClass {
  private rateLimiter = new RateLimiter();

  /**
   * Ensure user is authenticated before API calls
   */
  private ensureAuthenticated(): void {
    if (!instagramAuthService.isAuthenticated()) {
      throw new Error('Instagram not authenticated');
    }
  }

  /**
   * Get Instagram conversations (threads)
   * @param limit Number of conversations to fetch (default 25)
   */
  async getConversations(limit = 25): Promise<InstagramConversation[]> {
    this.ensureAuthenticated();
    await this.rateLimiter.throttle();

    const accessToken = instagramAuthService.getPageAccessToken();
    const instagramAccountId = instagramAuthService.getInstagramAccountId();

    // Instagram Login uses me/conversations endpoint
    const response = await axios.get(`${GRAPH_API_BASE}/me/conversations`, {
      params: {
        platform: 'instagram',
        access_token: accessToken,
        fields: 'id,participants,updated_time,messages.limit(1){message,created_time,from}',
        limit
      }
    });

    return response.data.data.map((conv: any) => {
      const lastMessage = conv.messages?.data?.[0];
      const otherParticipant = conv.participants?.data?.find(
        (p: any) => p.id !== instagramAccountId
      );

      const lastMessageFromUser = lastMessage?.from?.id !== instagramAccountId;
      const lastUserMessageTime = lastMessageFromUser && lastMessage
        ? new Date(lastMessage.created_time)
        : null;

      return {
        id: conv.id,
        recipientId: otherParticipant?.id || '',
        recipientUsername: otherParticipant?.username || 'Unknown',
        recipientName: otherParticipant?.name || null,
        updatedTime: new Date(conv.updated_time),
        lastMessage: lastMessage ? {
          text: lastMessage.message,
          time: new Date(lastMessage.created_time),
          fromUser: lastMessageFromUser,
        } : null,
        windowStatus: this.calculateWindowStatus(lastUserMessageTime),
      };
    });
  }

  /**
   * Get messages in a conversation
   * @param conversationId Instagram conversation ID
   * @param limit Number of messages to fetch (default 50)
   */
  async getMessages(conversationId: string, limit = 50): Promise<InstagramMessage[]> {
    this.ensureAuthenticated();
    await this.rateLimiter.throttle();

    const accessToken = instagramAuthService.getPageAccessToken();
    const instagramAccountId = instagramAuthService.getInstagramAccountId();

    const response = await axios.get(`${GRAPH_API_BASE}/${conversationId}`, {
      params: {
        access_token: accessToken,
        fields: `messages.limit(${limit}){id,message,created_time,from,attachments}`
      }
    });

    return (response.data.messages?.data || []).map((msg: any) => ({
      id: msg.id,
      text: msg.message || null,
      time: new Date(msg.created_time),
      fromUser: msg.from?.id !== instagramAccountId,
      from: msg.from || { id: 'unknown' },
      attachments: (msg.attachments?.data || []).map((att: any) => ({
        type: att.type || 'image',
        url: att.payload?.url,
        title: att.title,
        thumbnailUrl: att.thumbnail_url,
      })),
    }));
  }

  /**
   * Send a message to a user
   * Must be within 24-hour window of their last message
   * @param recipientId Instagram user ID to message
   * @param text Message text (max 1000 chars per CONTEXT.md)
   */
  async sendMessage(recipientId: string, text: string): Promise<InstagramSendResult> {
    this.ensureAuthenticated();

    // Enforce 1000 char limit per CONTEXT.md
    if (text.length > 1000) {
      return {
        success: false,
        error: 'Message exceeds 1000 character limit',
        errorCode: 'MESSAGE_TOO_LONG'
      };
    }

    await this.rateLimiter.throttle();

    const accessToken = instagramAuthService.getPageAccessToken();

    try {
      // Instagram Login uses me/messages endpoint
      const response = await axios.post(
        `${GRAPH_API_BASE}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text },
          messaging_type: 'RESPONSE'
        },
        { params: { access_token: accessToken } }
      );

      return {
        success: true,
        messageId: response.data.message_id,
        recipientId: response.data.recipient_id
      };
    } catch (error: any) {
      const fbError = error.response?.data?.error;

      // Handle specific Facebook API errors
      if (fbError?.code === 10 || fbError?.error_subcode === 2018278) {
        return {
          success: false,
          error: 'Messaging window expired. User must message first.',
          errorCode: 'WINDOW_EXPIRED'
        };
      }

      if (fbError?.code === 200) {
        return {
          success: false,
          error: 'Permission denied. Check instagram_manage_messages permission.',
          errorCode: 'PERMISSION_DENIED'
        };
      }

      if (fbError?.code === 190) {
        return {
          success: false,
          error: 'Access token expired. Please reconnect Instagram.',
          errorCode: 'TOKEN_EXPIRED'
        };
      }

      return {
        success: false,
        error: fbError?.message || 'Unknown error',
        errorCode: 'UNKNOWN'
      };
    }
  }

  /**
   * Calculate the 24-hour messaging window status
   * @param lastUserMessageTime Time of the last message from the user (not us)
   */
  private calculateWindowStatus(lastUserMessageTime: Date | null): WindowStatus {
    if (!lastUserMessageTime) {
      return {
        isOpen: false,
        hoursRemaining: 0,
        minutesRemaining: 0,
        expiresAt: new Date(0),
        urgency: 'expired'
      };
    }

    const now = new Date();
    const windowDuration = 24 * 60 * 60 * 1000; // 24 hours in ms
    const expiresAt = new Date(lastUserMessageTime.getTime() + windowDuration);
    const msRemaining = expiresAt.getTime() - now.getTime();

    if (msRemaining <= 0) {
      return {
        isOpen: false,
        hoursRemaining: 0,
        minutesRemaining: 0,
        expiresAt,
        urgency: 'expired'
      };
    }

    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

    let urgency: WindowStatus['urgency'] = 'normal';
    if (hoursRemaining < 1) {
      urgency = 'warning';
    }

    return {
      isOpen: true,
      hoursRemaining,
      minutesRemaining,
      expiresAt,
      urgency,
    };
  }
}

// Singleton instance
export const instagramService = new InstagramServiceClass();
