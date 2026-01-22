# Phase 4: Instagram - Research

**Researched:** 2026-01-22
**Domain:** Instagram Graph API (Messenger Platform) integration with OAuth 2.0 in Electron
**Confidence:** HIGH

## Summary

Instagram DM integration requires the Instagram Graph API (built on Facebook's Messenger Platform) with OAuth 2.0 authentication via Facebook. The API is exclusively for Business/Creator accounts and uses Facebook Pages as the access mechanism. The 24-hour messaging window is the core constraint: you can only reply within 24 hours of the user's last message, with a 7-day HUMAN_AGENT extension for manual replies.

The architecture follows the existing phoebeOS service pattern: an `InstagramService` singleton in the main process with IPC handlers using the `instagram:action` namespace, exposed to the renderer via `window.electron.instagram`. Authentication uses Facebook's login success page (`https://www.facebook.com/connect/login_success.html`) as the redirect URI since Facebook no longer accepts localhost.

The CONTEXT.md decisions lock in specific UX choices (countdown badge, expired conversations dimmed, "Open in Instagram" for expired threads) that differentiate this phase from Gmail. Rate limits were reduced 96% in January 2026 to 200 requests/hour per Instagram account, making caching and efficient API use essential.

**Primary recommendation:** Use raw `axios` for Graph API calls (no official Node.js SDK for Instagram DM), Facebook's success page redirect for OAuth, `electron-store` + `safeStorage` for token persistence (matching Gmail pattern), and implement client-side 24-hour window tracking with proactive expiry calculations.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `axios` | ^1.6.0 | HTTP client for Graph API | Simple, well-tested, no SDK overhead |
| `electron-store` | ^8.1.0 | Persistent config/token storage | Matches Gmail implementation, v8 for CommonJS |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | Built-in Node.js `http`, `crypto` sufficient for OAuth |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `axios` | `node-fetch` | axios has better error handling, interceptors |
| `axios` | `instagram-graph-api` npm | Package is for posting/content, not DM messaging |
| Manual OAuth | `oauth-electron-facebook` | Small package, but adds dependency for simple flow |

**Installation:**
```bash
npm install axios
# electron-store already installed from Gmail phase
```

## Architecture Patterns

### Recommended Project Structure
```
src/
|-- main/
|   |-- services/
|   |   |-- instagramService.ts      # Instagram API wrapper (singleton)
|   |   |-- instagramAuthService.ts  # OAuth flow, token storage
|   |   |-- instagramTypes.ts        # API type definitions
|   |-- ipc.ts                       # Add instagram:* handlers
|-- shared/
|   |-- ipcTypes.ts                  # Add Instagram interfaces
|-- renderer/
    |-- components/
    |   |-- InstagramThreadView.tsx  # DM thread display with countdown
    |   |-- InstagramComposer.tsx    # Text-only composer with char limit
    |   |-- InstagramMessage.tsx     # Individual message bubble
    |   |-- CountdownBadge.tsx       # 24-hour window countdown
    |-- electron.d.ts                # Add instagram API types
```

### Pattern 1: Service Singleton (matches iMessageService, gmailService)
**What:** Lazy-initialized singleton for Instagram API access
**When to use:** All Instagram operations go through single service instance
**Example:**
```typescript
// Source: existing gmailService pattern
import axios from 'axios';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

class InstagramServiceClass {
  private pageAccessToken: string | null = null;
  private pageId: string | null = null;
  private instagramBusinessAccountId: string | null = null;

  async initialize(userAccessToken: string): Promise<InstagramAccountInfo> {
    // Get user's Pages with Instagram Business Account
    const response = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: {
        access_token: userAccessToken,
        fields: 'id,name,access_token,instagram_business_account{id,username,name}'
      }
    });

    const pageWithInstagram = response.data.data.find(
      (p: any) => p.instagram_business_account
    );

    if (!pageWithInstagram) {
      throw new Error('No Facebook Page with linked Instagram Business Account found');
    }

    this.pageId = pageWithInstagram.id;
    this.pageAccessToken = pageWithInstagram.access_token;
    this.instagramBusinessAccountId = pageWithInstagram.instagram_business_account.id;

    return {
      pageId: this.pageId,
      pageName: pageWithInstagram.name,
      instagramAccountId: this.instagramBusinessAccountId,
      instagramUsername: pageWithInstagram.instagram_business_account.username,
      instagramName: pageWithInstagram.instagram_business_account.name,
    };
  }

  private ensureInitialized(): void {
    if (!this.pageAccessToken || !this.pageId) {
      throw new Error('Instagram not initialized. Call initialize() first.');
    }
  }
}

export const instagramService = new InstagramServiceClass();
```

### Pattern 2: IPC Handler Namespace (matches existing pattern)
**What:** All IPC handlers prefixed with `instagram:`
**When to use:** Every renderer-to-main communication for Instagram
**Example:**
```typescript
// Source: existing ipc.ts pattern
ipcMain.handle('instagram:authenticate', async () => {
  return instagramAuthService.authenticate();
});

ipcMain.handle('instagram:isAuthenticated', async () => {
  return instagramAuthService.isAuthenticated();
});

ipcMain.handle('instagram:getConversations', async (_, limit?: number) => {
  return instagramService.getConversations(limit);
});

ipcMain.handle('instagram:getMessages', async (_, conversationId: string, limit?: number) => {
  return instagramService.getMessages(conversationId, limit);
});

ipcMain.handle('instagram:sendMessage', async (_, recipientId: string, text: string) => {
  return instagramService.sendMessage(recipientId, text);
});

ipcMain.handle('instagram:disconnect', async () => {
  return instagramAuthService.disconnect();
});
```

### Pattern 3: Preload API Exposure (matches existing pattern)
**What:** Expose Instagram API on `window.electron.instagram` object
**When to use:** All renderer-side Instagram access
**Example:**
```typescript
// Source: existing preload.ts pattern
instagram: {
  // Auth
  authenticate: () => ipcRenderer.invoke('instagram:authenticate'),
  isAuthenticated: () => ipcRenderer.invoke('instagram:isAuthenticated'),
  getAccountInfo: () => ipcRenderer.invoke('instagram:getAccountInfo'),
  disconnect: () => ipcRenderer.invoke('instagram:disconnect'),
  // Data
  getConversations: (limit?: number) => ipcRenderer.invoke('instagram:getConversations', limit),
  getMessages: (conversationId: string, limit?: number) => ipcRenderer.invoke('instagram:getMessages', conversationId, limit),
  // Send
  sendMessage: (recipientId: string, text: string) => ipcRenderer.invoke('instagram:sendMessage', recipientId, text),
}
```

### Pattern 4: 24-Hour Window Tracking (Instagram-specific)
**What:** Client-side calculation of messaging window status from last user message timestamp
**When to use:** Every conversation display and before send attempts
**Example:**
```typescript
// Source: CONTEXT.md requirements + existing research
interface WindowStatus {
  isOpen: boolean;           // Can send standard message
  hoursRemaining: number;    // Hours until window closes
  minutesRemaining: number;  // Minutes component
  expiresAt: Date;           // Absolute expiry time
  urgency: 'normal' | 'warning' | 'expired';  // UI color hint
}

function calculateWindowStatus(lastUserMessageTime: Date): WindowStatus {
  const now = new Date();
  const msRemaining = lastUserMessageTime.getTime() + 24 * 60 * 60 * 1000 - now.getTime();
  const hoursRemaining = Math.max(0, msRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.max(0, (msRemaining % (1000 * 60 * 60)) / (1000 * 60));

  let urgency: WindowStatus['urgency'] = 'normal';
  if (hoursRemaining <= 0) {
    urgency = 'expired';
  } else if (hoursRemaining < 1) {
    urgency = 'warning';  // Orange/red when <1 hour per CONTEXT.md
  }

  return {
    isOpen: hoursRemaining > 0,
    hoursRemaining: Math.floor(hoursRemaining),
    minutesRemaining: Math.floor(minutesRemaining),
    expiresAt: new Date(lastUserMessageTime.getTime() + 24 * 60 * 60 * 1000),
    urgency,
  };
}
```

### Anti-Patterns to Avoid
- **Using localhost for OAuth redirect:** Facebook no longer accepts localhost; use `https://www.facebook.com/connect/login_success.html`
- **Storing Page Access Token in renderer:** Keep all auth logic in main process
- **Polling for window expiry:** Calculate client-side, use timers for UI updates
- **Sending without checking window:** Always verify window status before attempting send
- **Using HUMAN_AGENT tag programmatically:** Meta policy violation - only for manual human agents

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token encryption | Custom crypto | Electron safeStorage | OS-level keychain integration |
| Token refresh scheduling | Manual timers | Store expiry timestamp, check on app start | Simpler, survives app restart |
| Window expiry calculation | Server-side tracking | Client-side from `lastUserMessageTime` | Real-time, no API calls |
| Rate limiting | Simple counter | Sliding window with timestamps | Matches Instagram's rolling hour window |
| HTTP requests | raw fetch | axios | Better error handling, interceptors |

**Key insight:** Instagram API is simpler than Gmail - no MIME encoding, no threading headers. Focus on the 24-hour window UX and proper error handling.

## Common Pitfalls

### Pitfall 1: Facebook OAuth redirect fails with localhost
**What goes wrong:** OAuth callback never reaches the app
**Why it happens:** Facebook deprecated localhost as valid redirect URI
**How to avoid:** Use `https://www.facebook.com/connect/login_success.html` and intercept with `will-redirect` event
**Warning signs:** "Invalid redirect_uri" error in browser

### Pitfall 2: Missing Page Access Token vs User Access Token
**What goes wrong:** API calls fail with permission errors
**Why it happens:** User token from OAuth flow cannot access Instagram DMs directly
**How to avoid:** Exchange user token for Page Access Token via `/me/accounts` endpoint
**Warning signs:** Error 200 "permission denied" on conversation fetch

### Pitfall 3: No Instagram Business Account linked
**What goes wrong:** Cannot find Instagram account in Pages response
**Why it happens:** Instagram account is personal or not linked to Facebook Page
**How to avoid:** Check for `instagram_business_account` field, show clear error with setup instructions
**Warning signs:** Empty conversations, missing `instagram_business_account` in API response

### Pitfall 4: Sending to expired window
**What goes wrong:** API returns error, message not sent
**Why it happens:** 24-hour window closed, UI didn't reflect this
**How to avoid:** Track `lastUserMessageTime` for each conversation, disable send when expired
**Warning signs:** Error code 10 "(#10) This message is sent outside of allowed window"

### Pitfall 5: Rate limit exhaustion
**What goes wrong:** All API calls fail for up to an hour
**Why it happens:** 200 requests/hour limit reached (down from 5,000 in 2026)
**How to avoid:** Implement request throttling, cache aggressively, batch where possible
**Warning signs:** Error 429 or rate limit headers showing high usage

### Pitfall 6: Token expires after 60 days
**What goes wrong:** App stops working, user must re-authenticate
**Why it happens:** Long-lived tokens have 60-day expiry, not refreshed
**How to avoid:** Store expiry timestamp, refresh proactively (e.g., at 50 days), or prompt user
**Warning signs:** Error 190 "Invalid/expired access token"

### Pitfall 7: Attachment URLs expire after 7 days
**What goes wrong:** Images in old conversations show as broken
**Why it happens:** Media URLs from Instagram API expire
**How to avoid:** Either cache media locally or accept broken images for old messages
**Warning signs:** 404 errors when loading attachment URLs

## Code Examples

Verified patterns from official sources and existing phoebeOS patterns:

### Facebook OAuth Flow with Success Page Redirect
```typescript
// Source: ELECTRON-INSTAGRAM.md + Facebook OAuth docs
import { BrowserWindow, shell } from 'electron';
import ElectronStore from 'electron-store';
import { safeStorage } from 'electron';
import axios from 'axios';
import * as crypto from 'crypto';

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const REDIRECT_URI = 'https://www.facebook.com/connect/login_success.html';

const SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement'
].join(',');

interface InstagramTokens {
  accessToken: string;
  expiresAt: number;  // Unix timestamp
}

const store = new ElectronStore<{ instagram_tokens?: string | Buffer; instagram_tokens_encrypted?: boolean }>({ name: 'instagram-auth' });

async function authenticate(): Promise<InstagramTokens> {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
      `client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${SCOPES}` +
      `&response_type=code` +
      `&state=${state}`;

    const authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.loadURL(authUrl);

    // Intercept redirect to success page
    authWindow.webContents.on('will-redirect', async (event, url) => {
      if (url.startsWith(REDIRECT_URI)) {
        event.preventDefault();

        const urlParams = new URL(url);
        const code = urlParams.searchParams.get('code');
        const returnedState = urlParams.searchParams.get('state');
        const error = urlParams.searchParams.get('error');

        if (error) {
          authWindow.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (returnedState !== state) {
          authWindow.close();
          reject(new Error('State mismatch'));
          return;
        }

        if (code) {
          try {
            const tokens = await exchangeCodeForToken(code);
            authWindow.close();
            resolve(tokens);
          } catch (error) {
            authWindow.close();
            reject(error);
          }
        }
      }
    });

    authWindow.on('closed', () => {
      reject(new Error('Authentication window closed'));
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!authWindow.isDestroyed()) {
        authWindow.close();
        reject(new Error('Authentication timeout'));
      }
    }, 5 * 60 * 1000);
  });
}

async function exchangeCodeForToken(code: string): Promise<InstagramTokens> {
  // Exchange code for short-lived token
  const tokenResponse = await axios.get(
    'https://graph.facebook.com/v19.0/oauth/access_token',
    {
      params: {
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code: code
      }
    }
  );

  const shortLivedToken = tokenResponse.data.access_token;

  // Exchange for long-lived token (60 days)
  const longLivedResponse = await axios.get(
    'https://graph.facebook.com/v19.0/oauth/access_token',
    {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        fb_exchange_token: shortLivedToken
      }
    }
  );

  const expiresIn = longLivedResponse.data.expires_in || 60 * 24 * 60 * 60; // Default 60 days
  return {
    accessToken: longLivedResponse.data.access_token,
    expiresAt: Date.now() + expiresIn * 1000
  };
}
```

### Token Storage with safeStorage (matches Gmail pattern)
```typescript
// Source: existing gmailAuthService.ts pattern
function saveTokens(tokens: InstagramTokens): void {
  const tokensJson = JSON.stringify(tokens);

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(tokensJson);
    store.set('instagram_tokens', encrypted);
    store.set('instagram_tokens_encrypted', true);
  } else {
    store.set('instagram_tokens', tokensJson);
    store.set('instagram_tokens_encrypted', false);
  }
}

function loadTokens(): InstagramTokens | null {
  const tokensData = store.get('instagram_tokens');
  if (!tokensData) return null;

  const isEncrypted = store.get('instagram_tokens_encrypted', false);

  try {
    let tokensJson: string;

    if (isEncrypted) {
      let buffer: Buffer;
      if (Buffer.isBuffer(tokensData)) {
        buffer = tokensData;
      } else if (typeof tokensData === 'object' && tokensData !== null &&
                 'type' in tokensData && (tokensData as any).type === 'Buffer') {
        buffer = Buffer.from((tokensData as any).data);
      } else {
        return null;
      }
      tokensJson = safeStorage.decryptString(buffer);
    } else if (typeof tokensData === 'string') {
      tokensJson = tokensData;
    } else {
      return null;
    }

    return JSON.parse(tokensJson);
  } catch {
    return null;
  }
}
```

### Get Instagram Conversations
```typescript
// Source: ELECTRON-INSTAGRAM.md + Graph API documentation
const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

interface InstagramConversation {
  id: string;
  recipientId: string;
  recipientUsername: string;
  recipientName: string | null;
  updatedTime: Date;
  lastMessage: {
    text: string | null;
    time: Date;
    fromUser: boolean;
  } | null;
  windowStatus: WindowStatus;
}

async function getConversations(limit = 25): Promise<InstagramConversation[]> {
  const response = await axios.get(
    `${GRAPH_API_BASE}/${this.pageId}/conversations`,
    {
      params: {
        platform: 'instagram',
        access_token: this.pageAccessToken,
        fields: 'id,participants,updated_time,messages.limit(1){message,created_time,from}',
        limit
      }
    }
  );

  return response.data.data.map((conv: any) => {
    const lastMessage = conv.messages?.data?.[0];
    const otherParticipant = conv.participants?.data?.find(
      (p: any) => p.id !== this.instagramBusinessAccountId
    );

    // Determine if last message was from user (for window calculation)
    const lastMessageFromUser = lastMessage?.from?.id !== this.instagramBusinessAccountId;
    const lastUserMessageTime = lastMessageFromUser
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
      windowStatus: lastUserMessageTime
        ? calculateWindowStatus(lastUserMessageTime)
        : { isOpen: false, hoursRemaining: 0, minutesRemaining: 0, expiresAt: new Date(0), urgency: 'expired' as const },
    };
  });
}
```

### Get Messages in a Conversation
```typescript
// Source: ELECTRON-INSTAGRAM.md
interface InstagramMessage {
  id: string;
  text: string | null;
  time: Date;
  fromUser: boolean;
  from: { id: string; username?: string; name?: string };
  attachments: InstagramAttachment[];
}

interface InstagramAttachment {
  type: 'image' | 'video' | 'audio' | 'share' | 'story_mention' | 'story_reply';
  url?: string;        // For media
  title?: string;      // For shares
  thumbnailUrl?: string;
}

async function getMessages(conversationId: string, limit = 50): Promise<InstagramMessage[]> {
  const response = await axios.get(
    `${GRAPH_API_BASE}/${conversationId}`,
    {
      params: {
        access_token: this.pageAccessToken,
        fields: `messages.limit(${limit}){id,message,created_time,from,attachments}`
      }
    }
  );

  return (response.data.messages?.data || []).map((msg: any) => ({
    id: msg.id,
    text: msg.message || null,
    time: new Date(msg.created_time),
    fromUser: msg.from?.id !== this.instagramBusinessAccountId,
    from: msg.from || { id: 'unknown' },
    attachments: (msg.attachments?.data || []).map((att: any) => ({
      type: att.type || 'image',
      url: att.payload?.url,
      title: att.title,
      thumbnailUrl: att.thumbnail_url,
    })),
  }));
}
```

### Send Message (Within 24-Hour Window)
```typescript
// Source: ELECTRON-INSTAGRAM.md + Graph API Send API
interface SendResult {
  success: boolean;
  messageId?: string;
  recipientId?: string;
  error?: string;
  errorCode?: string;
}

async function sendMessage(recipientId: string, text: string): Promise<SendResult> {
  // Enforce character limit per CONTEXT.md (~1000 chars)
  if (text.length > 1000) {
    return {
      success: false,
      error: 'Message exceeds 1000 character limit',
      errorCode: 'MESSAGE_TOO_LONG'
    };
  }

  try {
    const response = await axios.post(
      `${GRAPH_API_BASE}/${this.pageId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text },
        messaging_type: 'RESPONSE'
      },
      {
        params: { access_token: this.pageAccessToken }
      }
    );

    return {
      success: true,
      messageId: response.data.message_id,
      recipientId: response.data.recipient_id
    };
  } catch (error: any) {
    const fbError = error.response?.data?.error;

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
```

### Rate Limiter (200 requests/hour)
```typescript
// Source: ELECTRON-INSTAGRAM.md rate limits section
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 180;  // Leave 20 buffer
  private readonly windowMs = 60 * 60 * 1000;  // 1 hour

  async throttle(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s`);
      await new Promise(r => setTimeout(r, waitTime + 100));
      return this.throttle();
    }

    this.requests.push(now);
  }

  getStatus(): { used: number; remaining: number } {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    return {
      used: this.requests.length,
      remaining: this.maxRequests - this.requests.length
    };
  }
}
```

### Countdown Badge Component
```typescript
// Source: CONTEXT.md requirements
interface CountdownBadgeProps {
  windowStatus: WindowStatus;
}

function CountdownBadge({ windowStatus }: CountdownBadgeProps) {
  const { isOpen, hoursRemaining, minutesRemaining, urgency } = windowStatus;

  if (!isOpen) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">
        Expired
      </span>
    );
  }

  const bgColor = urgency === 'warning' ? 'bg-orange-500/20' : 'bg-green-500/20';
  const textColor = urgency === 'warning' ? 'text-orange-400' : 'text-green-400';

  const timeText = hoursRemaining > 0
    ? `${hoursRemaining}h ${Math.floor(minutesRemaining)}m left`
    : `${Math.floor(minutesRemaining)}m left`;

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${bgColor} ${textColor}`}>
      {timeText}
    </span>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 5,000 API calls/hour | 200 API calls/hour | January 2026 | 96% reduction, caching essential |
| Basic Display API for personal | Graph API Business/Creator only | December 2024 | Personal accounts no longer supported |
| localhost OAuth redirect | Facebook success page redirect | 2024 | Electron OAuth flow changed |
| Manual token refresh | Store expiry, refresh proactively | Best practice | Prevents auth failures |

**Deprecated/outdated:**
- **Basic Display API:** Deprecated December 4, 2024 - no more personal account access
- **localhost OAuth:** Facebook no longer accepts localhost redirect URIs
- **High rate limits:** 5,000/hour reduced to 200/hour in January 2026

## Open Questions

Things that couldn't be fully resolved:

1. **App Review requirement for production**
   - What we know: `instagram_manage_messages` requires Advanced Access via App Review
   - What's unclear: Whether to ship app without production approval or document the review process
   - Recommendation: Document as user-required setup for now; consider embedded credentials with published app later

2. **Story reply and media share structure**
   - What we know: Webhook notifications include story_reply and story_mention event types
   - What's unclear: Exact attachment payload structure for shared posts/reels/stories
   - Recommendation: Per CONTEXT.md, show thumbnail + "Open in Instagram" link; fetch actual structure during implementation

3. **Profile picture access**
   - What we know: `instagram_business_account` can include `profile_picture_url`
   - What's unclear: Whether this requires additional permissions or fields
   - Recommendation: Per CONTEXT.md, defer profile pictures for now; use default avatar fallback

4. **Token refresh mechanism**
   - What we know: Long-lived tokens expire after 60 days, can refresh after 24 hours
   - What's unclear: Best UX for proactive refresh vs re-authentication prompt
   - Recommendation: Store expiry timestamp, attempt silent refresh at 50 days, prompt user if refresh fails

## Sources

### Primary (HIGH confidence)
- Existing `.planning/research/ELECTRON-INSTAGRAM.md` (comprehensive, verified)
- [Elfsight: Instagram Graph API Complete Developer Guide for 2025](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2025/)
- [CM.com: Instagram Messaging API Docs](https://developers.cm.com/messaging/docs/instagram-messaging)

### Secondary (MEDIUM confidence)
- [GitHub: oauth-electron-facebook](https://github.com/kanekotic/oauth-electron-facebook) (OAuth pattern reference)
- [Manychat: Sending messages outside 24-hour windows](https://help.manychat.com/hc/en-us/articles/14281199732892-How-to-send-messages-outside-the-24-hour-and-7-day-windows-in-Messenger-and-Instagram)
- [Chatwoot: Instagram App Review Developer Docs](https://developers.chatwoot.com/self-hosted/instagram-app-review)
- [GetLate: Instagram API 2026 Complete Developer Guide](https://getlate.dev/blog/instagram-api)

### Tertiary (LOW confidence)
- WebSearch results for attachment structures and webhook formats (need implementation verification)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - axios is standard, matches existing pattern
- Architecture: HIGH - mirrors Gmail implementation exactly
- OAuth flow: HIGH - Facebook success page redirect is well-documented
- Conversation/Message API: HIGH - verified in existing research
- 24-hour window: HIGH - core policy, well-documented
- Attachment handling: MEDIUM - structure needs implementation verification
- Rate limits: HIGH - 200/hour confirmed for January 2026

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (stable APIs, 30-day validity)
