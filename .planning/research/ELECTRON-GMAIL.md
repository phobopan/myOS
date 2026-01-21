# Gmail API Integration in Electron/Node.js

**Researched:** 2026-01-20
**Confidence:** HIGH (based on official Google documentation and googleapis library)

## Table of Contents

1. [googleapis Package Overview](#googleapis-package-overview)
2. [OAuth 2.0 Flow in Electron](#oauth-20-flow-in-electron)
3. [Token Storage and Refresh](#token-storage-and-refresh)
4. [Reading Primary Inbox Only](#reading-primary-inbox-only)
5. [Thread-Based Email Fetching](#thread-based-email-fetching)
6. [Sending Replies (Preserving Thread)](#sending-replies-preserving-thread)
7. [Handling Attachments](#handling-attachments)
8. [Complete Working Examples](#complete-working-examples)
9. [Sources](#sources)

---

## googleapis Package Overview

### Installation

```bash
npm install googleapis
# Or for Gmail-specific submodule:
npm install @googleapis/gmail
```

### Basic Setup

```javascript
import { google } from 'googleapis';

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://127.0.0.1:3000/oauth/callback'  // Loopback redirect
);

// Create Gmail client
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
```

### Required OAuth Scopes

| Scope | Permission Level |
|-------|------------------|
| `https://www.googleapis.com/auth/gmail.readonly` | Read-only access |
| `https://www.googleapis.com/auth/gmail.modify` | Read, send, delete, manage labels |
| `https://www.googleapis.com/auth/gmail.compose` | Create and send messages |
| `https://www.googleapis.com/auth/gmail.send` | Send messages only |
| `https://mail.google.com/` | Full access (avoid unless necessary) |

**Recommended for most apps:** `gmail.modify` provides read + send + label management.

---

## OAuth 2.0 Flow in Electron

### Approach: Loopback Redirect (Recommended)

The recommended approach for desktop apps is using a loopback IP address (`127.0.0.1`) with a local HTTP server. This is more reliable than `localhost` and avoids firewall issues.

**Important:** Use `127.0.0.1`, NOT `localhost`. Per OAuth 2.1 spec, loopback IP is preferred as it avoids DNS resolution issues and is less susceptible to client-side firewalls.

### Complete Electron OAuth Implementation

```javascript
// main.js (Electron main process)
import { app, BrowserWindow, shell } from 'electron';
import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import crypto from 'crypto';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_PORT = 3847; // Use a random high port
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/oauth/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
];

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// PKCE Support (recommended for public clients)
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

async function authenticate() {
  return new Promise((resolve, reject) => {
    // Generate PKCE codes
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',  // Required to get refresh_token
      scope: SCOPES,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'consent',  // Force consent to always get refresh_token
    });

    // Create local server to receive callback
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true);

        if (parsedUrl.pathname === '/oauth/callback') {
          const { code, state: returnedState, error } = parsedUrl.query;

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>Authentication Failed</h1><p>${error}</p>`);
            server.close();
            reject(new Error(error));
            return;
          }

          // Verify state
          if (returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>State mismatch - possible CSRF attack</h1>');
            server.close();
            reject(new Error('State mismatch'));
            return;
          }

          // Exchange code for tokens
          const { tokens } = await oauth2Client.getToken({
            code,
            codeVerifier,
          });

          oauth2Client.setCredentials(tokens);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; text-align: center; padding-top: 50px;">
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to the app.</p>
                <script>window.close()</script>
              </body>
            </html>
          `);

          server.close();
          resolve(tokens);
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error</h1><p>${err.message}</p>`);
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      // Open auth URL in default browser
      shell.openExternal(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout'));
    }, 5 * 60 * 1000);
  });
}

export { oauth2Client, authenticate };
```

### Alternative: Custom Protocol Handler

For a seamless in-app experience, register a custom protocol:

```javascript
// main.js
import { app, protocol } from 'electron';

const PROTOCOL = 'myapp';

// Register protocol on startup (before app ready)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Handle protocol URL
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleOAuthCallback(url);
});

