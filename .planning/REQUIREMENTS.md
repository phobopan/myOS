# Requirements: phoebeOS

**Defined:** 2026-01-20
**Core Value:** Never miss an important message. One place to see everything that needs a response.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### App Shell

- [ ] **SHELL-01**: App displays glassmorphism UI with translucent materials, blur effects, and white text
- [ ] **SHELL-02**: App uses two-pane layout with message list on left and thread view on right
- [ ] **SHELL-03**: App window supports resize, minimize, and standard macOS window behaviors
- [ ] **SHELL-04**: App includes settings panel for notification preferences and account management

### Unified Inbox

- [ ] **INBOX-01**: Stream shows only messages user has not responded to
- [ ] **INBOX-02**: Stream auto-refreshes to check for new messages
- [ ] **INBOX-03**: Stream sorts messages with most recent at top
- [ ] **INBOX-04**: Each message shows source icon (iMessage/Gmail/Instagram)
- [ ] **INBOX-05**: User can filter stream by source using filter buttons
- [ ] **INBOX-06**: Clicking a message shows thread in right pane, message removed from list after reply and navigation away

### iMessage

- [ ] **IMSG-01**: App reads iMessage threads from local chat.db (requires Full Disk Access)
- [ ] **IMSG-02**: App resolves contacts to show names instead of phone numbers/emails
- [ ] **IMSG-03**: Thread view displays images and attachments
- [ ] **IMSG-04**: Thread view shows reactions (like, love, laugh, etc.) on messages
- [ ] **IMSG-05**: App supports group chat conversations
- [ ] **IMSG-06**: User can send replies via the app (using AppleScript)

### Gmail

- [ ] **GMAIL-01**: User can authenticate with Google via OAuth
- [ ] **GMAIL-02**: Stream shows only emails from Primary inbox (excludes Promotions, Social, Updates)
- [ ] **GMAIL-03**: Thread view shows full email conversation history
- [ ] **GMAIL-04**: User can Reply, Reply All, or Forward emails
- [ ] **GMAIL-05**: User can edit subject line when replying
- [ ] **GMAIL-06**: User can add CC and BCC recipients
- [ ] **GMAIL-07**: Thread view displays email attachments

### Instagram

- [ ] **INSTA-01**: User can authenticate via Facebook for Instagram Business/Creator account
- [ ] **INSTA-02**: App reads Instagram DM threads via Graph API
- [ ] **INSTA-03**: Thread view shows Instagram usernames and profile names
- [ ] **INSTA-04**: User can send text replies within 24-hour messaging window
- [ ] **INSTA-05**: Thread view displays images received in DMs
- [ ] **INSTA-06**: Expired conversations (past 24hr window) show visual indicator and prompt to reply via Instagram app

### Keyboard Shortcuts

- [ ] **KEYS-01**: User can navigate with arrow keys and Tab between list and composer
- [ ] **KEYS-02**: User can send with Cmd+Enter and refresh with Cmd+R
- [ ] **KEYS-03**: User can filter by source with Cmd+1 (iMessage), Cmd+2 (Gmail), Cmd+3 (Instagram)
- [ ] **KEYS-04**: User can show/hide app with global system hotkey
- [ ] **KEYS-05**: Settings panel displays all available keyboard shortcuts

### Notifications

- [ ] **NOTIF-01**: App sends macOS system notifications for new messages
- [ ] **NOTIF-02**: App shows unread count as dock badge
- [ ] **NOTIF-03**: User can enable/disable notifications per source in settings

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### iMessage Enhancements

- **IMSG-07**: Show typing indicators when others are typing
- **IMSG-08**: Show read receipts on sent messages

### Gmail Enhancements

- **GMAIL-08**: User can compose new email (not just reply to existing)
- **GMAIL-09**: Rich text formatting in email composer

### Instagram Enhancements

- **INSTA-07**: Show countdown timer for 24-hour reply window
- **INSTA-08**: Send images in DM replies (if API supports in future)

### Additional Platforms

- **PLAT-01**: Slack integration
- **PLAT-02**: Discord integration
- **PLAT-03**: Twitter/X DM integration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Dismiss/snooze messages | Deliberately excluded to enforce inbox zero behavior |
| Unofficial Instagram API | Risk to account not worth the additional functionality |
| Mac App Store distribution | Full Disk Access for iMessage incompatible with sandboxing |
| Send images via Instagram | Official API doesn't support sending media |
| Archive functionality | Conflicts with "respond to clear" philosophy |
| Search across messages | v1 focuses on "respond to" workflow, not lookup |
| Folders/labels/tags | Adds complexity counter to unified stream concept |
| Draft saving | Messages should be sent, not saved for later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 1 - Foundation | Pending |
| SHELL-02 | Phase 1 - Foundation | Pending |
| SHELL-03 | Phase 1 - Foundation | Pending |
| SHELL-04 | Phase 1 - Foundation | Pending |
| IMSG-01 | Phase 2 - iMessage | Pending |
| IMSG-02 | Phase 2 - iMessage | Pending |
| IMSG-03 | Phase 2 - iMessage | Pending |
| IMSG-04 | Phase 2 - iMessage | Pending |
| IMSG-05 | Phase 2 - iMessage | Pending |
| IMSG-06 | Phase 2 - iMessage | Pending |
| GMAIL-01 | Phase 3 - Gmail | Pending |
| GMAIL-02 | Phase 3 - Gmail | Pending |
| GMAIL-03 | Phase 3 - Gmail | Pending |
| GMAIL-04 | Phase 3 - Gmail | Pending |
| GMAIL-05 | Phase 3 - Gmail | Pending |
| GMAIL-06 | Phase 3 - Gmail | Pending |
| GMAIL-07 | Phase 3 - Gmail | Pending |
| INSTA-01 | Phase 4 - Instagram | Pending |
| INSTA-02 | Phase 4 - Instagram | Pending |
| INSTA-03 | Phase 4 - Instagram | Pending |
| INSTA-04 | Phase 4 - Instagram | Pending |
| INSTA-05 | Phase 4 - Instagram | Pending |
| INSTA-06 | Phase 4 - Instagram | Pending |
| INBOX-01 | Phase 5 - Unified Inbox | Pending |
| INBOX-02 | Phase 5 - Unified Inbox | Pending |
| INBOX-03 | Phase 5 - Unified Inbox | Pending |
| INBOX-04 | Phase 5 - Unified Inbox | Pending |
| INBOX-05 | Phase 5 - Unified Inbox | Pending |
| INBOX-06 | Phase 5 - Unified Inbox | Pending |
| KEYS-01 | Phase 6 - Polish | Pending |
| KEYS-02 | Phase 6 - Polish | Pending |
| KEYS-03 | Phase 6 - Polish | Pending |
| KEYS-04 | Phase 6 - Polish | Pending |
| KEYS-05 | Phase 6 - Polish | Pending |
| NOTIF-01 | Phase 6 - Polish | Pending |
| NOTIF-02 | Phase 6 - Polish | Pending |
| NOTIF-03 | Phase 6 - Polish | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-01-20 after roadmap creation*
