# phoebeOS

## What This Is

A native macOS desktop app that unifies iMessage, Gmail, and Instagram DMs into a single "to respond to" stream. Shows only messages awaiting your reply, lets you respond directly from the app, and removes them from the list once handled. Built with glassmorphism aesthetics — transparent background, translucent widgets, white text, clean modern fonts.

## Core Value

Never miss an important message. One place to see everything that needs a response, one action to handle it, done.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Unified stream showing unreplied iMessages, Gmail (Primary inbox), and Instagram DMs
- [ ] Auto-refresh to detect new incoming messages
- [ ] Messages sorted most recent at top
- [ ] Click conversation to view thread in right panel
- [ ] Reply directly from app, pushes to respective platform
- [ ] Conversation removed from list after reply + navigate away
- [ ] No dismiss/snooze — forces actual response (inbox zero)
- [ ] Source icons to visually distinguish iMessage/Gmail/Instagram
- [ ] Filter buttons to show only specific sources
- [ ] iMessage: read chat.db, resolve contacts, show reactions, images/attachments, group chats
- [ ] iMessage: send replies via AppleScript
- [ ] Gmail: OAuth authentication, read Primary inbox threads
- [ ] Gmail: email-style composer with subject line, CC/BCC, reply/reply-all/forward
- [ ] Instagram: Official Graph API, business/creator accounts, 24-hour reply window
- [ ] Instagram: chat-style composer, text replies only
- [ ] Thread view shows recent context (20-30 messages) with load more option
- [ ] User-controlled notification preferences (on/off/badge only)
- [ ] Full keyboard shortcut system
- [ ] Glassmorphism UI: transparent background, translucent rounded widgets, white text, modern fonts

### Out of Scope

- Unofficial Instagram API — risk to account not worth it
- Sending images via Instagram — API doesn't support it
- Dismiss/snooze functionality — deliberately excluded to enforce response
- Menubar mode — regular window only for v1
- Other platforms (Slack, Discord, Twitter DMs, etc.) — focus on core three first

## Context

**Platform**: Native macOS app using Swift and SwiftUI. SwiftUI's `.ultraThinMaterial` and visual effects will achieve the glassmorphism aesthetic.

**iMessage access**: Requires Full Disk Access permission to read ~/Library/Messages/chat.db. Sending uses AppleScript/osascript which works but isn't officially supported.

**Gmail**: Standard OAuth 2.0 flow with Gmail API. Well-documented, reliable.

**Instagram**: Graph API Messenger platform. Requires Facebook Business account linked to Instagram Professional account. Significant limitations:
- Can only reply to users who messaged first
- 24-hour window after their last message
- Text only, no media sending
- After 24 hours, conversation becomes read-only in phoebeOS

**Existing scripts**: User has working scripts in ~/.local/bin/ for all three platforms, but we're building fresh Swift implementations for native integration.

## Constraints

- **Platform**: macOS only — SwiftUI, AppKit where needed
- **Instagram API**: Official API only — accept the 24-hour and text-only limitations
- **Permissions**: Will need Full Disk Access (iMessage) and OAuth grants (Gmail, Instagram)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Native macOS (Swift/SwiftUI) | Best glassmorphism support, system integration | — Pending |
| Fresh implementations over existing scripts | Cleaner native integration, no shell-out dependencies | — Pending |
| Official Instagram API only | Account safety over functionality | — Pending |
| No dismiss/snooze | Forces inbox zero behavior | — Pending |
| Primary inbox only for Gmail | Filters noise (promos, social, updates) | — Pending |

---
*Last updated: 2026-01-20 after initialization*