// Windows/Linux: handle second instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) {
      handleOAuthCallback(url);
    }
  });
}

function handleOAuthCallback(callbackUrl) {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // Exchange code for tokens...
}
```

**Note:** Custom protocols require additional setup in Google Cloud Console (add `myapp://oauth/callback` as authorized redirect URI).

---

## Token Storage and Refresh

### Secure Token Storage with Electron's safeStorage

Electron's built-in `safeStorage` API provides OS-level encryption without native module dependencies:

```javascript
// token-storage.js
import { safeStorage } from 'electron';
import Store from 'electron-store';

const store = new Store({
  name: 'gmail-tokens',
  encryptionKey: 'obfuscation-only',  // Not real security, just obscurity
});

const TOKEN_KEY = 'gmail_tokens';

export function saveTokens(tokens) {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('Secure storage not available, storing tokens in plain text');
    store.set(TOKEN_KEY, tokens);
    return;
  }

  // Encrypt tokens before storage
  const encrypted = safeStorage.encryptString(JSON.stringify(tokens));
  store.set(TOKEN_KEY, encrypted.toString('base64'));
  store.set(`${TOKEN_KEY}_encrypted`, true);
}

export function loadTokens() {
  const isEncrypted = store.get(`${TOKEN_KEY}_encrypted`, false);
  const storedValue = store.get(TOKEN_KEY);

  if (!storedValue) return null;

  if (isEncrypted && safeStorage.isEncryptionAvailable()) {
    try {
      const encrypted = Buffer.from(storedValue, 'base64');
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted);
    } catch (err) {
      console.error('Failed to decrypt tokens:', err);
      return null;
    }
  }

  return storedValue;
}

export function clearTokens() {
  store.delete(TOKEN_KEY);
  store.delete(`${TOKEN_KEY}_encrypted`);
}
```

### Automatic Token Refresh

The googleapis library handles token refresh automatically when you provide a refresh_token:

```javascript
// gmail-client.js
import { google } from 'googleapis';
import { saveTokens, loadTokens } from './token-storage.js';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://127.0.0.1:3847/oauth/callback'
);

// Listen for token refresh events
oauth2Client.on('tokens', (tokens) => {
  console.log('Tokens refreshed');

  // Merge with existing tokens (refresh_token might not be in new tokens)
  const existingTokens = loadTokens() || {};
  const mergedTokens = { ...existingTokens, ...tokens };
  saveTokens(mergedTokens);

  // Update client credentials
  oauth2Client.setCredentials(mergedTokens);
});

// Initialize with stored tokens
export function initializeAuth() {
  const tokens = loadTokens();
  if (tokens) {
    oauth2Client.setCredentials(tokens);
    return true;
  }
  return false;
}

// Check if auth is valid
export async function isAuthenticated() {
  const tokens = loadTokens();
  if (!tokens || !tokens.refresh_token) {
    return false;
  }

  try {
    // Try to refresh to verify tokens are valid
    oauth2Client.setCredentials(tokens);
    await oauth2Client.getAccessToken();
    return true;
  } catch (err) {
    console.error('Auth check failed:', err.message);
    return false;
  }
}

export { oauth2Client };
```

### Token Expiration Scenarios

Refresh tokens can become invalid due to:
- User revokes access in Google Account settings
- Token unused for 6 months
- User changes password (for Gmail-specific scopes)
- App exceeds maximum live tokens (100 per user per app)
- App in "Testing" status with external user type (tokens expire after 7 days)

**Handle gracefully:**

```javascript
async function makeApiCall(apiFunction) {
  try {
    return await apiFunction();
  } catch (err) {
    if (err.code === 401 || err.message.includes('invalid_grant')) {
      // Token is invalid, need to re-authenticate
      clearTokens();
      throw new Error('SESSION_EXPIRED');
    }
    throw err;
  }
}
```

---

