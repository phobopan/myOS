# Phase 3: Gmail - Research

**Researched:** 2026-01-22
**Domain:** Gmail API integration with OAuth 2.0 in Electron
**Confidence:** HIGH

## Summary

Gmail integration requires the `googleapis` npm package with OAuth 2.0 authentication using a loopback redirect (127.0.0.1). The Gmail API is thread-based, where emails are grouped by conversation using `threadId`, and replies must include proper RFC 2822 headers (`In-Reply-To`, `References`) to maintain threading. Token storage should use Electron's `safeStorage` API combined with `electron-store` for persistence.

The architecture follows the existing phoebeOS service pattern: a `GmailService` singleton in the main process with IPC handlers using the `gmail:action` namespace, exposed to the renderer via `window.electron.gmail`. The CONTEXT.md decisions lock in specific UI choices (inline reply box, smart CC visibility, single account support) that simplify implementation scope.

**Primary recommendation:** Use `googleapis` package (not the gmail-specific submodule) with loopback OAuth, `electron-store` + `safeStorage` for token persistence, and construct RFC 2822 messages manually using Buffer base64url encoding for full control over headers.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | ^145.0.0 | Google API client (includes Gmail) | Official Google client, TypeScript types included, handles token refresh |
| `electron-store` | ^10.0.0 | Persistent config/token storage | Simple JSON storage, works in main process |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | Built-in Node.js `http`, `crypto`, `Buffer` sufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `googleapis` | `@googleapis/gmail` | Submodule is smaller but loses cross-API consistency |
| Manual RFC 2822 | `nodemailer` | Nodemailer adds dependency but Gmail API overrides plain text anyway |
| `electron-store` | Direct fs | electron-store handles edge cases, atomic writes |

**Installation:**
```bash
npm install googleapis electron-store
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   ├── services/
│   │   ├── gmailService.ts      # Gmail API wrapper (singleton)
│   │   ├── gmailAuthService.ts  # OAuth flow, token storage
│   │   └── gmailTypes.ts        # DB/API type definitions
│   └── ipc.ts                   # Add gmail:* handlers
├── shared/
│   └── ipcTypes.ts              # Add Gmail interfaces
└── renderer/
    ├── components/
    │   ├── GmailThreadView.tsx  # Email thread display
    │   ├── GmailComposer.tsx    # Reply/Forward composer
    │   └── EmailMessage.tsx     # Individual email in thread
    └── electron.d.ts            # Add gmail API types
```

### Pattern 1: Service Singleton (matches iMessageService)
**What:** Lazy-initialized singleton for Gmail API access
**When to use:** All Gmail operations go through single service instance
**Example:**
```typescript
// Source: existing iMessageService pattern
import { google, gmail_v1 } from 'googleapis';

class GmailServiceClass {
  private gmail: gmail_v1.Gmail | null = null;
  private oauth2Client: any = null;

  private ensureClient(): gmail_v1.Gmail {
    if (!this.gmail) {
      throw new Error('Gmail not authenticated');
    }
    return this.gmail;
  }

  async authenticate(): Promise<boolean> {
    // Initialize oauth2Client, run OAuth flow
    // Set this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async getThreads(query: string, maxResults: number): Promise<GmailThread[]> {
    const gmail = this.ensureClient();
    // API calls...
  }
}

export const gmailService = new GmailServiceClass();
```

### Pattern 2: IPC Handler Namespace (matches existing pattern)
**What:** All IPC handlers prefixed with `gmail:`
**When to use:** Every renderer-to-main communication for Gmail
**Example:**
```typescript
// Source: existing ipc.ts pattern
ipcMain.handle('gmail:authenticate', async () => {
  return gmailService.authenticate();
});

ipcMain.handle('gmail:getThreads', async (_, options) => {
  return gmailService.getThreads(options);
});

ipcMain.handle('gmail:getThread', async (_, threadId) => {
  return gmailService.getThread(threadId);
});

ipcMain.handle('gmail:sendReply', async (_, threadId, body, options) => {
  return gmailService.sendReply(threadId, body, options);
});
```

### Pattern 3: Preload API Exposure (matches existing pattern)
**What:** Expose Gmail API on `window.electron.gmail` object
**When to use:** All renderer-side Gmail access
**Example:**
```typescript
// Source: existing preload.ts pattern
gmail: {
  authenticate: () => ipcRenderer.invoke('gmail:authenticate'),
  getThreads: (options) => ipcRenderer.invoke('gmail:getThreads', options),
  getThread: (threadId) => ipcRenderer.invoke('gmail:getThread', threadId),
  sendReply: (threadId, body, options) => ipcRenderer.invoke('gmail:sendReply', threadId, body, options),
  forward: (threadId, to, body) => ipcRenderer.invoke('gmail:forward', threadId, to, body),
  disconnect: () => ipcRenderer.invoke('gmail:disconnect'),
  isAuthenticated: () => ipcRenderer.invoke('gmail:isAuthenticated'),
}
```

