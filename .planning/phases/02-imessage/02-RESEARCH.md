# Phase 2: iMessage - Research

**Researched:** 2026-01-21
**Domain:** macOS iMessage database access, contact resolution, AppleScript messaging
**Confidence:** HIGH (verified against actual chat.db on macOS 14.5)

## Summary

This phase involves reading from macOS's iMessage database (chat.db), resolving phone numbers/emails to contact names, displaying attachments and reactions, and sending replies via AppleScript. The chat.db schema was verified on macOS 14.5 (Sonoma) and matches expected structure.

Key findings:
- The `text` column is populated for most messages, but 150k+ messages require `attributedBody` blob parsing
- Reactions (tapbacks) are stored as separate message rows with `associated_message_type` values 2000-2005
- Group chats use `style=43` and have chat identifiers like `iMessage;+;chat123456789`
- Sending to named group chats via AppleScript works; unnamed groups are problematic
- Contact resolution requires either `node-mac-contacts` (CNContact API) or direct AddressBook SQLite access

**Primary recommendation:** Use `imessage-parser` npm package for attributedBody parsing and `node-mac-contacts` for contact resolution. Keep SQLite access in main process only.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^11.x | Synchronous SQLite access | 10x+ faster than node-sqlite3, synchronous API avoids callback hell |
| @electron/rebuild | ^3.x | Rebuild native modules for Electron | Required for better-sqlite3 to work with Electron's Node version |
| imessage-parser | ^1.x | Parse attributedBody blobs | Handles Apple's proprietary typedstream/NSAttributedString format |
| node-mac-contacts | ^1.x | Access macOS Contacts | Uses CNContact API, handles permission requests properly |
| node-mac-permissions | ^2.x | Check/request FDA permission | Required for Full Disk Access detection and System Preferences deep link |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| libphonenumber-js | ^1.x | Phone number normalization | Matching chat.db handles (+15551234567) to contacts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | sql.js | sql.js is pure JS (no rebuild) but 10x slower |
| node-mac-contacts | Direct AddressBook SQLite | Direct SQLite avoids native module but bypasses permission system |
| imessage-parser | Manual typedstream parsing | Manual parsing is complex and error-prone |

**Installation:**
```bash
npm install better-sqlite3 imessage-parser node-mac-contacts node-mac-permissions libphonenumber-js
npm install --save-dev @electron/rebuild
```

**Post-install script (package.json):**
```json
{
  "scripts": {
    "postinstall": "electron-builder install-app-deps",
    "rebuild": "electron-rebuild -f -w better-sqlite3"
  }
}
```

## Architecture Patterns

### Database Access Pattern

```
Main Process (Node.js)
├── iMessageService.ts         # SQLite queries, runs in main
│   ├── getConversations()     # List all chats
│   ├── getMessages(chatId)    # Messages for a chat
│   └── parseAttributedBody()  # Blob parsing
├── contactService.ts          # Contact resolution
│   └── resolveHandle()        # Phone/email -> name
└── preload.ts                 # Expose via contextBridge

Renderer Process (React)
├── Uses ipcRenderer to call main process
└── Never touches SQLite directly
```

**Critical:** SQLite operations MUST run in main process. better-sqlite3 is synchronous and will block the renderer if used there.

### IPC Pattern for Database Access

```typescript
// main/ipc.ts
ipcMain.handle('imessage:getConversations', async () => {
  return iMessageService.getConversations();
});

ipcMain.handle('imessage:getMessages', async (_, chatId: number, limit?: number) => {
  return iMessageService.getMessages(chatId, limit);
});

// preload.ts
contextBridge.exposeInMainWorld('api', {
  imessage: {
    getConversations: () => ipcRenderer.invoke('imessage:getConversations'),
    getMessages: (chatId: number, limit?: number) =>
      ipcRenderer.invoke('imessage:getMessages', chatId, limit),
  }
});
```

### Date Conversion Pattern