## Reading Primary Inbox Only

### Filter by Category Label

Gmail categorizes emails into Primary, Social, Promotions, Updates, and Forums. Use the `category:primary` query or `CATEGORY_PERSONAL` label:

```javascript
// Method 1: Using query parameter (recommended)
async function getPrimaryEmails(maxResults = 20) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: 'category:primary',  // Only Primary inbox
  });

  return response.data.messages || [];
}

// Method 2: Using labelIds
async function getPrimaryEmailsWithLabel(maxResults = 20) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    labelIds: ['INBOX', 'CATEGORY_PERSONAL'],  // CATEGORY_PERSONAL = Primary
  });

  return response.data.messages || [];
}

// Method 3: Exclude other categories explicitly
async function getPrimaryExcludeOthers(maxResults = 20) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: 'category:primary -category:promotions -category:social -category:updates -category:forums',
  });

  return response.data.messages || [];
}
```

### Advanced Filtering

```javascript
// Unread primary emails from last 7 days
async function getRecentUnreadPrimary() {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: 'category:primary is:unread newer_than:7d',
    maxResults: 50,
  });

  return response.data.messages || [];
}

// Primary emails from specific sender
async function getPrimaryFromSender(senderEmail) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: `category:primary from:${senderEmail}`,
  });

  return response.data.messages || [];
}
```

### Get Full Message Details

```javascript
async function getMessageDetails(messageId) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',  // Options: 'minimal', 'full', 'raw', 'metadata'
  });

  const message = response.data;
  const headers = message.payload.headers;

  // Extract common headers
  const getHeader = (name) =>
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet,
    internalDate: new Date(parseInt(message.internalDate)),
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    messageId: getHeader('Message-ID'),  // For threading
    payload: message.payload,
  };
}
```

---

## Thread-Based Email Fetching

### List Threads

```javascript
async function listThreads(query = '', maxResults = 20) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.threads.list({
    userId: 'me',
    maxResults,
    q: query,  // e.g., 'category:primary is:unread'
  });

  return response.data.threads || [];
}
```

### Get Complete Thread with All Messages

```javascript
async function getThread(threadId) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const thread = response.data;

  // Process all messages in thread
  const messages = thread.messages.map(message => {
    const headers = message.payload.headers;
    const getHeader = (name) =>
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: message.id,
      snippet: message.snippet,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      messageId: getHeader('Message-ID'),
      body: extractBody(message.payload),
    };
  });

  return {
    id: thread.id,
    historyId: thread.historyId,
    messages,
  };
}

// Helper: Extract message body
function extractBody(payload) {
  let body = '';

  if (payload.body && payload.body.data) {
    body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
  } else if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        break;
      }
      if (part.mimeType === 'text/html' && part.body.data && !body) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      // Handle nested multipart
      if (part.parts) {
        body = extractBody(part) || body;
      }
    }
  }

  return body;
}
```

### Pagination for Large Inboxes

```javascript
async function getAllPrimaryThreads(maxTotal = 100) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const allThreads = [];
  let pageToken = null;

  while (allThreads.length < maxTotal) {
    const response = await gmail.users.threads.list({
      userId: 'me',
      maxResults: Math.min(50, maxTotal - allThreads.length),
      q: 'category:primary',
      pageToken,
    });

    const threads = response.data.threads || [];
    allThreads.push(...threads);

    pageToken = response.data.nextPageToken;
    if (!pageToken) break;
  }

  return allThreads;
}
```

---

## Sending Replies (Preserving Thread)

### Critical Requirements for Thread Preservation

To add a reply to an existing thread, you MUST:

1. Include `threadId` in the request
2. Set `In-Reply-To` header to original message's `Message-ID`
3. Set `References` header to original message's `Message-ID`
4. Match the subject line (with `Re:` prefix)

### Send Reply Implementation

