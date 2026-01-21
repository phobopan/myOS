# Electron iMessage Integration Research

**Researched:** 2026-01-20
**Focus:** Reading macOS iMessage chat.db from Node.js/Electron
**Overall Confidence:** HIGH (verified against actual chat.db schema and official documentation)

---

## Table of Contents

1. [SQLite Library Comparison](#1-sqlite-library-comparison)
2. [Electron Native Module Setup](#2-electron-native-module-setup)
3. [chat.db Schema Reference](#3-chatdb-schema-reference)
4. [Querying Messages](#4-querying-messages)
5. [Contact Resolution](#5-contact-resolution)
6. [Full Disk Access Permissions](#6-full-disk-access-permissions)
7. [Sending Messages via AppleScript](#7-sending-messages-via-applescript)
8. [Existing Libraries](#8-existing-libraries)
9. [Working Code Examples](#9-working-code-examples)

---

## 1. SQLite Library Comparison

### Recommendation: **better-sqlite3** for Electron

| Library | Native Module | Performance | Memory | Electron Compatibility |
|---------|---------------|-------------|--------|----------------------|
| **better-sqlite3** | Yes | Fastest | Low (file-based) | Requires rebuild |
| sql.js | No (WASM) | Slower | High (loads entire DB) | Works out of box |
| node-sqlite3 | Yes | Good | Low | Requires rebuild |
| Node.js built-in | No | Good | Low | Node 22.5.0+ only |

**Why better-sqlite3:**
- Synchronous API (simpler code, no callback hell)
- Best performance for local SQLite databases
- Active maintenance (v12.6.2 as of Jan 2026)
- Direct file access (no need to load entire DB into memory)

**Why NOT sql.js:**
- Must load entire database into memory
- iMessage chat.db can grow to hundreds of MB
- Slower than native bindings
- Only use if you absolutely cannot get native modules working

**Sources:**
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3)
- [RxDB Electron Database Guide](https://rxdb.info/electron-database.html)
- [sql.js GitHub](https://github.com/sql-js/sql.js)

---

## 2. Electron Native Module Setup

### Using electron-builder (Recommended)

```json
// package.json
{
  "name": "my-electron-app",
  "scripts": {
    "postinstall": "electron-builder install-app-deps"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.6.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  },
  "dependencies": {
    "better-sqlite3": "^12.6.0"
  }
}
```

### Using @electron/rebuild Directly

```json
// package.json
{
  "scripts": {
    "rebuild": "electron-rebuild -f -w better-sqlite3",
    "postinstall": "npm run rebuild"
  }
}
```

### Manual Rebuild Command

```bash
npx @electron/rebuild -f -w better-sqlite3
```

### Common Issues and Solutions

**Error: NODE_MODULE_VERSION mismatch**
```
The module was compiled against a different Node.js version using
NODE_MODULE_VERSION 115. This version of Node.js requires NODE_MODULE_VERSION 118.
```

**Solution:** Run `npx @electron/rebuild -f -w better-sqlite3` after every `npm install` or Electron version change.

**macOS Build Requirements:**
- XCode Command Line Tools: `xcode-select --install`
- Python 3 (macOS 12.3+ doesn't bundle Python)

**Sources:**
- [Electron Native Modules Documentation](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [better-sqlite3 Electron Guide](https://dev.to/arindam1997007/a-step-by-step-guide-to-integrating-better-sqlite3-with-electron-js-app-using-create-react-app-3k16)

---

## 3. chat.db Schema Reference

**Location:** `~/Library/Messages/chat.db`

**Additional Files (WAL mode):**
- `chat.db-shm` (shared memory)
- `chat.db-wal` (write-ahead log)

### Core Tables

#### message
Primary message storage with 70+ columns.

```sql
CREATE TABLE message (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
    guid TEXT UNIQUE NOT NULL,
    text TEXT,                          -- Plain text (may be NULL on Ventura+)
    attributedBody BLOB,                -- NSAttributedString blob (contains text on Ventura+)
    handle_id INTEGER DEFAULT 0,        -- FK to handle table
    date INTEGER,                       -- Apple epoch nanoseconds
    date_read INTEGER,
    date_delivered INTEGER,
    is_from_me INTEGER DEFAULT 0,       -- 1 = sent, 0 = received
    is_read INTEGER DEFAULT 0,
    is_delivered INTEGER DEFAULT 0,
    is_sent INTEGER DEFAULT 0,
    cache_has_attachments INTEGER DEFAULT 0,
    cache_roomnames TEXT,               -- Group chat room name
    associated_message_guid TEXT,       -- For reactions/replies
    associated_message_type INTEGER,    -- Reaction type
    reply_to_guid TEXT,                 -- Thread reply
    thread_originator_guid TEXT,        -- Thread start
    -- ... many more columns
);
```

**Key columns:**
- `text` - Plain text content (NULL for many messages on macOS Ventura+)
- `attributedBody` - Binary blob containing styled text (primary source on Ventura+)
- `date` - Apple epoch in nanoseconds (seconds since 2001-01-01 * 10^9)
- `is_from_me` - Direction indicator
- `handle_id` - Foreign key to sender/recipient

#### handle
Contact identifiers (phone numbers, emails).

```sql
CREATE TABLE handle (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,
    id TEXT NOT NULL,              -- Phone number or email
    country TEXT,
    service TEXT NOT NULL,         -- 'iMessage' or 'SMS'
    uncanonicalized_id TEXT,
    person_centric_id TEXT,        -- Links to unified contact
    UNIQUE (id, service)
);
```

#### chat
Conversation metadata.

```sql
CREATE TABLE chat (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
    guid TEXT UNIQUE NOT NULL,
    style INTEGER,                 -- 43 = group, 45 = individual
    chat_identifier TEXT,          -- Group ID or phone/email
    service_name TEXT,             -- 'iMessage' or 'SMS'
    display_name TEXT,             -- User-set group name
    room_name TEXT,
    is_archived INTEGER DEFAULT 0,
    last_read_message_timestamp INTEGER DEFAULT 0,
    -- ...
);
```

**style values:**
- `43` = Group chat
- `45` = Individual (1:1) chat

#### attachment
File attachments (images, videos, documents).

```sql
CREATE TABLE attachment (
    ROWID INTEGER PRIMARY KEY AUTOINCREMENT,
    guid TEXT UNIQUE NOT NULL,
    created_date INTEGER DEFAULT 0,
    filename TEXT,                 -- Local file path
    uti TEXT,                      -- Uniform Type Identifier
    mime_type TEXT,
    transfer_state INTEGER,        -- 0 = complete
    is_outgoing INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    -- ...
);
```

### Join Tables

```sql
-- Links chats to messages
CREATE TABLE chat_message_join (
    chat_id INTEGER REFERENCES chat (ROWID),
    message_id INTEGER REFERENCES message (ROWID),
    message_date INTEGER DEFAULT 0,
    PRIMARY KEY (chat_id, message_id)
);

-- Links chats to participants
CREATE TABLE chat_handle_join (
    chat_id INTEGER REFERENCES chat (ROWID),
    handle_id INTEGER REFERENCES handle (ROWID),
    UNIQUE(chat_id, handle_id)
);

-- Links messages to attachments
CREATE TABLE message_attachment_join (
    message_id INTEGER REFERENCES message (ROWID),
    attachment_id INTEGER REFERENCES attachment (ROWID),
    UNIQUE(message_id, attachment_id)
);
```

### Date Conversion

iMessage dates use **Apple Cocoa epoch** (seconds since 2001-01-01) stored as **nanoseconds**.

```typescript
// Constants
const APPLE_EPOCH_OFFSET = 978307200; // Seconds between Unix epoch and Apple epoch

// Apple nanoseconds to JavaScript Date
function appleToDate(appleNanos: number): Date {
  const unixMs = (appleNanos / 1_000_000_000 + APPLE_EPOCH_OFFSET) * 1000;
  return new Date(unixMs);
}

// JavaScript Date to Apple nanoseconds
function dateToApple(date: Date): number {
  const unixSeconds = date.getTime() / 1000;
  return (unixSeconds - APPLE_EPOCH_OFFSET) * 1_000_000_000;
}

// SQL date conversion
// datetime(date/1000000000 + 978307200, 'unixepoch', 'localtime')
```

**Sources:**
- Verified against actual chat.db schema on macOS Sonoma
- [Searching iMessage Database with SQL](https://spin.atomicobject.com/search-imessage-sql/)
- [David Bieber - iMessage SQL](https://davidbieber.com/snippets/2020-05-20-imessage-sql-db/)

---

## 4. Querying Messages

### Decoding attributedBody (macOS Ventura+)

On macOS Ventura and later, many messages have `text = NULL` with content in `attributedBody` blob.

**Format:** NeXT/Apple typedstream (NSMutableAttributedString serialization)

```typescript
/**
 * Extract text from attributedBody blob
 * The text follows 'NSString' marker with a length prefix
 */
function decodeAttributedBody(blob: Buffer): string | null {
  if (!blob || blob.length === 0) return null;

  // Find NSString marker
  const marker = Buffer.from('NSString');
  const markerIndex = blob.indexOf(marker);
  if (markerIndex === -1) return null;

  // Skip marker and 5 preamble bytes
  const contentStart = markerIndex + marker.length + 5;
  if (contentStart >= blob.length) return null;

  // Read length (1 or 3 bytes)
  let length: number;
  let textStart: number;

  if (blob[contentStart] === 0x81) {
    // 3-byte length: 0x81 followed by 2 bytes little-endian
    length = blob.readUInt16LE(contentStart + 1);
    textStart = contentStart + 3;
  } else {
    // 1-byte length
    length = blob[contentStart];
    textStart = contentStart + 1;
  }

  if (textStart + length > blob.length) return null;

  return blob.slice(textStart, textStart + length).toString('utf-8');
}
```

### Basic Message Query

```typescript
import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const db = new Database(join(homedir(), 'Library/Messages/chat.db'), {
  readonly: true,
  fileMustExist: true
});

// Get recent messages from a specific contact
const messages = db.prepare(`
  SELECT
    m.ROWID,
    m.guid,
    m.text,
    m.attributedBody,
    m.is_from_me,
    m.date,
    m.cache_has_attachments,
    h.id as sender_id,
    c.chat_identifier,
    c.display_name
  FROM message m
  JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
  JOIN chat c ON cmj.chat_id = c.ROWID
  LEFT JOIN handle h ON m.handle_id = h.ROWID
  WHERE h.id = ?
  ORDER BY m.date DESC
  LIMIT ?
`).all('+15551234567', 50);

// Process messages
const processed = messages.map(msg => ({
  id: msg.ROWID,
  guid: msg.guid,
  text: msg.text || decodeAttributedBody(msg.attributedBody),
  isFromMe: msg.is_from_me === 1,
  date: appleToDate(msg.date),
  hasAttachments: msg.cache_has_attachments === 1,
  sender: msg.sender_id,
  chatIdentifier: msg.chat_identifier
}));
```

### Get Conversations Awaiting Reply

```typescript
const awaitingReply = db.prepare(`
  WITH last_per_chat AS (
    SELECT
      c.ROWID as chat_id,
      c.chat_identifier,
      c.display_name,
      c.style,
      MAX(m.date) as last_date
    FROM message m
    JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE m.date > ?
    GROUP BY c.ROWID
  )
  SELECT
    lpc.*,
    m.text,
    m.attributedBody,
    m.is_from_me,
    h.id as sender_id
  FROM last_per_chat lpc
  JOIN chat_message_join cmj ON lpc.chat_id = cmj.chat_id
  JOIN message m ON cmj.message_id = m.ROWID AND m.date = lpc.last_date
  LEFT JOIN handle h ON m.handle_id = h.ROWID
  WHERE m.is_from_me = 0
  ORDER BY lpc.last_date ASC
`).all(dateToApple(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
```

### Get Message Attachments

```typescript
const attachments = db.prepare(`
  SELECT
    a.ROWID,
    a.guid,
    a.filename,
    a.mime_type,
    a.uti,
    a.total_bytes,
    a.transfer_state
  FROM attachment a
  JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
  WHERE maj.message_id = ?
`).all(messageRowId);

// Note: filename paths start with ~/Library/Messages/Attachments/
// Replace ~ with actual home directory
```

---

## 5. Contact Resolution

### Option A: Direct AddressBook Database (Read-Only)

**Location:** `~/Library/Application Support/AddressBook/AddressBook-v22.abcddb`

```typescript
const contactsDb = new Database(
  join(homedir(), 'Library/Application Support/AddressBook/AddressBook-v22.abcddb'),
  { readonly: true, fileMustExist: true }
);

// Find contact by phone number
function findContactByPhone(phone: string): string | null {
  // Normalize phone number (remove formatting)
  const normalized = phone.replace(/[\s\-\(\)\+]/g, '');

  const result = contactsDb.prepare(`
    SELECT r.ZFIRSTNAME, r.ZLASTNAME
    FROM ZABCDRECORD r
    JOIN ZABCDPHONENUMBER p ON r.Z_PK = p.ZOWNER
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(p.ZFULLNUMBER, ' ', ''), '-', ''), '(', ''), ')', '')
          LIKE '%' || ? || '%'
    LIMIT 1
  `).get(normalized.slice(-10)); // Use last 10 digits

  if (result) {
    return [result.ZFIRSTNAME, result.ZLASTNAME].filter(Boolean).join(' ');
  }
  return null;
}

// Find contact by email
function findContactByEmail(email: string): string | null {
  const result = contactsDb.prepare(`
    SELECT r.ZFIRSTNAME, r.ZLASTNAME
    FROM ZABCDRECORD r
    JOIN ZABCDEMAILADDRESS e ON r.Z_PK = e.ZOWNER
    WHERE LOWER(e.ZADDRESS) = LOWER(?)
    LIMIT 1
  `).get(email);

  if (result) {
    return [result.ZFIRSTNAME, result.ZLASTNAME].filter(Boolean).join(' ');
  }
  return null;
}
```

### Option B: node-mac-contacts (Native API)

Better for write operations or when you need proper Contacts.app integration.

```bash
npm install node-mac-contacts
```

```typescript
import * as contacts from 'node-mac-contacts';

// Check permission
const status = contacts.getAuthStatus();
if (status !== 'Authorized') {
  const result = await contacts.requestAccess();
  if (result === 'Denied') {
    throw new Error('Contacts access denied');
  }
}

// Get all contacts with phone numbers
const allContacts = contacts.getAllContacts();

// Build lookup map
const phoneToName = new Map<string, string>();
for (const contact of allContacts) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  for (const phone of contact.phoneNumbers || []) {
    const normalized = phone.replace(/[\s\-\(\)\+]/g, '');
    phoneToName.set(normalized, name);
    phoneToName.set(normalized.slice(-10), name); // Last 10 digits
  }
}

// Lookup
function resolveContact(identifier: string): string {
  const normalized = identifier.replace(/[\s\-\(\)\+]/g, '');
  return phoneToName.get(normalized)
      || phoneToName.get(normalized.slice(-10))
      || identifier;
}
```

**Required in Info.plist:**
```xml
<key>NSContactsUsageDescription</key>
<string>Access contacts to display names for messages</string>
```

**Sources:**
- [node-mac-contacts GitHub](https://github.com/codebytere/node-mac-contacts)
- [macOS AddressBook Schema](https://michaelwornow.net/2024/12/24/mac-address-book-schema)

---

## 6. Full Disk Access Permissions

### The Problem

`~/Library/Messages/chat.db` is a protected resource. Without Full Disk Access, you get:
```
Error: SQLITE_CANTOPEN: unable to open database file
// or
Error: EPERM: operation not permitted
```

### Checking Permission Status

```bash
npm install node-mac-permissions
```

```typescript
import { getAuthStatus, askForFullDiskAccess } from 'node-mac-permissions';

function checkFullDiskAccess(): boolean {
  const status = getAuthStatus('full-disk-access');
  return status === 'authorized';
}

function promptForFullDiskAccess(): void {
  // Opens System Settings > Privacy & Security > Full Disk Access
  askForFullDiskAccess();
}
```

**Important:** There is NO programmatic way to request Full Disk Access via a system dialog. Users MUST manually add your app in System Settings.

### User Flow

```typescript
async function ensureAccess(): Promise<boolean> {
  if (checkFullDiskAccess()) {
    return true;
  }

  // Show user instructions
  const dialog = await showDialog({
    title: 'Full Disk Access Required',
    message: 'To read your messages, please grant Full Disk Access:\n\n' +
             '1. Click "Open Settings"\n' +
             '2. Click the + button\n' +
             '3. Select this application\n' +
             '4. Restart the app',
    buttons: ['Open Settings', 'Cancel']
  });

  if (dialog.response === 0) {
    promptForFullDiskAccess();
  }

  return false;
}
```

### Testing Without Full Disk Access

For development, you can copy chat.db to a non-protected location:

```bash
cp ~/Library/Messages/chat.db /tmp/chat.db
cp ~/Library/Messages/chat.db-wal /tmp/chat.db-wal
cp ~/Library/Messages/chat.db-shm /tmp/chat.db-shm
```

Then point your code at `/tmp/chat.db`.

**Sources:**
- [node-mac-permissions GitHub](https://github.com/codebytere/node-mac-permissions)
- [Apple Developer Forums - Full Disk Access](https://developer.apple.com/forums/thread/652529)

---

## 7. Sending Messages via AppleScript

### Direct osascript Execution

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function sendMessage(recipient: string, message: string): Promise<void> {
  // Escape special characters for AppleScript
  const escapedMessage = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  const script = `
    tell application "Messages"
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${recipient}" of targetService
      send "${escapedMessage}" to targetBuddy
    end tell
  `;

  try {
    await execFileAsync('osascript', ['-e', script]);
  } catch (error: any) {
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

// Usage
await sendMessage('+15551234567', 'Hello from Electron!');
await sendMessage('user@icloud.com', 'Works with email too');
```

### Using node-osascript Library

```bash
npm install node-osascript
```

```typescript
import * as osascript from 'node-osascript';

function sendMessage(recipient: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = `
      tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy "${recipient}" of targetService
        send "${message.replace(/"/g, '\\"')}" to targetBuddy
      end tell
      return "sent"
    `;

    osascript.execute(script, (err, result) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
```

### Send to Group Chat

```typescript
async function sendToGroup(chatId: string, message: string): Promise<void> {
  const escapedMessage = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const script = `
    tell application "Messages"
      set targetChat to chat id "${chatId}"
      send "${escapedMessage}" to targetChat
    end tell
  `;

  await execFileAsync('osascript', ['-e', script]);
}

// Chat ID format: "chat123456789012345678"
// Get from chat.guid column in database
```

### Required Permissions

First run will prompt for **Automation** permission. Add to Info.plist:

```xml
<key>NSAppleEventsUsageDescription</key>
<string>Send messages through the Messages app</string>
```

**Sources:**
- [node-osascript GitHub](https://github.com/mikaelbr/node-osascript)
- [osa-imessage GitHub](https://github.com/wtfaremyinitials/osa-imessage)
- [Send iMessages via AppleScript Gist](https://gist.github.com/hepcat72/6b7abd9000e8b108ecdb76e12da1257e)

---

## 8. Existing Libraries

### imessage-kit (Recommended for New Projects)

Modern TypeScript SDK with zero dependencies (for Bun) or better-sqlite3 (for Node.js).

```bash
npm install @photon-ai/imessage-kit better-sqlite3
```

```typescript
import { IMessageSDK } from '@photon-ai/imessage-kit';

const sdk = new IMessageSDK();

// Read messages
const messages = await sdk.getMessages({
  sender: '+15551234567',
  unreadOnly: true,
  limit: 20,
  since: new Date('2025-01-01'),
  search: 'meeting'
});

// Send message
await sdk.send('+15551234567', 'Hello!');

// With attachments
await sdk.send('+15551234567', {
  images: ['photo.jpg'],
  files: ['document.pdf']
});

// List group chats
const groups = await sdk.listChats({ type: 'group' });

// Real-time monitoring
await sdk.startWatching({
  onDirectMessage: (msg) => console.log('DM:', msg),
  onGroupMessage: (msg) => console.log('Group:', msg)
});

await sdk.close();
```

**Source:** [imessage-kit GitHub](https://github.com/photon-hq/imessage-kit)

### osa-imessage

Simpler library focused on AppleScript-based sending and polling.

```bash
npm install osa-imessage
```

```typescript
import * as imessage from 'osa-imessage';

// Send
await imessage.send('+15551234567', 'Hello!');

// Listen for new messages (polling)
imessage.listen().on('message', (msg) => {
  if (!msg.fromMe) {
    console.log(`${msg.text} from ${msg.handle}`);
  }
});

// Resolve contact name
const name = await imessage.nameForHandle('+15551234567');
```

**Source:** [osa-imessage GitHub](https://github.com/wtfaremyinitials/osa-imessage)

---

## 9. Working Code Examples

### Complete Message Reader Class

```typescript
// src/imessage/reader.ts
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const APPLE_EPOCH_OFFSET = 978307200;

export interface Message {
  id: number;
  guid: string;
  text: string | null;
  isFromMe: boolean;
  date: Date;
  sender: string;
  chatIdentifier: string;
  chatType: 'direct' | 'group';
  hasAttachments: boolean;
}

export interface Conversation {
  chatId: number;
  chatIdentifier: string;
  displayName: string | null;
  chatType: 'direct' | 'group';
  lastMessageDate: Date;
  participants: string[];
}

export class IMessageReader {
  private db: DatabaseType;

  constructor(dbPath?: string) {
    const path = dbPath || join(homedir(), 'Library/Messages/chat.db');
    this.db = new Database(path, { readonly: true, fileMustExist: true });
  }

  close(): void {
    this.db.close();
  }

  private appleToDate(appleNanos: number): Date {
    const unixMs = (appleNanos / 1_000_000_000 + APPLE_EPOCH_OFFSET) * 1000;
    return new Date(unixMs);
  }

  private dateToApple(date: Date): number {
    const unixSeconds = date.getTime() / 1000;
    return (unixSeconds - APPLE_EPOCH_OFFSET) * 1_000_000_000;
  }

  private decodeAttributedBody(blob: Buffer | null): string | null {
    if (!blob || blob.length === 0) return null;

    const marker = Buffer.from('NSString');
    const markerIndex = blob.indexOf(marker);
    if (markerIndex === -1) return null;

    const contentStart = markerIndex + marker.length + 5;
    if (contentStart >= blob.length) return null;

    let length: number;
    let textStart: number;

    if (blob[contentStart] === 0x81) {
      length = blob.readUInt16LE(contentStart + 1);
      textStart = contentStart + 3;
    } else {
      length = blob[contentStart];
      textStart = contentStart + 1;
    }

    if (textStart + length > blob.length) return null;

    return blob.slice(textStart, textStart + length).toString('utf-8');
  }

  getMessages(options: {
    sender?: string;
    chatIdentifier?: string;
    since?: Date;
    limit?: number;
  } = {}): Message[] {
    const { sender, chatIdentifier, since, limit = 100 } = options;

    let whereConditions: string[] = [];
    let params: any[] = [];

    if (sender) {
      whereConditions.push('h.id = ?');
      params.push(sender);
    }

    if (chatIdentifier) {
      whereConditions.push('c.chat_identifier = ?');
      params.push(chatIdentifier);
    }

    if (since) {
      whereConditions.push('m.date > ?');
      params.push(this.dateToApple(since));
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    params.push(limit);

    const rows = this.db.prepare(`
      SELECT
        m.ROWID as id,
        m.guid,
        m.text,
        m.attributedBody,
        m.is_from_me,
        m.date,
        m.cache_has_attachments,
        h.id as sender_id,
        c.chat_identifier,
        c.style
      FROM message m
      JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      JOIN chat c ON cmj.chat_id = c.ROWID
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      ${whereClause}
      ORDER BY m.date DESC
      LIMIT ?
    `).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      guid: row.guid,
      text: row.text || this.decodeAttributedBody(row.attributedBody),
      isFromMe: row.is_from_me === 1,
      date: this.appleToDate(row.date),
      sender: row.sender_id || 'me',
      chatIdentifier: row.chat_identifier,
      chatType: row.style === 43 ? 'group' : 'direct',
      hasAttachments: row.cache_has_attachments === 1
    }));
  }

  getConversations(options: {
    since?: Date;
    limit?: number;
  } = {}): Conversation[] {
    const { since, limit = 50 } = options;

    const sinceApple = since ? this.dateToApple(since) : 0;

    const rows = this.db.prepare(`
      SELECT
        c.ROWID as chat_id,
        c.chat_identifier,
        c.display_name,
        c.style,
        MAX(m.date) as last_date
      FROM chat c
      JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
      JOIN message m ON cmj.message_id = m.ROWID
      WHERE m.date > ?
      GROUP BY c.ROWID
      ORDER BY last_date DESC
      LIMIT ?
    `).all(sinceApple, limit) as any[];

    return rows.map(row => {
      // Get participants for group chats
      const participants = this.db.prepare(`
        SELECT h.id
        FROM handle h
        JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
        WHERE chj.chat_id = ?
      `).all(row.chat_id).map((p: any) => p.id);

      return {
        chatId: row.chat_id,
        chatIdentifier: row.chat_identifier,
        displayName: row.display_name,
        chatType: row.style === 43 ? 'group' : 'direct',
        lastMessageDate: this.appleToDate(row.last_date),
        participants
      };
    });
  }

  getAwaitingReply(daysBback: number = 7): Message[] {
    const since = new Date(Date.now() - daysBback * 24 * 60 * 60 * 1000);

    const rows = this.db.prepare(`
      WITH last_per_chat AS (
        SELECT
          c.ROWID as chat_id,
          MAX(m.date) as last_date
        FROM message m
        JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        JOIN chat c ON cmj.chat_id = c.ROWID
        WHERE m.date > ?
        GROUP BY c.ROWID
      )
      SELECT
        m.ROWID as id,
        m.guid,
        m.text,
        m.attributedBody,
        m.is_from_me,
        m.date,
        m.cache_has_attachments,
        h.id as sender_id,
        c.chat_identifier,
        c.style
      FROM last_per_chat lpc
      JOIN chat_message_join cmj ON lpc.chat_id = cmj.chat_id
      JOIN message m ON cmj.message_id = m.ROWID AND m.date = lpc.last_date
      JOIN chat c ON lpc.chat_id = c.ROWID
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE m.is_from_me = 0
      ORDER BY m.date ASC
    `).all(this.dateToApple(since)) as any[];

    return rows.map(row => ({
      id: row.id,
      guid: row.guid,
      text: row.text || this.decodeAttributedBody(row.attributedBody),
      isFromMe: false,
      date: this.appleToDate(row.date),
      sender: row.sender_id,
      chatIdentifier: row.chat_identifier,
      chatType: row.style === 43 ? 'group' : 'direct',
      hasAttachments: row.cache_has_attachments === 1
    }));
  }
}
```

### Complete Message Sender Class

```typescript
// src/imessage/sender.ts
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class IMessageSender {
  private escapeForAppleScript(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  async send(recipient: string, message: string): Promise<void> {
    const escaped = this.escapeForAppleScript(message);

    const script = `
      tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy "${recipient}" of targetService
        send "${escaped}" to targetBuddy
      end tell
    `;

    try {
      await execFileAsync('osascript', ['-e', script]);
    } catch (error: any) {
      // Parse AppleScript error
      const stderr = error.stderr || error.message;
      if (stderr.includes('Can\'t get buddy')) {
        throw new Error(`Cannot send to ${recipient}: not an iMessage contact or phone not registered with iMessage`);
      }
      throw new Error(`Failed to send message: ${stderr}`);
    }
  }

  async sendToGroup(chatId: string, message: string): Promise<void> {
    const escaped = this.escapeForAppleScript(message);

    // chatId should be the chat.guid from database, e.g., "chat123456789012345678"
    const script = `
      tell application "Messages"
        set targetChat to chat id "${chatId}"
        send "${escaped}" to targetChat
      end tell
    `;

    try {
      await execFileAsync('osascript', ['-e', script]);
    } catch (error: any) {
      throw new Error(`Failed to send to group: ${error.stderr || error.message}`);
    }
  }
}
```

### Electron Main Process Integration

```typescript
// src/main/ipc-handlers.ts
import { ipcMain } from 'electron';
import { IMessageReader } from './imessage/reader';
import { IMessageSender } from './imessage/sender';
import { getAuthStatus, askForFullDiskAccess } from 'node-mac-permissions';

let reader: IMessageReader | null = null;
const sender = new IMessageSender();

// Permission check
ipcMain.handle('imessage:check-permission', () => {
  return getAuthStatus('full-disk-access') === 'authorized';
});

ipcMain.handle('imessage:request-permission', () => {
  askForFullDiskAccess();
});

// Initialize reader
ipcMain.handle('imessage:init', () => {
  try {
    reader = new IMessageReader();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Get messages
ipcMain.handle('imessage:get-messages', (_, options) => {
  if (!reader) throw new Error('Reader not initialized');
  return reader.getMessages(options);
});

// Get conversations
ipcMain.handle('imessage:get-conversations', (_, options) => {
  if (!reader) throw new Error('Reader not initialized');
  return reader.getConversations(options);
});

// Get awaiting reply
ipcMain.handle('imessage:get-awaiting-reply', (_, daysBack) => {
  if (!reader) throw new Error('Reader not initialized');
  return reader.getAwaitingReply(daysBack);
});

// Send message
ipcMain.handle('imessage:send', async (_, { recipient, message }) => {
  try {
    await sender.send(recipient, message);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Cleanup
ipcMain.handle('imessage:close', () => {
  reader?.close();
  reader = null;
});
```

### Preload Script

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('imessage', {
  checkPermission: () => ipcRenderer.invoke('imessage:check-permission'),
  requestPermission: () => ipcRenderer.invoke('imessage:request-permission'),
  init: () => ipcRenderer.invoke('imessage:init'),
  getMessages: (options: any) => ipcRenderer.invoke('imessage:get-messages', options),
  getConversations: (options: any) => ipcRenderer.invoke('imessage:get-conversations', options),
  getAwaitingReply: (daysBack?: number) => ipcRenderer.invoke('imessage:get-awaiting-reply', daysBack),
  send: (recipient: string, message: string) =>
    ipcRenderer.invoke('imessage:send', { recipient, message }),
  close: () => ipcRenderer.invoke('imessage:close')
});
```

---

## Summary

| Task | Recommended Approach |
|------|---------------------|
| SQLite library | better-sqlite3 with electron-rebuild |
| Reading messages | Direct chat.db queries |
| Text extraction | Decode attributedBody blob for Ventura+ |
| Contact resolution | AddressBook SQLite or node-mac-contacts |
| Permissions | node-mac-permissions for status checks |
| Sending messages | AppleScript via osascript |
| High-level SDK | imessage-kit for rapid development |

**Key Pitfalls to Avoid:**
1. Forgetting to rebuild native modules after Electron updates
2. Not handling attributedBody for Ventura+ messages
3. Assuming Full Disk Access can be requested programmatically
4. Not escaping special characters in AppleScript strings
5. Using sql.js for large databases (memory issues)
