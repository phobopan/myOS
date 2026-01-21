# Roadmap: phoebeOS

**Created:** 2026-01-20
**Updated:** 2026-01-21 (Phase 2 complete)
**Depth:** Standard
**Phases:** 6

## Overview

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 1 | Foundation | Electron app with glassmorphism UI ready to receive data | SHELL-01, SHELL-02, SHELL-03, SHELL-04 |
| 2 | iMessage | Users can read and respond to iMessages | IMSG-01, IMSG-02, IMSG-03, IMSG-04, IMSG-05, IMSG-06 |
| 3 | Gmail | Users can read and respond to Gmail threads | GMAIL-01, GMAIL-02, GMAIL-03, GMAIL-04, GMAIL-05, GMAIL-06, GMAIL-07 |
| 4 | Instagram | Users can read and respond to Instagram DMs | INSTA-01, INSTA-02, INSTA-03, INSTA-04, INSTA-05, INSTA-06 |
| 5 | Unified Inbox | All sources combined into single prioritized stream | INBOX-01, INBOX-02, INBOX-03, INBOX-04, INBOX-05, INBOX-06 |
| 6 | Polish | Full keyboard navigation and notification system | KEYS-01, KEYS-02, KEYS-03, KEYS-04, KEYS-05, NOTIF-01, NOTIF-02, NOTIF-03 |

## Phase Details

### Phase 1: Foundation

**Goal:** Electron app with glassmorphism UI ready to receive data sources

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold Electron + React + TypeScript with glassmorphism window
- [x] 01-02-PLAN.md — Two-pane layout with settings panel

**Requirements:**
- SHELL-01: App displays glassmorphism UI with translucent materials, blur effects, and white text
- SHELL-02: App uses two-pane layout with message list on left and thread view on right
- SHELL-03: App window supports resize, minimize, and standard macOS window behaviors
- SHELL-04: App includes settings panel for notification preferences and account management

**Success Criteria:**
1. User sees a glassmorphism window with translucent blur effects and white text on launch
2. User sees a two-pane layout with empty message list on left and empty thread view on right
3. User can resize, minimize, and close the window using standard macOS controls
4. User can open a settings panel showing placeholders for notification and account options

**Technical Approach:**
- Electron with `vibrancy: 'under-window'` and `transparent: true`
- React + TypeScript + Tailwind CSS
- `titleBarStyle: 'hiddenInset'` with custom traffic light positioning
- CSS `backdrop-filter` for layered glass effects

**Dependencies:** None

---

### Phase 2: iMessage

**Goal:** Users can read and respond to iMessage conversations directly from the app

**Plans:** 5 plans

Plans:
- [x] 02-01-PLAN.md — Install dependencies and create iMessage database service
- [x] 02-02-PLAN.md — Contact resolution and Full Disk Access permission flow
- [x] 02-03-PLAN.md — IPC bridge connecting renderer to iMessage services
- [x] 02-04-PLAN.md — Wire UI to real iMessage data with attachments and reactions
- [x] 02-05-PLAN.md — Message sending via AppleScript with optimistic UI

**Requirements:**
- IMSG-01: App reads iMessage threads from local chat.db (requires Full Disk Access)
- IMSG-02: App resolves contacts to show names instead of phone numbers/emails
- IMSG-03: Thread view displays images and attachments
- IMSG-04: Thread view shows reactions (like, love, laugh, etc.) on messages
- IMSG-05: App supports group chat conversations
- IMSG-06: User can send replies via the app (using AppleScript)

**Success Criteria:**
1. User sees their iMessage conversations populated in the message list (with Full Disk Access granted)
2. User sees contact names instead of raw phone numbers or email addresses
3. User can click a conversation and see the thread including images, attachments, and reactions
4. User can type a reply and send it, with the message appearing in Messages.app
5. User can view and reply to group chat conversations

**Technical Approach:**
- `better-sqlite3` with `@electron/rebuild` for native module
- Parse `attributedBody` blob for message text (NSAttributedString format)
- `node-mac-contacts` or AddressBook SQLite for contact resolution
- `osascript` via `child_process.execFile` for sending

**Dependencies:** Phase 1 (Foundation)

---

### Phase 3: Gmail

**Goal:** Users can read and respond to Gmail threads with full email composition features

**Requirements:**
- GMAIL-01: User can authenticate with Google via OAuth
- GMAIL-02: Stream shows only emails from Primary inbox (excludes Promotions, Social, Updates)
- GMAIL-03: Thread view shows full email conversation history
- GMAIL-04: User can Reply, Reply All, or Forward emails
- GMAIL-05: User can edit subject line when replying
- GMAIL-06: User can add CC and BCC recipients
- GMAIL-07: Thread view displays email attachments