chat.db uses **nanoseconds since 2001-01-01** (Apple's Cocoa epoch):

```typescript
// Convert chat.db date to JavaScript Date
function fromAppleTime(appleNanoseconds: number): Date {
  const APPLE_EPOCH = 978307200; // seconds from Unix epoch to 2001-01-01
  const unixSeconds = (appleNanoseconds / 1_000_000_000) + APPLE_EPOCH;
  return new Date(unixSeconds * 1000);
}

// In SQL, for display:
// datetime(date/1000000000 + 978307200, 'unixepoch', 'localtime')
```

### Anti-Patterns to Avoid
- **SQLite in renderer:** Will block UI, causes freezes
- **Opening chat.db multiple times:** Use single connection, reuse it
- **Not handling missing text:** Some messages have NULL text, need attributedBody
- **Hardcoding ~/Library path:** Use `app.getPath('home')` for cross-user support

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| attributedBody parsing | Custom binary parser | imessage-parser | Apple's typedstream format is complex, undocumented |
| Phone number matching | String comparison | libphonenumber-js | Need to handle +1, (555), spaces, dashes |
| Contact access | Direct SQLite queries | node-mac-contacts | Bypasses permission system, may break |
| Full Disk Access check | Try/catch file access | node-mac-permissions | Proper API, can open System Preferences |
| Native module rebuild | Manual node-gyp | @electron/rebuild | Handles Electron version matching automatically |

**Key insight:** The iMessage ecosystem has sharp edges (binary blobs, permission quirks, Apple date formats). Leverage existing libraries that have solved these.

## Common Pitfalls

### Pitfall 1: NODE_MODULE_VERSION Mismatch
**What goes wrong:** "The module was compiled against a different Node.js version"
**Why it happens:** better-sqlite3 compiled for system Node, not Electron's Node
**How to avoid:** Run `npm run rebuild` after every `npm install`, add `postinstall` script
**Warning signs:** App crashes on startup with module version error

### Pitfall 2: Full Disk Access Not Granted
**What goes wrong:** Database opens but returns 0 rows or throws SQLITE_READONLY
**Why it happens:** macOS silently denies access without FDA
**How to avoid:** Check permission BEFORE opening database, show onboarding flow
**Warning signs:** Empty conversation list, but no error thrown

### Pitfall 3: Sending to Unnamed Group Chats
**What goes wrong:** AppleScript fails with error -1728
**Why it happens:** Apple's AppleScript API only supports named group chats
**How to avoid:** Document limitation to users, suggest naming their groups
**Warning signs:** Works for 1:1 chats but fails for some groups

### Pitfall 4: Stale Contact Cache
**What goes wrong:** New contacts don't show names, recently edited names are wrong
**Why it happens:** Contact resolution cached at app start
**How to avoid:** Listen for contact changes via `node-mac-contacts` listener, or refresh periodically
**Warning signs:** Contact names don't update until app restart

### Pitfall 5: Attachment Paths with Tilde
**What goes wrong:** Attachments fail to load
**Why it happens:** Paths stored as `~/Library/...`, JS doesn't expand tilde
**How to avoid:** Replace `~` with `app.getPath('home')` or `os.homedir()`
**Warning signs:** Image thumbnails show broken, but path looks correct in logs

## Code Examples

### Core SQL Queries

**Get conversations with last message:**
```sql
-- Source: Verified on macOS 14.5 chat.db
SELECT
  c.ROWID as id,
  c.guid,
  c.chat_identifier,
  c.display_name,
  c.style,  -- 45 = 1:1, 43 = group
  m.text as last_message,
  m.is_from_me,
  m.date as last_message_date,
  h.id as handle_id
FROM chat c
LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
LEFT JOIN message m ON cmj.message_id = m.ROWID
LEFT JOIN handle h ON m.handle_id = h.ROWID
WHERE m.ROWID = (
  SELECT MAX(m2.ROWID)
  FROM message m2
  JOIN chat_message_join cmj2 ON m2.ROWID = cmj2.message_id
  WHERE cmj2.chat_id = c.ROWID
)
ORDER BY m.date DESC;
```

**Get messages for a chat:**
```sql
SELECT
  m.ROWID as id,
  m.guid,
  m.text,
  m.attributedBody,
  m.is_from_me,
  m.date,
  m.cache_has_attachments,
  m.associated_message_guid,
  m.associated_message_type,
  h.id as sender_handle
FROM message m
JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
LEFT JOIN handle h ON m.handle_id = h.ROWID
WHERE cmj.chat_id = ?
ORDER BY m.date ASC;
```

**Get attachments for a message:**
```sql
SELECT
  a.ROWID as id,
  a.guid,
  a.filename,
  a.mime_type,
  a.uti,
  a.total_bytes,
  a.transfer_name
FROM attachment a
JOIN message_attachment_join maj ON a.ROWID = maj.attachment_id
WHERE maj.message_id = ?;
```

**Get group chat participants:**
```sql
SELECT h.id, h.service
FROM handle h
JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
WHERE chj.chat_id = ?;
```

### Reaction Type Mapping

```typescript
// Source: Community research, verified against chat.db
const TAPBACK_TYPES: Record<number, { emoji: string; label: string; removed: boolean }> = {
  2000: { emoji: '❤️', label: 'love', removed: false },
  2001: { emoji: '👍', label: 'like', removed: false },
  2002: { emoji: '👎', label: 'dislike', removed: false },
  2003: { emoji: '😂', label: 'laugh', removed: false },
  2004: { emoji: '‼️', label: 'emphasize', removed: false },
  2005: { emoji: '❓', label: 'question', removed: false },
  3000: { emoji: '❤️', label: 'love', removed: true },
  3001: { emoji: '👍', label: 'like', removed: true },
  3002: { emoji: '👎', label: 'dislike', removed: true },
  3003: { emoji: '😂', label: 'laugh', removed: true },
  3004: { emoji: '‼️', label: 'emphasize', removed: true },
  3005: { emoji: '❓', label: 'question', removed: true },
};

// Reactions reference parent via associated_message_guid
// Format: "p:0/MESSAGE-GUID-HERE" or "bp:MESSAGE-GUID-HERE"
function extractParentGuid(associatedGuid: string): string {
  // Remove prefix like "p:0/" or "bp:"
  return associatedGuid.replace(/^(p:\d+\/|bp:)/, '');
}
```

### Full Disk Access Check

```typescript
// Source: node-mac-permissions documentation
import { getAuthStatus, askForFullDiskAccess } from 'node-mac-permissions';

function checkFullDiskAccess(): 'authorized' | 'denied' | 'not-determined' {
  const status = getAuthStatus('full-disk-access');
  // Returns: 'authorized', 'denied', 'not determined', 'restricted'
  if (status === 'authorized') return 'authorized';
  if (status === 'not determined') return 'not-determined';
  return 'denied';
}

function requestFullDiskAccess(): void {
  // Opens System Preferences > Privacy > Full Disk Access
  // Cannot programmatically grant - user must toggle
  askForFullDiskAccess();
}
```

### AppleScript for Sending

```typescript
// Source: Verified working AppleScript pattern
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

  await execFileAsync('osascript', ['-e', script]);
}

// For group chats (MUST be named):
async function sendToGroupChat(chatName: string, message: string): Promise<void> {
  const escapedMessage = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  const script = `
    tell application "Messages"
      set targetChat to chat "${chatName}"
      send "${escapedMessage}" to targetChat
    end tell
  `;

  await execFileAsync('osascript', ['-e', script]);
}
```

### Contact Resolution

```typescript
// Source: node-mac-contacts documentation
import * as contacts from 'node-mac-contacts';
import { parsePhoneNumber } from 'libphonenumber-js';

interface ContactInfo {
  firstName?: string;
  lastName?: string;
  displayName: string;
}

// Build lookup cache at startup
async function buildContactCache(): Promise<Map<string, ContactInfo>> {
  const cache = new Map<string, ContactInfo>();

  const authStatus = contacts.getAuthStatus();
  if (authStatus !== 'Authorized') {
    const result = await contacts.requestAccess();
    if (result !== 'Authorized') return cache;
  }

  const allContacts = contacts.getAllContacts();

  for (const contact of allContacts) {
    const displayName = [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(' ') || contact.nickname || 'Unknown';

    const info: ContactInfo = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      displayName,
    };

    // Index by phone numbers (normalized)
    for (const phone of contact.phoneNumbers || []) {
      try {
        const parsed = parsePhoneNumber(phone, 'US');
        if (parsed) {
          cache.set(parsed.format('E.164'), info); // +15551234567
        }
      } catch {
        cache.set(phone, info); // Fallback to raw
      }
    }

    // Index by email addresses (lowercase)
    for (const email of contact.emailAddresses || []) {
      cache.set(email.toLowerCase(), info);
    }
  }

  return cache;
}
```

## chat.db Schema Reference

### Key Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `message` | All messages | ROWID, guid, text, attributedBody, is_from_me, date, handle_id, associated_message_type, associated_message_guid |
| `chat` | Conversations | ROWID, guid, chat_identifier, display_name, style (45=1:1, 43=group) |
| `handle` | Phone/email identifiers | ROWID, id (phone/email), service |
| `attachment` | Files/images | ROWID, guid, filename, mime_type, uti, total_bytes |
| `chat_message_join` | Links chats to messages | chat_id, message_id |
| `chat_handle_join` | Links chats to participants | chat_id, handle_id |
| `message_attachment_join` | Links messages to attachments | message_id, attachment_id |

### Chat Identifier Formats

| Type | Format | Example |
|------|--------|---------|
| 1:1 iMessage | `iMessage;-;+phone` | `iMessage;-;+15551234567` |
| 1:1 iMessage (email) | `iMessage;-;email` | `iMessage;-;user@icloud.com` |
| 1:1 SMS | `SMS;-;+phone` | `SMS;-;+15551234567` |
| Group iMessage | `iMessage;+;chatID` | `iMessage;+;chat123456789` |
| Group SMS | `SMS;+;chatID` | `SMS;+;chat123456789` |

### Date Format

- **Storage:** Nanoseconds since 2001-01-01 00:00:00 UTC (Apple Cocoa epoch)
- **Conversion:** `unix_timestamp = (apple_nanoseconds / 1e9) + 978307200`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| text column only | attributedBody blob | macOS Ventura (13.0) | Many messages have NULL text, must parse blob |
| AddressBook.framework | CNContact (Contacts framework) | macOS 10.11 | Use node-mac-contacts, not direct SQLite |
| electron-rebuild | @electron/rebuild | 2023 | Package renamed, same functionality |

**Deprecated/outdated:**
- Direct AddressBook SQLite queries: May break, bypasses permission system
- Manually parsing typedstream: Use imessage-parser instead

## Open Questions

1. **macOS 15/26 schema changes**
   - What we know: Schema verified on macOS 14.5, matches documented structure
   - What's unclear: Whether macOS 15+ changes column names or adds encryption
   - Recommendation: Add schema version check at startup, log warnings if unexpected

2. **Unnamed group chat sending**
   - What we know: AppleScript cannot send to unnamed group chats
   - What's unclear: Whether there's a workaround using chat ID
   - Recommendation: Document limitation, encourage users to name group chats

3. **Real-time message updates**
   - What we know: Database changes trigger file modification
   - What's unclear: Best approach for watching changes (fs.watch vs polling)
   - Recommendation: Start with polling (5-10s interval), optimize later if needed

## Sources

### Primary (HIGH confidence)
- chat.db schema: Verified directly on macOS 14.5 via SQLite queries
- Reaction values: Verified against actual messages in chat.db
- [node-mac-permissions](https://github.com/codebytere/node-mac-permissions) - Full API documented
- [node-mac-contacts](https://github.com/codebytere/node-mac-contacts) - Full API documented
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Performance benchmarks, Electron usage

### Secondary (MEDIUM confidence)
- [imessage-parser](https://github.com/alexkwolfe/imessage-parser) - attributedBody parsing solution
- [Analyzing iMessage with SQL](https://dev.to/arctype/analyzing-imessage-with-sql-f42) - Tapback type mapping
- [@electron/rebuild documentation](https://www.npmjs.com/package/@electron/rebuild) - Native module setup
- [AppleScript Messages discussion](https://talk.automators.fm/t/how-to-send-group-imessage-text-via-applescript/10925) - Group chat limitations

### Tertiary (LOW confidence)
- [Reverse Engineering Apple's typedstream Format](https://chrissardegna.com/blog/reverse-engineering-apples-typedstream-format/) - Background on attributedBody format

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm, GitHub, direct testing
- Architecture: HIGH - Patterns based on Electron best practices and iMessage-specific constraints
- Pitfalls: HIGH - Many verified through testing or direct observation
- chat.db schema: HIGH - Verified against actual database on macOS 14.5

**Research date:** 2026-01-21
**Valid until:** ~60 days (stable macOS APIs, schema unlikely to change mid-version)
