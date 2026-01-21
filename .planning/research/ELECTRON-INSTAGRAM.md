# Instagram Graph API Messenger Integration for Electron/Node.js

**Researched:** 2026-01-20
**Confidence:** MEDIUM (Official API documentation unavailable via WebFetch; findings synthesized from multiple credible sources)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Account Setup Requirements](#account-setup-requirements)
3. [OAuth Flow for Electron](#oauth-flow-for-electron)
4. [Reading DM Conversations and Messages](#reading-dm-conversations-and-messages)
5. [24-Hour Messaging Window](#24-hour-messaging-window)
6. [Sending Text Replies](#sending-text-replies)
7. [Detecting Expired Conversations](#detecting-expired-conversations)
8. [Rate Limits and Best Practices](#rate-limits-and-best-practices)
9. [Complete Code Examples](#complete-code-examples)
10. [Limitations Summary](#limitations-summary)
11. [Sources](#sources)

---

## Executive Summary

The Instagram Graph API (built on Facebook's Graph API) allows Business and Creator accounts to programmatically manage Instagram DMs. Key points:

- **Only Business/Creator accounts** can use the API (personal accounts not supported since Basic Display API EOL on December 4, 2024)
- **Facebook Page linkage required** - Instagram account must be connected to a Facebook Page
- **24-hour messaging window** - You can only reply to users within 24 hours of their last message
- **7-day human agent window** - With HUMAN_AGENT tag, human agents can reply up to 7 days
- **Rate limit: 200 requests/hour** per Instagram account (reduced from 5,000 in January 2026)
- **App Review required** for production use with `instagram_manage_messages` permission

---

## Account Setup Requirements

### Prerequisites

1. **Facebook Developer Account**
   - Create at https://developers.facebook.com

2. **Facebook Page**
   - Must have admin access to a Facebook Page

3. **Instagram Business or Creator Account**
   - Convert personal account to Business/Creator in Instagram settings
   - **Creator accounts with >500k followers must use Business account**

4. **Link Instagram to Facebook Page**
   - Instagram Settings > Account > Linked Accounts > Facebook
   - Select the Facebook Page to link

### Facebook App Setup

```
1. Go to https://developers.facebook.com
2. Create New App > Select "Business" type
3. Add Products:
   - Facebook Login
   - Instagram Graph API
   - Webhooks (for real-time message notifications)
4. Configure OAuth Redirect URIs
5. Request Permissions (see below)
```

### Required Permissions

| Permission | Access Level | Purpose |
|------------|--------------|---------|
| `instagram_basic` | Standard | Read Instagram account info |
| `instagram_manage_messages` | **Advanced** | Read/send DMs |
| `pages_manage_metadata` | **Advanced** | Manage Page settings |
| `pages_show_list` | Standard | List user's Pages |
| `pages_read_engagement` | Standard | Read Page conversations |

**IMPORTANT:** `instagram_manage_messages` requires Advanced Access, which requires App Review.

### App Review Process

For production use beyond test users:

1. Navigate to App Review > Permissions and Features
2. Request Advanced Access for required permissions
3. Provide:
   - Detailed use case description
   - Video demonstration of functionality
   - Privacy policy URL
   - Human agent escalation path documentation
4. Review takes 5-10 business days

---

## OAuth Flow for Electron

### Challenge: Localhost Not Supported

Facebook OAuth does not accept `localhost` as a redirect URI anymore. For Electron apps, use one of these approaches:

### Option 1: Facebook Success Page Redirect (Recommended)

Use Facebook's built-in success page as redirect URI:

```javascript
// electron/auth/instagram-oauth.js
const { BrowserWindow } = require('electron');
const axios = require('axios');

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

async function authenticateInstagram() {
  return new Promise((resolve, reject) => {
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
      `client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${SCOPES}` +
      `&response_type=code`;

    const authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.loadURL(authUrl);

    // Listen for redirect to success page
    authWindow.webContents.on('will-redirect', async (event, url) => {
      if (url.startsWith(REDIRECT_URI)) {
        event.preventDefault();

        const urlParams = new URL(url);
        const code = urlParams.searchParams.get('code');

        if (code) {
          try {
            const tokens = await exchangeCodeForToken(code);
            authWindow.close();
            resolve(tokens);
          } catch (error) {
            authWindow.close();
            reject(error);
          }
        } else {
          const error = urlParams.searchParams.get('error');
          authWindow.close();
          reject(new Error(error || 'Authentication failed'));
        }
      }
    });

    authWindow.on('closed', () => {
      reject(new Error('Authentication window closed'));
    });
  });
}

async function exchangeCodeForToken(code) {
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

  return {
    accessToken: longLivedResponse.data.access_token,
    expiresIn: longLivedResponse.data.expires_in // ~60 days in seconds
  };
}

module.exports = { authenticateInstagram };
```

### Option 2: Local HTTPS Server with Self-Signed Certificate

```javascript
// For development/testing only
const https = require('https');
const fs = require('fs');

// Generate self-signed cert: openssl req -nodes -new -x509 -keyout server.key -out server.cert
const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
};

const server = https.createServer(options, (req, res) => {
  const url = new URL(req.url, `https://localhost:8443`);
  const code = url.searchParams.get('code');

  if (code) {
    // Handle the code exchange
    res.writeHead(200);
    res.end('Authentication successful! You can close this window.');
    // Emit event or callback with code
  }
});

server.listen(8443);
// Add https://localhost:8443/callback to Valid OAuth Redirect URIs
```

### Getting Page Access Token and Instagram Business Account ID

After OAuth, you need to get the Page Access Token and Instagram Business Account ID:

```javascript
// lib/instagram-api.js
const axios = require('axios');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

class InstagramAPI {
  constructor(userAccessToken) {
    this.userAccessToken = userAccessToken;
    this.pageAccessToken = null;
    this.pageId = null;
    this.instagramBusinessAccountId = null;
  }

  async initialize() {
    // Get user's Pages
    const pagesResponse = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: {
        access_token: this.userAccessToken,
        fields: 'id,name,access_token,instagram_business_account'
      }
    });

    const pages = pagesResponse.data.data;

    // Find a page with Instagram Business Account linked
    const pageWithInstagram = pages.find(p => p.instagram_business_account);

    if (!pageWithInstagram) {
      throw new Error('No Facebook Page with linked Instagram Business Account found');
    }

    this.pageId = pageWithInstagram.id;
    this.pageAccessToken = pageWithInstagram.access_token;
    this.instagramBusinessAccountId = pageWithInstagram.instagram_business_account.id;

    return {
      pageId: this.pageId,
      pageName: pageWithInstagram.name,
      instagramBusinessAccountId: this.instagramBusinessAccountId
    };
  }
}

module.exports = InstagramAPI;
```

### Token Refresh Strategy

Long-lived tokens expire after 60 days. Implement auto-refresh:

```javascript
async function refreshLongLivedToken(currentToken) {
  // Can refresh anytime after 24 hours from issuance
  const response = await axios.get(
    `${GRAPH_API_BASE}/oauth/access_token`,
    {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        fb_exchange_token: currentToken
      }
    }
  );

  return {
    accessToken: response.data.access_token,
    expiresIn: response.data.expires_in
  };
}

// Schedule refresh at 50-55 days to prevent expiration
function scheduleTokenRefresh(tokenData, onRefresh) {
  const refreshMs = (tokenData.expiresIn - 5 * 24 * 60 * 60) * 1000; // 5 days before expiry

  setTimeout(async () => {
    const newTokenData = await refreshLongLivedToken(tokenData.accessToken);
    onRefresh(newTokenData);
    scheduleTokenRefresh(newTokenData, onRefresh);
  }, refreshMs);
}
```

---

## Reading DM Conversations and Messages

### Get All Conversations

```javascript
async getConversations(limit = 25) {
  const response = await axios.get(
    `${GRAPH_API_BASE}/${this.pageId}/conversations`,
    {
      params: {
        platform: 'instagram',
        access_token: this.pageAccessToken,
        fields: 'id,participants,updated_time,messages.limit(1){message,created_time,from}',
        limit: limit
      }
    }
  );

  return response.data.data.map(conv => ({
    id: conv.id,
    participants: conv.participants?.data || [],
    updatedTime: conv.updated_time,
    lastMessage: conv.messages?.data?.[0] || null
  }));
}
```

### Get Messages in a Conversation

```javascript
async getMessages(conversationId, limit = 50) {
  // First, get message IDs
  const response = await axios.get(
    `${GRAPH_API_BASE}/${conversationId}`,
    {
      params: {
        access_token: this.pageAccessToken,
        fields: 'messages.limit(' + limit + '){id,message,created_time,from,to}'
      }
    }
  );

  return response.data.messages?.data || [];
}

// Alternative: Get individual message details
async getMessageDetails(messageId) {
  const response = await axios.get(
    `${GRAPH_API_BASE}/${messageId}`,
    {
      params: {
        access_token: this.pageAccessToken,
        fields: 'id,message,created_time,from,to,attachments'
      }
    }
  );

  return response.data;
}
```

### Response Structure

```javascript
// Conversation response example
{
  "id": "t_123456789",
  "participants": {
    "data": [
      { "id": "17841400000000001", "username": "user123" },
      { "id": "17841400000000002", "username": "yourbusiness" }
    ]
  },
  "updated_time": "2026-01-20T10:30:00+0000",
  "messages": {
    "data": [
      {
        "id": "m_abc123",
        "message": "Hello, I have a question",
        "created_time": "2026-01-20T10:30:00+0000",
        "from": { "id": "17841400000000001", "username": "user123" }
      }
    ]
  }
}
```

---

## 24-Hour Messaging Window

### How It Works

| Scenario | Window Status | Can Send Message? |
|----------|---------------|-------------------|
| User sent message < 24 hours ago | **Open** | YES - Any content including promotional |
| User sent message 24-168 hours ago | **Human Agent Only** | YES - With HUMAN_AGENT tag, non-promotional only |
| User sent message > 7 days ago | **Closed** | NO - Must wait for user to message again |
| User never messaged | **Never opened** | NO - Cannot initiate conversations |

### Window Reset Rules

- Window resets each time user sends a new message
- Clicking quick reply buttons resets window
- Clicking "Shop Now" or website links does NOT reset window (user leaves Instagram)

### HUMAN_AGENT Tag

For messages outside 24 hours but within 7 days:

```javascript
async sendHumanAgentMessage(recipientId, messageText) {
  // IMPORTANT: Only human agents can use this, not automation
  // Must be manually sent by a person, not automated
  const response = await axios.post(
    `${GRAPH_API_BASE}/${this.pageId}/messages`,
    {
      recipient: { id: recipientId },
      message: { text: messageText },
      messaging_type: 'MESSAGE_TAG',
      tag: 'HUMAN_AGENT'
    },
    {
      params: { access_token: this.pageAccessToken }
    }
  );

  return response.data;
}
```

**CRITICAL:** Using HUMAN_AGENT tag for automated messages violates Meta policy and can result in account restrictions.

---

## Sending Text Replies

### Basic Reply Within 24-Hour Window

```javascript
async sendMessage(recipientId, messageText) {
  try {
    const response = await axios.post(
      `${GRAPH_API_BASE}/${this.pageId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: messageText },
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
  } catch (error) {
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;

      // Handle specific error codes
      if (fbError.code === 10 || fbError.error_subcode === 2018278) {
        // Message window expired
        return {
          success: false,
          error: 'MESSAGE_WINDOW_EXPIRED',
          message: 'Cannot message user - 24-hour window has expired'
        };
      }
    }
    throw error;
  }
}
```

### Send Message with Quick Replies

```javascript
async sendMessageWithQuickReplies(recipientId, messageText, quickReplies) {
  const response = await axios.post(
    `${GRAPH_API_BASE}/${this.pageId}/messages`,
    {
      recipient: { id: recipientId },
      message: {
        text: messageText,
        quick_replies: quickReplies.map(qr => ({
          content_type: 'text',
          title: qr.title,
          payload: qr.payload
        }))
      },
      messaging_type: 'RESPONSE'
    },
    {
      params: { access_token: this.pageAccessToken }
    }
  );

  return response.data;
}

// Usage
await api.sendMessageWithQuickReplies(
  recipientId,
  'How can I help you today?',
  [
    { title: 'Track Order', payload: 'TRACK_ORDER' },
    { title: 'Returns', payload: 'RETURNS' },
    { title: 'Other', payload: 'OTHER' }
  ]
);
```

### Send Image Attachment

```javascript
async sendImage(recipientId, imageUrl) {
  const response = await axios.post(
    `${GRAPH_API_BASE}/${this.pageId}/messages`,
    {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'image',
          payload: { url: imageUrl }
        }
      },
      messaging_type: 'RESPONSE'
    },
    {
      params: { access_token: this.pageAccessToken }
    }
  );

  return response.data;
}
```

---

## Detecting Expired Conversations

### Method 1: Track Last Message Timestamp

```javascript
function isMessageWindowOpen(lastUserMessageTime) {
  const now = new Date();
  const lastMessage = new Date(lastUserMessageTime);
  const hoursSinceLastMessage = (now - lastMessage) / (1000 * 60 * 60);

  return {
    standardWindowOpen: hoursSinceLastMessage < 24,
    humanAgentWindowOpen: hoursSinceLastMessage < 168, // 7 days
    hoursSinceLastMessage: Math.floor(hoursSinceLastMessage),
    windowExpiresAt: new Date(lastMessage.getTime() + 24 * 60 * 60 * 1000)
  };
}

// Usage with conversation data
async function checkConversationStatus(conversationId) {
  const messages = await api.getMessages(conversationId, 50);

  // Find last message FROM the user (not from our business)
  const lastUserMessage = messages.find(msg =>
    msg.from.id !== api.instagramBusinessAccountId
  );

  if (!lastUserMessage) {
    return { canMessage: false, reason: 'No user messages found' };
  }

  const windowStatus = isMessageWindowOpen(lastUserMessage.created_time);

  return {
    canMessage: windowStatus.standardWindowOpen,
    canUseHumanAgent: windowStatus.humanAgentWindowOpen,
    lastUserMessageTime: lastUserMessage.created_time,
    ...windowStatus
  };
}
```

### Method 2: Try to Send and Handle Error

```javascript
async function trySendMessage(recipientId, messageText) {
  try {
    const result = await api.sendMessage(recipientId, messageText);
    return { sent: true, ...result };
  } catch (error) {
    const fbError = error.response?.data?.error;

    if (fbError?.code === 10) {
      // (#10) This message is sent outside of allowed window
      return {
        sent: false,
        windowExpired: true,
        error: 'Message window expired. User must message first.'
      };
    }

    if (fbError?.code === 200) {
      // (#200) Requires instagram_manage_messages permission
      return {
        sent: false,
        permissionError: true,
        error: 'Missing instagram_manage_messages permission'
      };
    }

    throw error;
  }
}
```

### Proactive Window Tracking

```javascript
class ConversationWindowTracker {
  constructor() {
    this.conversations = new Map(); // conversationId -> { lastUserMessage, recipientId }
  }

  updateFromMessage(conversationId, message, isFromUser) {
    if (isFromUser) {
      this.conversations.set(conversationId, {
        lastUserMessage: new Date(message.created_time),
        recipientId: message.from.id
      });
    }
  }

  getWindowStatus(conversationId) {
    const conv = this.conversations.get(conversationId);
    if (!conv) return { known: false };

    return {
      known: true,
      ...isMessageWindowOpen(conv.lastUserMessage)
    };
  }

  // Get all conversations with expiring windows (for alerts)
  getExpiringConversations(withinHours = 4) {
    const expiring = [];
    const now = new Date();

    for (const [convId, data] of this.conversations) {
      const windowEnd = new Date(data.lastUserMessage.getTime() + 24 * 60 * 60 * 1000);
      const hoursUntilExpiry = (windowEnd - now) / (1000 * 60 * 60);

      if (hoursUntilExpiry > 0 && hoursUntilExpiry <= withinHours) {
        expiring.push({
          conversationId: convId,
          recipientId: data.recipientId,
          hoursRemaining: Math.floor(hoursUntilExpiry),
          expiresAt: windowEnd
        });
      }
    }

    return expiring.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
  }
}
```

---

## Rate Limits and Best Practices

### Current Rate Limits (as of January 2026)

| Limit Type | Value | Notes |
|------------|-------|-------|
| API calls per hour | **200** per Instagram account | Reduced from 5,000 (96% reduction) |
| Automated DMs per hour | **200** | Rolling 60-minute window |
| Automated DMs per user per 24h | **1** | From comment/Story triggers |
| Send API (high-volume) | Up to 100/second | For approved high-volume apps |

### Rate Limit Headers

```javascript
// Check rate limit status from response headers
function checkRateLimitStatus(response) {
  const usageHeader = response.headers['x-business-use-case-usage'];

  if (usageHeader) {
    const usage = JSON.parse(usageHeader);
    // Structure: { "instagram_account_id": [{ call_count, total_cputime, total_time, ... }] }

    for (const [accountId, limits] of Object.entries(usage)) {
      const limit = limits[0];
      return {
        accountId,
        callCount: limit.call_count,
        totalCpuTime: limit.total_cputime,
        totalTime: limit.total_time,
        estimatedTimeToRegainAccess: limit.estimated_time_to_regain_access
      };
    }
  }

  return null;
}
```

### Rate Limiting Implementation

```javascript
class RateLimiter {
  constructor(maxRequests = 200, windowMs = 60 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();

    // Remove requests outside the window
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);

      console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime + 100));

      return this.throttle(); // Retry after waiting
    }

    this.requests.push(now);
    return true;
  }

  getStatus() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    return {
      used: this.requests.length,
      remaining: this.maxRequests - this.requests.length,
      resetsIn: this.requests.length > 0
        ? Math.ceil((this.windowMs - (now - this.requests[0])) / 1000)
        : 0
    };
  }
}

// Usage
const rateLimiter = new RateLimiter(200, 60 * 60 * 1000);

async function makeApiCall(fn) {
  await rateLimiter.throttle();
  return fn();
}
```

### Best Practices

1. **Request Only Needed Fields**
   ```javascript
   // Good - specific fields
   fields: 'id,message,created_time,from'

   // Bad - fetches everything
   fields: '' // or omitting fields param
   ```

2. **Use Webhooks Instead of Polling**
   - Subscribe to `messages` webhook field
   - Reduces API calls significantly
   - Real-time updates

3. **Implement Caching**
   ```javascript
   const conversationCache = new Map();
   const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

   async function getConversationsCached() {
     const cached = conversationCache.get('conversations');
     if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
       return cached.data;
     }

     const data = await api.getConversations();
     conversationCache.set('conversations', { data, timestamp: Date.now() });
     return data;
   }
   ```

4. **Batch Requests Where Possible**
   ```javascript
   // Batch multiple message IDs in one request
   const messageIds = ['m_123', 'm_456', 'm_789'];
   const response = await axios.get(
     `${GRAPH_API_BASE}/?ids=${messageIds.join(',')}`,
     {
       params: {
         access_token: pageAccessToken,
         fields: 'id,message,created_time,from'
       }
     }
   );
   ```

5. **Handle Errors Gracefully**
   ```javascript
   const ERROR_CODES = {
     10: 'Message window expired',
     100: 'Invalid parameter',
     190: 'Invalid/expired access token',
     200: 'Permission denied',
     429: 'Rate limited',
     2018278: 'Cannot message user'
   };
   ```

---

## Complete Code Examples

### Full InstagramAPI Class

```javascript
// lib/instagram-api.js
const axios = require('axios');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

class InstagramAPI {
  constructor(userAccessToken) {
    this.userAccessToken = userAccessToken;
    this.pageAccessToken = null;
    this.pageId = null;
    this.instagramBusinessAccountId = null;
    this.rateLimiter = new RateLimiter(180, 60 * 60 * 1000); // Leave buffer
  }

  async initialize() {
    const pagesResponse = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: {
        access_token: this.userAccessToken,
        fields: 'id,name,access_token,instagram_business_account'
      }
    });

    const pageWithInstagram = pagesResponse.data.data.find(
      p => p.instagram_business_account
    );

    if (!pageWithInstagram) {
      throw new Error('No Facebook Page with linked Instagram Business Account');
    }

    this.pageId = pageWithInstagram.id;
    this.pageAccessToken = pageWithInstagram.access_token;
    this.instagramBusinessAccountId = pageWithInstagram.instagram_business_account.id;

    return {
      pageId: this.pageId,
      pageName: pageWithInstagram.name,
      instagramAccountId: this.instagramBusinessAccountId
    };
  }

  async getConversations(limit = 25, cursor = null) {
    await this.rateLimiter.throttle();

    const params = {
      platform: 'instagram',
      access_token: this.pageAccessToken,
      fields: 'id,participants,updated_time,messages.limit(1){message,created_time,from}',
      limit
    };

    if (cursor) params.after = cursor;

    const response = await axios.get(
      `${GRAPH_API_BASE}/${this.pageId}/conversations`,
      { params }
    );

    return {
      conversations: response.data.data.map(this._formatConversation.bind(this)),
      paging: response.data.paging
    };
  }

  _formatConversation(conv) {
    const lastMessage = conv.messages?.data?.[0];
    const otherParticipant = conv.participants?.data?.find(
      p => p.id !== this.instagramBusinessAccountId
    );

    return {
      id: conv.id,
      recipientId: otherParticipant?.id,
      recipientName: otherParticipant?.name || otherParticipant?.username,
      updatedTime: conv.updated_time,
      lastMessage: lastMessage ? {
        text: lastMessage.message,
        time: lastMessage.created_time,
        fromUser: lastMessage.from?.id !== this.instagramBusinessAccountId
      } : null,
      windowStatus: lastMessage?.from?.id !== this.instagramBusinessAccountId
        ? this._checkWindow(lastMessage.created_time)
        : null
    };
  }

  _checkWindow(lastUserMessageTime) {
    const now = new Date();
    const lastMsg = new Date(lastUserMessageTime);
    const hours = (now - lastMsg) / (1000 * 60 * 60);

    return {
      standardOpen: hours < 24,
      humanAgentOpen: hours < 168,
      hoursRemaining: Math.max(0, 24 - hours),
      expiresAt: new Date(lastMsg.getTime() + 24 * 60 * 60 * 1000)
    };
  }

  async getMessages(conversationId, limit = 50) {
    await this.rateLimiter.throttle();

    const response = await axios.get(
      `${GRAPH_API_BASE}/${conversationId}`,
      {
        params: {
          access_token: this.pageAccessToken,
          fields: `messages.limit(${limit}){id,message,created_time,from,to,attachments}`
        }
      }
    );

    return (response.data.messages?.data || []).map(msg => ({
      id: msg.id,
      text: msg.message,
      time: msg.created_time,
      fromUser: msg.from?.id !== this.instagramBusinessAccountId,
      from: msg.from,
      to: msg.to,
      attachments: msg.attachments?.data || []
    }));
  }

  async sendMessage(recipientId, text, options = {}) {
    await this.rateLimiter.throttle();

    const payload = {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: options.humanAgent ? 'MESSAGE_TAG' : 'RESPONSE'
    };

    if (options.humanAgent) {
      payload.tag = 'HUMAN_AGENT';
    }

    if (options.quickReplies) {
      payload.message.quick_replies = options.quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title,
        payload: qr.payload
      }));
    }

    try {
      const response = await axios.post(
        `${GRAPH_API_BASE}/${this.pageId}/messages`,
        payload,
        { params: { access_token: this.pageAccessToken } }
      );

      return {
        success: true,
        messageId: response.data.message_id,
        recipientId: response.data.recipient_id
      };
    } catch (error) {
      return this._handleSendError(error);
    }
  }

  _handleSendError(error) {
    const fbError = error.response?.data?.error;

    if (!fbError) throw error;

    const errorMap = {
      10: { code: 'WINDOW_EXPIRED', message: 'Messaging window expired' },
      100: { code: 'INVALID_PARAM', message: 'Invalid parameter' },
      190: { code: 'TOKEN_EXPIRED', message: 'Access token expired' },
      200: { code: 'PERMISSION_DENIED', message: 'Permission denied' },
      429: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' }
    };

    const mapped = errorMap[fbError.code] || {
      code: 'UNKNOWN',
      message: fbError.message
    };

    return {
      success: false,
      error: mapped.code,
      message: mapped.message,
      details: fbError
    };
  }

  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }
}

class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.requests[0]);
      await new Promise(r => setTimeout(r, waitTime + 100));
      return this.throttle();
    }

    this.requests.push(now);
  }

  getStatus() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    return {
      used: this.requests.length,
      remaining: this.maxRequests - this.requests.length
    };
  }
}

module.exports = InstagramAPI;
```

### Webhook Handler for Real-time Messages

```javascript
// server/webhook-handler.js
const express = require('express');
const crypto = require('crypto');

const router = express.Router();
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

// Webhook verification (GET)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook events (POST)
router.post('/webhook', (req, res) => {
  // Verify signature
  const signature = req.headers['x-hub-signature-256'];
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Invalid webhook signature');
    return res.sendStatus(403);
  }

  const body = req.body;

  if (body.object === 'instagram') {
    body.entry.forEach(entry => {
      entry.messaging?.forEach(event => {
        handleMessagingEvent(event);
      });
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

function handleMessagingEvent(event) {
  const senderId = event.sender.id;
  const recipientId = event.recipient.id;
  const timestamp = event.timestamp;

  if (event.message) {
    // Received a message
    console.log('Message received:', {
      from: senderId,
      text: event.message.text,
      attachments: event.message.attachments,
      timestamp: new Date(timestamp)
    });

    // Emit event for your application to handle
    // This is where 24-hour window opens/resets
    emitNewMessage({
      conversationId: `${senderId}_${recipientId}`,
      senderId,
      message: event.message,
      timestamp,
      windowExpiresAt: new Date(timestamp + 24 * 60 * 60 * 1000)
    });
  }

  if (event.read) {
    // Message was read
    console.log('Message read at:', event.read.watermark);
  }

  if (event.delivery) {
    // Message was delivered
    console.log('Message delivered');
  }
}

module.exports = router;
```

### Electron Main Process Integration

```javascript
// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const Store = require('electron-store');
const InstagramAPI = require('./lib/instagram-api');
const { authenticateInstagram } = require('./auth/instagram-oauth');

const store = new Store({ encryptionKey: 'your-encryption-key' });
let instagramAPI = null;

// Initialize Instagram API with stored token
async function initializeInstagram() {
  const tokens = store.get('instagram_tokens');

  if (!tokens) {
    return { initialized: false, needsAuth: true };
  }

  // Check if token needs refresh
  if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
    try {
      const newTokens = await refreshToken(tokens.accessToken);
      store.set('instagram_tokens', {
        ...newTokens,
        expiresAt: new Date(Date.now() + newTokens.expiresIn * 1000)
      });
      tokens.accessToken = newTokens.accessToken;
    } catch (error) {
      return { initialized: false, needsAuth: true, error: 'Token refresh failed' };
    }
  }

  instagramAPI = new InstagramAPI(tokens.accessToken);

  try {
    const accountInfo = await instagramAPI.initialize();
    return { initialized: true, accountInfo };
  } catch (error) {
    return { initialized: false, error: error.message };
  }
}

// IPC Handlers
ipcMain.handle('instagram:auth', async () => {
  try {
    const tokens = await authenticateInstagram();
    store.set('instagram_tokens', {
      ...tokens,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000)
    });

    return initializeInstagram();
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('instagram:getConversations', async (event, { limit, cursor }) => {
  if (!instagramAPI) {
    return { error: 'Not authenticated' };
  }
  return instagramAPI.getConversations(limit, cursor);
});

ipcMain.handle('instagram:getMessages', async (event, { conversationId, limit }) => {
  if (!instagramAPI) {
    return { error: 'Not authenticated' };
  }
  return instagramAPI.getMessages(conversationId, limit);
});

ipcMain.handle('instagram:sendMessage', async (event, { recipientId, text, options }) => {
  if (!instagramAPI) {
    return { error: 'Not authenticated' };
  }
  return instagramAPI.sendMessage(recipientId, text, options);
});

ipcMain.handle('instagram:getRateLimitStatus', () => {
  if (!instagramAPI) {
    return { error: 'Not authenticated' };
  }
  return instagramAPI.getRateLimitStatus();
});

// App ready
app.whenReady().then(async () => {
  const status = await initializeInstagram();
  console.log('Instagram initialization:', status);

  // Create window...
});
```

---

## Limitations Summary

### Critical Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| **24-hour window** | Cannot message after 24 hours | Track timestamps, use HUMAN_AGENT tag (manual only) |
| **Cannot initiate conversations** | Business cannot message first | Wait for user to message |
| **200 req/hour rate limit** | 96% reduction from previous limits | Implement caching, use webhooks |
| **No group chats** | One-to-one only | N/A |
| **Business/Creator only** | Personal accounts not supported | Convert account type |
| **Facebook Page required** | Must link IG to FB Page | Create and link Page |
| **App Review required** | Advanced Access needs approval | Plan for 5-10 day review |

### API Limitations

| Feature | Supported? | Notes |
|---------|------------|-------|
| Read conversations | Yes | Requires `instagram_manage_messages` |
| Read messages | Yes | Can fetch message content, timestamps, sender |
| Send text replies | Yes | Within 24-hour window |
| Send images | Yes | URL-based attachments |
| Send quick replies | Yes | Up to 13 quick reply buttons |
| Send templates | Partial | Generic templates only |
| Read receipts | Yes | Via webhooks |
| Typing indicators | No | Not available |
| Reactions | No | Cannot send/receive reactions via API |
| Story replies | Yes | Received as messages with story reference |
| Voice messages | No | Cannot send; can receive as attachment |
| Video messages | Partial | Can send as attachment, limited support |

### Account Restrictions

- **Creator accounts > 500k followers** must switch to Business account
- **Basic Display API** deprecated December 4, 2024 - no more personal account access
- **Human Agent tag** cannot be used by automation - manual only
- **Promotional content** only allowed within 24-hour standard window

---

## Sources

- [Elfsight: Instagram Graph API Complete Developer Guide for 2025](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2025/)
- [CreatorFlow: Instagram DM Automation Guide 2026](https://creatorflow.so/guides/instagram-dm-automation)
- [CreatorFlow: Instagram API Rate Limits Explained](https://creatorflow.so/blog/instagram-api-rate-limits-explained/)
- [GetLate: Instagram API 2026 Complete Developer Guide](https://getlate.dev/blog/instagram-api)
- [Unipile: Instagram DM API Integration for SaaS](https://www.unipile.com/instagram-dm-api-integration-for-saas/)
- [Bot.Space: The Instagram DM API Ultimate Guide](https://www.bot.space/blog/the-instagram-dm-api-your-ultimate-guide-to-automation-sales-and-customer-loyalty-svpt5)
- [Chatwoot: Instagram App Review Developer Docs](https://developers.chatwoot.com/self-hosted/instagram-app-review)
- [Manychat: How to send messages outside 24-hour windows](https://help.manychat.com/hc/en-us/articles/14281199732892-How-to-send-messages-outside-the-24-hour-and-7-day-windows-in-Messenger-and-Instagram)
- [GitHub: oauth-electron-facebook](https://github.com/kanekotic/oauth-electron-facebook)
- [NPM: instagram-graph-api](https://www.npmjs.com/package/instagram-graph-api)
- [CM.com: Instagram Messaging API Docs](https://developers.cm.com/messaging/docs/instagram-messaging)
- [GitHub: fbsamples/graph-api-webhooks-samples](https://github.com/fbsamples/graph-api-webhooks-samples)