### Anti-Patterns to Avoid
- **Storing oauth2Client in renderer:** Keep all auth logic in main process
- **Using `localhost` for redirect:** Use `127.0.0.1` to avoid DNS issues
- **Hardcoding client ID/secret in source:** Use environment variables or secure config
- **Mixing iMessage and Gmail types:** Keep separate type files, only share via ipcTypes.ts

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token refresh | Manual expiry checking | googleapis auto-refresh | Library handles token events automatically |
| Base64url encoding | Custom regex | `Buffer.toString('base64url')` | Node.js built-in, correct implementation |
| Token encryption | Custom crypto | Electron safeStorage | OS-level keychain integration |
| PKCE code verifier | Manual random strings | `crypto.randomBytes(32).toString('base64url')` | Secure random, correct format |
| Email parsing | Regex on raw MIME | Recursive payload traversal | Gmail API structure is deeply nested |

**Key insight:** The googleapis library handles the hardest parts (token refresh, API versioning, error handling). Focus on correct OAuth setup and MIME message construction.

## Common Pitfalls

### Pitfall 1: Missing refresh_token on subsequent auths
**What goes wrong:** After first auth, refresh_token is never returned again
**Why it happens:** Google only sends refresh_token on first consent, or with `prompt: 'consent'`
**How to avoid:** Always use `prompt: 'consent'` in generateAuthUrl(), store refresh_token immediately
**Warning signs:** Token works briefly then fails, no automatic refresh

### Pitfall 2: Reply doesn't thread properly
**What goes wrong:** Reply appears as new email, not in thread
**Why it happens:** Missing `In-Reply-To`, `References` headers, or wrong `threadId`
**How to avoid:** Include all three: `threadId` in request body, `In-Reply-To` and `References` headers in MIME
**Warning signs:** Replies show up separately in Gmail web UI

### Pitfall 3: Using localhost instead of 127.0.0.1
**What goes wrong:** OAuth callback fails on some systems
**Why it happens:** DNS resolution of localhost can be blocked by firewalls or resolve wrong
**How to avoid:** Always use `http://127.0.0.1:{port}/oauth/callback`
**Warning signs:** "Connection refused" or timeout during OAuth

### Pitfall 4: Plain text overwritten by Gmail API
**What goes wrong:** Your carefully crafted plain text version is replaced
**Why it happens:** Gmail API auto-generates plain text from HTML when both provided
**How to avoid:** For plain text emails, don't include HTML part; for HTML emails, accept Gmail's conversion
**Warning signs:** Plain text version differs from what you sent

### Pitfall 5: Token storage insecure on Linux
**What goes wrong:** Tokens stored with hardcoded password, not encrypted
**Why it happens:** Linux without secret store (kwallet/gnome-keyring) falls back to basic_text
**How to avoid:** Check `safeStorage.getSelectedStorageBackend()`, warn user if 'basic_text'
**Warning signs:** `safeStorage.isEncryptionAvailable()` returns false

### Pitfall 6: Attachment body.data is undefined
**What goes wrong:** Trying to access inline attachment data returns undefined
**Why it happens:** Large attachments only have `attachmentId`, not inline `data`
**How to avoid:** Always check for `attachmentId`, fetch separately via `messages.attachments.get`
**Warning signs:** Small attachments work, large ones fail

## Code Examples

Verified patterns from official sources and existing ELECTRON-GMAIL.md research:

### OAuth Flow with Loopback Redirect
```typescript
// Source: ELECTRON-GMAIL.md + Google OAuth documentation
import { google } from 'googleapis';
import { shell } from 'electron';
import http from 'http';
import crypto from 'crypto';

const REDIRECT_PORT = 8847;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/oauth/callback`;
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