```javascript
async function sendReply(threadId, originalMessageId, to, subject, body) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Ensure subject has Re: prefix
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

  // Construct RFC 2822 message
  const messageParts = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${originalMessageId}`,
    `References: ${originalMessageId}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ];

  const message = messageParts.join('\r\n');

  // Encode as base64url
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: threadId,  // Critical for thread preservation
    },
  });

  return response.data;
}

// Helper: Get reply context from a thread
async function getReplyContext(threadId) {
  const thread = await getThread(threadId);
  const lastMessage = thread.messages[thread.messages.length - 1];

  return {
    threadId: thread.id,
    messageId: lastMessage.messageId,  // For In-Reply-To and References
    to: lastMessage.from,  // Reply to sender
    subject: lastMessage.subject,
  };
}

// Usage example
async function replyToThread(threadId, replyBody) {
  const context = await getReplyContext(threadId);

  return sendReply(
    context.threadId,
    context.messageId,
    context.to,
    context.subject,
    replyBody
  );
}
```

### Send Reply with HTML

```javascript
async function sendHtmlReply(threadId, originalMessageId, to, subject, htmlBody, plainTextBody) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  const boundary = `----=_Part_${Date.now()}`;

  const messageParts = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${originalMessageId}`,
    `References: ${originalMessageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    plainTextBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ];

  const message = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId,
    },
  });

  return response.data;
}
```

---

## Handling Attachments

### Download Attachments

```javascript
async function getAttachment(messageId, attachmentId) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  // Decode base64url data
  const data = response.data.data
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  return Buffer.from(data, 'base64');
}

// Extract attachment info from message
function getAttachmentInfo(message) {
  const attachments = [];

  function processParts(parts) {
    for (const part of parts) {
      if (part.filename && part.body.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
          attachmentId: part.body.attachmentId,
        });
      }
      if (part.parts) {
        processParts(part.parts);
      }
    }
  }

  if (message.payload.parts) {
    processParts(message.payload.parts);
  }

  return attachments;
}

// Download all attachments from a message
async function downloadAllAttachments(messageId) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const messageResponse = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const attachmentInfos = getAttachmentInfo(messageResponse.data);
  const downloads = [];

  for (const info of attachmentInfos) {
    const data = await getAttachment(messageId, info.attachmentId);
    downloads.push({
      filename: info.filename,
      mimeType: info.mimeType,
      data,
    });
  }

  return downloads;
}
```

### Send Email with Attachments

```javascript
async function sendWithAttachment(to, subject, body, attachments) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const boundary = `----=_Part_${Date.now()}`;

  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ];

  // Add attachments
  for (const attachment of attachments) {
    const base64Data = attachment.data.toString('base64');

    messageParts.push(
      '',
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      base64Data
    );
  }

  messageParts.push('', `--${boundary}--`);

  const message = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  return response.data;
}

// Usage
await sendWithAttachment(
  'recipient@example.com',
  'Document attached',
  'Please find the document attached.',
  [{
    filename: 'report.pdf',
    mimeType: 'application/pdf',
    data: fs.readFileSync('/path/to/report.pdf'),
  }]
);
```

### Reply with Attachment

```javascript
async function replyWithAttachment(threadId, originalMessageId, to, subject, body, attachments) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  const boundary = `----=_Part_${Date.now()}`;

  const messageParts = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${originalMessageId}`,
    `References: ${originalMessageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ];

  for (const attachment of attachments) {
    const base64Data = attachment.data.toString('base64');

    messageParts.push(
      '',
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      base64Data
    );
  }

  messageParts.push('', `--${boundary}--`);

  const message = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId,
    },
  });

  return response.data;
}
```

---

## Complete Working Examples

### Full Gmail Service Class