**Success Criteria:**
1. User can sign in with Google account and see only Primary inbox emails in the list
2. User can click an email and see the full conversation thread with attachments displayed
3. User can compose a reply with customizable subject, CC/BCC fields, and send successfully
4. User can choose Reply All to include all thread participants or Forward to new recipients
5. User sees their sent reply appear in the Gmail thread

**Technical Approach:**
- `googleapis` npm package for Gmail API
- OAuth 2.0 with loopback redirect (127.0.0.1)
- Token storage via Electron's `safeStorage` API
- `category:primary` query for inbox filtering
- RFC 2822 message construction with `In-Reply-To` and `References` headers

**Dependencies:** Phase 1 (Foundation)

---

### Phase 4: Instagram

**Goal:** Users can read and respond to Instagram DMs within the 24-hour messaging window

**Requirements:**
- INSTA-01: User can authenticate via Facebook for Instagram Business/Creator account
- INSTA-02: App reads Instagram DM threads via Graph API
- INSTA-03: Thread view shows Instagram usernames and profile names
- INSTA-04: User can send text replies within 24-hour messaging window
- INSTA-05: Thread view displays images received in DMs
- INSTA-06: Expired conversations (past 24hr window) show visual indicator and prompt to reply via Instagram app

**Success Criteria:**
1. User can authenticate with Facebook and connect their Instagram Business/Creator account
2. User sees their Instagram DM conversations in the message list with usernames and profile names
3. User can click a conversation and see the thread including images received
4. User can send a text reply to conversations within the 24-hour window
5. User sees a clear visual indicator on expired conversations with guidance to use Instagram app directly

**Technical Approach:**
- Facebook OAuth with `https://www.facebook.com/connect/login_success.html` redirect
- Instagram Graph API via axios/fetch
- Track `timestamp` on last user message for 24-hour window detection
- Rate limit handling (200 requests/hour per account)

**Dependencies:** Phase 1 (Foundation)

---

### Phase 5: Unified Inbox

**Goal:** All three sources combined into a single prioritized stream with filtering

**Requirements:**
- INBOX-01: Stream shows only messages user has not responded to
- INBOX-02: Stream auto-refreshes to check for new messages
- INBOX-03: Stream sorts messages with most recent at top
- INBOX-04: Each message shows source icon (iMessage/Gmail/Instagram)
- INBOX-05: User can filter stream by source using filter buttons
- INBOX-06: Clicking a message shows thread in right pane, message removed from list after reply and navigation away

**Success Criteria:**
1. User sees only unreplied messages from all three sources in a single unified list
2. User sees source icons (iMessage/Gmail/Instagram) distinguishing each conversation
3. User can filter the list to show only specific sources using filter buttons
4. User sees new messages appear automatically without manual refresh
5. User sees conversations disappear from the list after replying and navigating away (inbox zero behavior)

**Technical Approach:**
- Unified message interface adapting each source
- React state management for filter/selection
- Polling intervals (iMessage: 5s local, Gmail/Instagram: 30s API)
- Optimistic UI updates after sending

**Dependencies:** Phase 2 (iMessage), Phase 3 (Gmail), Phase 4 (Instagram)

---

### Phase 6: Polish

**Goal:** Full keyboard navigation and macOS notification system complete the experience

**Requirements:**
- KEYS-01: User can navigate with arrow keys and Tab between list and composer
- KEYS-02: User can send with Cmd+Enter and refresh with Cmd+R
- KEYS-03: User can filter by source with Cmd+1 (iMessage), Cmd+2 (Gmail), Cmd+3 (Instagram)
- KEYS-04: User can show/hide app with global system hotkey
- KEYS-05: Settings panel displays all available keyboard shortcuts
- NOTIF-01: App sends macOS system notifications for new messages
- NOTIF-02: App shows unread count as dock badge
- NOTIF-03: User can enable/disable notifications per source in settings

**Success Criteria:**
1. User can navigate the entire app using only keyboard (arrow keys, Tab, Cmd+Enter, Cmd+R)
2. User can quickly filter sources using Cmd+1/2/3 shortcuts
3. User can summon/dismiss the app from anywhere with a global hotkey
4. User receives macOS notifications for new messages and sees badge count on dock icon
5. User can customize notification preferences per source in settings

**Technical Approach:**
- Electron `globalShortcut` for system-wide hotkey
- React keyboard event handlers for in-app navigation
- Electron `Notification` API for macOS notifications
- `app.dock.setBadge()` for unread count

**Dependencies:** Phase 5 (Unified Inbox)

---

## Progress

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Foundation | Complete | 100% |
| 2 | iMessage | Complete | 100% |
| 3 | Gmail | Pending | 0% |
| 4 | Instagram | Pending | 0% |
| 5 | Unified Inbox | Pending | 0% |
| 6 | Polish | Pending | 0% |

---
*Roadmap created: 2026-01-20*
*Last updated: 2026-01-21 (Phase 2 complete)*