async function authenticate(clientId: string, clientSecret: string): Promise<Tokens> {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  // PKCE for security
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'consent', // Always get refresh_token
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://127.0.0.1:${REDIRECT_PORT}`);
      if (url.pathname !== '/oauth/callback') return;

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      if (returnedState !== state) {
        res.writeHead(400);
        res.end('State mismatch');
        server.close();
        reject(new Error('State mismatch'));
        return;
      }

      const { tokens } = await oauth2Client.getToken({ code: code!, codeVerifier });

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Success!</h1><p>You can close this window.</p><script>window.close()</script>');
      server.close();
      resolve(tokens);
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      shell.openExternal(authUrl);
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Auth timeout'));
    }, 5 * 60 * 1000);
  });
}
```

### Token Storage with safeStorage
```typescript
// Source: Electron safeStorage docs + electron-store
import { safeStorage } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'gmail-auth' });
const TOKEN_KEY = 'gmail_tokens';

export function saveTokens(tokens: any): void {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('Secure storage unavailable, using obfuscated storage');
    store.set(TOKEN_KEY, tokens);
    store.set(`${TOKEN_KEY}_encrypted`, false);
    return;
  }

  const encrypted = safeStorage.encryptString(JSON.stringify(tokens));
  store.set(TOKEN_KEY, encrypted.toString('base64'));
  store.set(`${TOKEN_KEY}_encrypted`, true);
}

export function loadTokens(): any | null {
  const isEncrypted = store.get(`${TOKEN_KEY}_encrypted`, false);
  const stored = store.get(TOKEN_KEY) as string | undefined;
  if (!stored) return null;

  if (isEncrypted && safeStorage.isEncryptionAvailable()) {
    const encrypted = Buffer.from(stored, 'base64');
    return JSON.parse(safeStorage.decryptString(encrypted));
  }
  return stored;
}

export function clearTokens(): void {
  store.delete(TOKEN_KEY);
  store.delete(`${TOKEN_KEY}_encrypted`);
}
```

### Get Primary Inbox Threads
```typescript
// Source: Gmail API docs + ELECTRON-GMAIL.md
async function getPrimaryThreads(gmail: gmail_v1.Gmail, maxResults = 20): Promise<GmailThread[]> {
  const response = await gmail.users.threads.list({
    userId: 'me',
    q: 'category:primary',
    maxResults,
  });

  const threads = response.data.threads || [];

  // Fetch full thread details
  return Promise.all(threads.map(t => getFullThread(gmail, t.id!)));
}

async function getFullThread(gmail: gmail_v1.Gmail, threadId: string): Promise<GmailThread> {
  const response = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const thread = response.data;
  return {
    id: thread.id!,
    messages: thread.messages!.map(parseMessage),
  };
}
```

### Parse Email Message (Recursive Body Extraction)
```typescript
// Source: Gmail API MIME handling documentation
function parseMessage(msg: gmail_v1.Schema$Message): GmailMessage {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    id: msg.id!,
    threadId: msg.threadId!,
    date: new Date(parseInt(msg.internalDate!)),
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    subject: getHeader('Subject'),
    messageId: getHeader('Message-ID'),
    body: extractBody(msg.payload),
    attachments: extractAttachments(msg.payload),
    snippet: msg.snippet || '',
  };
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { html: string; text: string } {
  let html = '';
  let text = '';

  function traverse(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.parts) {
      part.parts.forEach(traverse);
    }
  }

  if (payload) traverse(payload);
  return { html, text };
}
```

### Send Reply with Threading
```typescript
// Source: Gmail API threading docs + RFC 2822
async function sendReply(
  gmail: gmail_v1.Gmail,
  threadId: string,
  originalMessageId: string,
  to: string,
  subject: string,
  body: string,
  options?: { cc?: string; bcc?: string }
): Promise<gmail_v1.Schema$Message> {
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

  const headers = [
    `To: ${to}`,
    options?.cc ? `Cc: ${options.cc}` : '',
    options?.bcc ? `Bcc: ${options.bcc}` : '',
    `Subject: ${replySubject}`,
    `In-Reply-To: ${originalMessageId}`,
    `References: ${originalMessageId}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ].filter(Boolean);

  const message = [...headers, '', body].join('\r\n');
  const raw = Buffer.from(message).toString('base64url');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId },
  });

  return response.data;
}
```

### Reply All Implementation
```typescript
// Source: RFC 2822 Reply-All semantics
function buildReplyAllRecipients(
  originalFrom: string,
  originalTo: string,
  originalCc: string,
  myEmail: string
): { to: string; cc: string } {
  // Parse all addresses
  const allRecipients = [
    originalFrom,
    ...originalTo.split(',').map(s => s.trim()),
    ...originalCc.split(',').map(s => s.trim()),
  ].filter(Boolean);

  // Remove myself
  const others = allRecipients.filter(r => !r.toLowerCase().includes(myEmail.toLowerCase()));

  // Original sender becomes To, everyone else becomes CC
  return {
    to: originalFrom,
    cc: others.slice(1).join(', '),
  };
}
```

### Forward Email Implementation
```typescript
// Source: Email forward conventions
async function forwardEmail(
  gmail: gmail_v1.Gmail,
  messageId: string,
  to: string,
  additionalBody?: string
): Promise<gmail_v1.Schema$Message> {
  // Get original message
  const original = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const parsed = parseMessage(original.data);
  const forwardSubject = parsed.subject.startsWith('Fwd:')
    ? parsed.subject
    : `Fwd: ${parsed.subject}`;

  // Build forwarded body
  const forwardHeader = [
    '---------- Forwarded message ---------',
    `From: ${parsed.from}`,
    `Date: ${parsed.date.toLocaleString()}`,
    `Subject: ${parsed.subject}`,
    `To: ${parsed.to}`,
    parsed.cc ? `Cc: ${parsed.cc}` : '',
    '',
  ].filter(Boolean).join('\r\n');

  const body = [
    additionalBody || '',
    '',
    forwardHeader,
    parsed.body.text || parsed.body.html,
  ].join('\r\n');

  const message = [
    `To: ${to}`,
    `Subject: ${forwardSubject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  const raw = Buffer.from(message).toString('base64url');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return response.data;
}
```

### Extract Attachments
```typescript
// Source: Gmail API attachments documentation
interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isInline: boolean;
}

function extractAttachments(payload: gmail_v1.Schema$MessagePart | undefined): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];

  function traverse(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      const contentDisposition = part.headers?.find(
        h => h.name?.toLowerCase() === 'content-disposition'
      )?.value || '';

      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        isInline: contentDisposition.includes('inline'),
      });
    }
    if (part.parts) {
      part.parts.forEach(traverse);
    }
  }

  if (payload) traverse(payload);
  return attachments;
}