```javascript
// gmail-service.js
import { google } from 'googleapis';
import { oauth2Client, authenticate, initializeAuth, isAuthenticated } from './auth.js';
import { saveTokens, loadTokens, clearTokens } from './token-storage.js';

class GmailService {
  constructor() {
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  // Authentication
  async ensureAuthenticated() {
    if (await isAuthenticated()) {
      return true;
    }

    const tokens = await authenticate();
    saveTokens(tokens);
    return true;
  }

  // Get primary inbox emails
  async getPrimaryInbox(options = {}) {
    const {
      maxResults = 20,
      unreadOnly = false,
      newerThan = null,  // e.g., '7d', '1h'
    } = options;

    let query = 'category:primary';
    if (unreadOnly) query += ' is:unread';
    if (newerThan) query += ` newer_than:${newerThan}`;

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: query,
    });

    const messages = response.data.messages || [];

    // Fetch full details for each message
    const detailed = await Promise.all(
      messages.map(m => this.getMessage(m.id))
    );

    return detailed;
  }

  // Get single message
  async getMessage(messageId) {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return this._parseMessage(response.data);
  }

  // Get thread with all messages
  async getThread(threadId) {
    const response = await this.gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });

    return {
      id: response.data.id,
      messages: response.data.messages.map(m => this._parseMessage(m)),
    };
  }

  // Send reply
  async reply(threadId, body, options = {}) {
    const { html = false } = options;

    // Get thread context
    const thread = await this.getThread(threadId);
    const lastMessage = thread.messages[thread.messages.length - 1];

    const to = lastMessage.from;
    const subject = lastMessage.subject.startsWith('Re:')
      ? lastMessage.subject
      : `Re: ${lastMessage.subject}`;
    const messageId = lastMessage.messageId;

    const rawMessage = this._buildMessage({
      to,
      subject,
      body,
      html,
      inReplyTo: messageId,
      references: messageId,
    });

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
        threadId,
      },
    });

    return response.data;
  }

  // Send new email
  async send(to, subject, body, options = {}) {
    const { html = false, attachments = [] } = options;

    const rawMessage = this._buildMessage({
      to,
      subject,
      body,
      html,
      attachments,
    });

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    return response.data;
  }

  // Download attachment
  async downloadAttachment(messageId, attachmentId) {
    const response = await this.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    const data = response.data.data
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    return Buffer.from(data, 'base64');
  }

  // Private: Parse message
  _parseMessage(message) {
    const headers = message.payload.headers;
    const getHeader = (name) =>
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: message.id,
      threadId: message.threadId,
      snippet: message.snippet,
      date: new Date(parseInt(message.internalDate)),
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      messageId: getHeader('Message-ID'),
      body: this._extractBody(message.payload),
      attachments: this._extractAttachments(message.payload),
    };
  }

  // Private: Extract body
  _extractBody(payload) {
    if (payload.body && payload.body.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
          const nested = this._extractBody(part);
          if (nested) return nested;
        }
      }
    }

    return '';
  }

  // Private: Extract attachments
  _extractAttachments(payload) {
    const attachments = [];

    const processParts = (parts) => {
      for (const part of parts) {
        if (part.filename && part.body.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            attachmentId: part.body.attachmentId,
          });
        }
        if (part.parts) processParts(part.parts);
      }
    };

    if (payload.parts) processParts(payload.parts);
    return attachments;
  }

  // Private: Build raw message
  _buildMessage({ to, subject, body, html, inReplyTo, references, attachments = [] }) {
    const hasAttachments = attachments.length > 0;
    const boundary = `----=_Part_${Date.now()}`;

    const lines = [
      `To: ${to}`,
      `Subject: ${subject}`,
    ];

    if (inReplyTo) {
      lines.push(`In-Reply-To: ${inReplyTo}`);
      lines.push(`References: ${references || inReplyTo}`);
    }

    lines.push('MIME-Version: 1.0');

    if (hasAttachments) {
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');
      lines.push(`--${boundary}`);
    }

    if (html) {
      lines.push('Content-Type: text/html; charset=utf-8');
    } else {
      lines.push('Content-Type: text/plain; charset=utf-8');
    }

    lines.push('');
    lines.push(body);

    if (hasAttachments) {
      for (const att of attachments) {
        const base64Data = att.data.toString('base64');
        lines.push('');
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${att.mimeType}`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        lines.push('');
        lines.push(base64Data);
      }
      lines.push('');
      lines.push(`--${boundary}--`);
    }

    const message = lines.join('\r\n');

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

export default GmailService;
```

### Usage in Electron App

```javascript
// main.js
import { app, ipcMain } from 'electron';
import GmailService from './gmail-service.js';

const gmailService = new GmailService();

// IPC handlers for renderer process
ipcMain.handle('gmail:authenticate', async () => {
  return await gmailService.ensureAuthenticated();
});

ipcMain.handle('gmail:getPrimaryInbox', async (event, options) => {
  return await gmailService.getPrimaryInbox(options);
});

ipcMain.handle('gmail:getThread', async (event, threadId) => {
  return await gmailService.getThread(threadId);
});

ipcMain.handle('gmail:reply', async (event, threadId, body, options) => {
  return await gmailService.reply(threadId, body, options);
});

ipcMain.handle('gmail:send', async (event, to, subject, body, options) => {
  return await gmailService.send(to, subject, body, options);
});
```

```javascript
// preload.js
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('gmail', {
  authenticate: () => ipcRenderer.invoke('gmail:authenticate'),
  getPrimaryInbox: (options) => ipcRenderer.invoke('gmail:getPrimaryInbox', options),
  getThread: (threadId) => ipcRenderer.invoke('gmail:getThread', threadId),
  reply: (threadId, body, options) => ipcRenderer.invoke('gmail:reply', threadId, body, options),
  send: (to, subject, body, options) => ipcRenderer.invoke('gmail:send', to, subject, body, options),
});
```

```javascript
// renderer.js
async function loadInbox() {
  await window.gmail.authenticate();

  const emails = await window.gmail.getPrimaryInbox({
    maxResults: 20,
    unreadOnly: true,
  });

  console.log('Primary inbox:', emails);
}

async function replyToEmail(threadId) {
  const result = await window.gmail.reply(threadId, 'Thanks for your email!');
  console.log('Reply sent:', result);
}
```

---

## Sources

### Official Documentation
- [Gmail API Node.js Quickstart](https://developers.google.com/gmail/api/quickstart/nodejs)
- [Managing Threads](https://developers.google.com/gmail/api/guides/threads)
- [users.messages.send](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send)
- [users.messages.attachments.get](https://developers.google.com/gmail/api/reference/rest/v1/users.messages.attachments/get)
- [users.threads.get](https://developers.google.com/gmail/api/reference/rest/v1/users.threads/get)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)

### GitHub
- [googleapis/google-api-nodejs-client](https://github.com/googleapis/google-api-nodejs-client)
- [Token storage discussion](https://github.com/googleapis/google-api-nodejs-client/issues/853)
- [Thread reply issue](https://github.com/googleapis/google-api-nodejs-client/issues/710)

### Security & OAuth
- [OAuth 2.1 Draft Specification](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)
- [Electron OAuth Best Practices](https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/6798)
- [Secure Storage in Electron with keytar](https://cameronnokes.com/blog/how-to-securely-store-sensitive-information-in-electron-with-node-keytar/)

### npm Packages
- [googleapis](https://www.npmjs.com/package/googleapis)
- [@googleapis/gmail](https://www.npmjs.com/package/@googleapis/gmail)
- [electron-store](https://www.npmjs.com/package/electron-store)

---

## Key Pitfalls to Avoid

1. **Using `localhost` instead of `127.0.0.1`** - Can cause DNS/firewall issues
2. **Forgetting `access_type: 'offline'`** - Won't receive refresh_token
3. **Not storing refresh_token on first auth** - It's only returned once
4. **Missing `In-Reply-To` and `References` headers** - Reply won't thread properly
5. **Hardcoding encryption keys in electron-store** - Use safeStorage instead
6. **Not handling token expiration gracefully** - Users will get stuck
7. **Requesting `mail.google.com` scope unnecessarily** - Triggers extra security review