async function downloadAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  return Buffer.from(response.data.data!, 'base64url');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-keytar` for secrets | `safeStorage` (Electron built-in) | Electron 24+ | No native module needed |
| localhost OAuth | 127.0.0.1 loopback | OAuth 2.1 spec | More reliable across systems |
| Custom token refresh | googleapis auto-refresh | Always available | Simpler, more reliable |
| Base64 encoding tricks | `Buffer.toString('base64url')` | Node.js 16+ | Built-in, correct padding |

**Deprecated/outdated:**
- `node-keytar`: Still works but requires native compilation, `safeStorage` preferred
- `electron-oauth2` package: Outdated, better to implement manually with modern patterns

## Open Questions

Things that couldn't be fully resolved:

1. **Google Cloud Console setup**
   - What we know: Need OAuth 2.0 Client ID for Desktop App
   - What's unclear: Whether to embed client ID in app or prompt user to create their own
   - Recommendation: Embed client ID, handle "Testing" mode 7-day token expiry by publishing app

2. **Inline image display in HTML emails**
   - What we know: Images use `cid:` references linked to attachment Content-ID
   - What's unclear: Best React approach for rendering with replaced CID references
   - Recommendation: Fetch inline images, convert to data URLs, replace in HTML before render

3. **CC field smart visibility implementation**
   - What we know: Per CONTEXT.md, show CC if original had CC, otherwise hidden
   - What's unclear: Exact UX for revealing hidden CC field
   - Recommendation: Small "Add CC" link that expands the field when clicked

## Sources

### Primary (HIGH confidence)
- [Gmail API Node.js Quickstart](https://developers.google.com/gmail/api/quickstart/nodejs)
- [Gmail API Managing Threads](https://developers.google.com/gmail/api/guides/threads)
- [Gmail API Sending Email](https://developers.google.com/gmail/api/guides/sending)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- Existing `.planning/research/ELECTRON-GMAIL.md` (comprehensive, verified)

### Secondary (MEDIUM confidence)
- [googleapis/google-api-nodejs-client GitHub](https://github.com/googleapis/google-api-nodejs-client)
- [MSAL.js Electron OAuth Discussion](https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/6798) (loopback best practices)
- [electron-store GitHub](https://github.com/sindresorhus/electron-store)

### Tertiary (LOW confidence)
- Web search results for CC/BCC, Forward implementation (general patterns, not Gmail-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - googleapis is official, well-documented
- Architecture: HIGH - matches existing phoebeOS patterns exactly
- OAuth flow: HIGH - official documentation + working examples in ELECTRON-GMAIL.md
- Threading: HIGH - RFC 2822 + Gmail API docs are explicit
- Attachments: MEDIUM - inline image handling needs testing

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (stable APIs, 30-day validity)
