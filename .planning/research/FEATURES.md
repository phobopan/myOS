# Features Research: Unified Inbox / Communication Hub

**Domain:** Native macOS unified inbox app (iMessage, Gmail, Instagram DMs)
**Researched:** 2026-01-20
**Overall Confidence:** HIGH (verified against multiple commercial products)

## Executive Summary

Unified inbox apps exist on a spectrum from email-focused (Superhuman, Spark, Edison Mail) to multi-channel personal messaging (Beeper, Franz, Texts) to team/business communication (Front, Missive, Crisp). phoebeOS occupies a unique position: **personal multi-channel communication with an inbox-zero philosophy**.

The "unreplied messages only" approach is a genuine differentiator. Most unified inboxes show everything; phoebeOS shows only what needs attention. This forces a specific feature set and explicitly excludes features that other apps consider standard.

---

## Table Stakes

Features users expect. Missing any of these makes the product feel incomplete or broken.

### Core Functionality

| Feature | Why Expected | Complexity | Status in phoebeOS |
|---------|--------------|------------|-------------------|
| **Unified message stream** | Core value proposition of any unified inbox | High | Planned |
| **Source identification** | Users must know where message came from | Low | Planned (icons) |
| **Source filtering** | Users need to focus on one channel sometimes | Low | Planned (buttons) |
| **Message threading/conversation view** | Context is essential for meaningful replies | Medium | Planned (20-30 messages) |
| **Quick reply** | Core action must be frictionless | Medium | Planned |
| **New message indicator/auto-refresh** | Users need to know when new messages arrive | Medium | Planned |
| **Keyboard shortcuts** | Power users expect keyboard-driven workflows | Medium | Planned (full support) |

### Platform-Specific Table Stakes

| Feature | Why Expected | Complexity | Status in phoebeOS |
|---------|--------------|------------|-------------------|
| **iMessage: Reactions/tapbacks** | Basic iMessage feature users rely on | Low | Planned |
| **iMessage: Image/attachment viewing** | Messages are incomplete without media | Medium | Planned |
| **iMessage: Group chat support** | Significant portion of iMessage usage | Medium | Planned |
| **iMessage: Contact name resolution** | Phone numbers are useless without names | Medium | Planned |
| **Gmail: Email composition** | Responding to email requires full composer | Medium | Planned |
| **Gmail: Reply/reply-all/forward** | Standard email actions | Medium | Planned |
| **Gmail: CC/BCC support** | Professional email requirement | Low | Planned |
| **Instagram: Text replies** | Core DM functionality | Low | Planned |

### UX Table Stakes

| Feature | Why Expected | Complexity | Status in phoebeOS |
|---------|--------------|------------|-------------------|
| **Chronological sorting** | Users expect newest messages visible | Low | Planned (newest first) |
| **Read/unread status** | Visual distinction for message state | Low | Implied (unreplied = unread) |
| **Loading states** | Users need feedback during async operations | Low | Needed |
| **Error handling** | Failed sends must be visible and recoverable | Medium | Needed |
| **Responsive performance** | Inbox must feel instant (<100ms interactions) | High | Critical |

### macOS Native Table Stakes

| Feature | Why Expected | Complexity | Status in phoebeOS |
|---------|--------------|------------|-------------------|
| **Notification Center integration** | Native macOS apps push to system notifications | Medium | Planned (user preferences) |
| **Dark mode support** | macOS users expect system theme respect | Low | Planned (glassmorphism) |
| **Standard shortcuts (Cmd+C, Cmd+V, etc.)** | Basic OS conventions | Low | Required |
| **Menu bar integration** | Native Mac apps have proper menus | Low | Needed |

---

## Differentiators

Features that set phoebeOS apart from competitors. These create competitive advantage.

### Core Differentiators (Already Planned)

| Feature | Value Proposition | Complexity | Competitive Landscape |
|---------|-------------------|------------|----------------------|
| **Unreplied-only stream** | Radical focus - only shows what needs attention | High | **Unique** - no competitor does this |
| **No snooze/dismiss** | Forces inbox zero, prevents procrastination | N/A (absence) | **Counter-trend** - most apps add snooze |
| **Auto-removal after reply** | True inbox zero without manual archive | Medium | Unique UX pattern |
| **Glassmorphism UI** | Modern, distinctive visual identity | Medium | Differentiating aesthetic |

### Potential Additional Differentiators

| Feature | Value Proposition | Complexity | Recommendation |
|---------|-------------------|------------|----------------|
| **"Response debt" visualization** | Show how long each message has waited | Low | **Recommended** - reinforces core philosophy |
| **Reply time analytics** | Track average response times by source | Medium | Consider for v2 - data-driven inbox zero |
| **"Clear the deck" celebration** | UI feedback when inbox reaches zero | Low | **Recommended** - gamification of inbox zero |
| **Smart compose suggestions** | AI-assisted quick replies based on context | High | Consider for v2 - requires careful privacy handling |
| **Thread summary** | AI summary of long threads before replying | Medium | Consider for v2 - Context7 showed this is trending |
| **Priority ranking within stream** | Surface oldest waiting messages | Low | **Recommended** - aligns with "response debt" |
| **Conversation velocity indicators** | Show if conversation is rapid-fire or slow | Low | Nice-to-have |

### Superhuman-Inspired Differentiators (High Value)

Based on Superhuman's success ($30/month pricing), these features correlate with willingness to pay:

| Feature | Superhuman Has | Complexity | Recommendation |
|---------|----------------|------------|----------------|
| **Sub-100ms interactions** | Yes (core selling point) | High | **Critical** - must match |
| **Command palette (Cmd+K)** | Yes | Medium | **Recommended** - power user essential |
| **Split inbox views** | Yes | Medium | Maybe - conflicts with unified philosophy? |
| **Keyboard-first design** | Yes | Medium | **Planned** - must execute well |
| **Read status tracking** | Yes | Medium | Not recommended for personal app |
| **Scheduled send** | Yes | Medium | Consider - but may conflict with "reply now" philosophy |

---

## Anti-Features

Things to deliberately NOT build. These seem like features but would harm the product.

### Philosophy Violations

| Anti-Feature | Why Avoid | What Competitors Do |
|--------------|-----------|---------------------|
| **Snooze/remind later** | Defeats inbox zero philosophy; creates "snooze debt" | Superhuman, Spark, Edison all have this |
| **Archive without reply** | Allows ignoring messages; breaks "unreplied" model | Every email app has archive |
| **Manual dismiss** | Same as archive - allows avoidance | Most inbox apps allow dismissing |
| **"Mark as read" without reply** | Allows hiding from unreplied list without action | Universal email feature |
| **Priority inbox sorting by ML** | Takes control away from user; obscures response debt | Gmail, Spark, Edison use ML sorting |
| **Notification bundling/digest** | Delays awareness of messages needing response | Most apps offer this |

### Scope Creep Traps

| Anti-Feature | Why Avoid | Temptation |
|--------------|-----------|------------|
| **Email drafts folder** | Encourages procrastination; write and send | "Professional" feature |
| **Folder/label organization** | Only unreplied matters; labels are overhead | Perceived organization need |
| **Search across all messages** | Focus is unreplied stream; searching implies hoarding | "Standard" feature request |
| **Multiple email accounts** | Increases complexity; Gmail Primary only is focused | Power user request |
| **Contacts management** | Out of scope; use system Contacts | Feature creep |
| **Calendar integration** | Out of scope; different domain | "Productivity suite" temptation |
| **Notes/tasks** | Out of scope; use dedicated tools | Spike/Notion convergence |

### Technical Anti-Patterns

| Anti-Feature | Why Avoid | Risk |
|--------------|-----------|------|
| **Storing message content locally** | Privacy risk; sync complexity; storage growth | Seems efficient |
| **Building own IMAP/OAuth** | Massive complexity; use existing scripts | Over-engineering |
| **Real-time websocket to all services** | Polling is simpler and sufficient | Performance obsession |
| **Electron/web wrapper** | Loses native macOS benefits; performance hit | Faster dev velocity |

### Instagram-Specific Anti-Features

| Anti-Feature | Why Avoid | API Reality |
|--------------|-----------|-------------|
| **Rich media in DMs** | Official API is text-only | API limitation |
| **Story replies** | Outside 24-hour window constraints | API limitation |
| **New conversation initiation** | API only allows replying to received messages | API limitation |
| **Read receipts sending** | Privacy concern; API may not support | User expectation mismatch |

---

## Feature Dependencies

Understanding what must be built before other features can work.

```
Core Infrastructure (Must be first)
├── Message polling/refresh mechanism
│   └── New message notifications
├── Unified data model for messages
│   ├── Source filtering
│   └── Chronological sorting
└── Thread/conversation loading
    └── Reply functionality

iMessage Dependencies
├── Chat.db access
│   ├── Contact resolution (needs Contacts framework)
│   ├── Reactions display
│   └── Attachment handling
└── iMessage sending (via script/automation)

Gmail Dependencies
├── Gmail API authentication
│   ├── Email fetching (Primary inbox filter)
│   └── Email sending
└── Email composer
    ├── Reply/reply-all/forward logic
    └── CC/BCC handling

Instagram Dependencies
├── Instagram API authentication (24hr token refresh)
│   └── DM fetching (within window)
└── Reply sending (text only)

UI Layer (Requires all above)
├── Unified stream view
│   ├── Source icons
│   ├── Filter buttons
│   └── Thread preview
├── Conversation view
│   ├── Message history (20-30)
│   └── Load more pagination
├── Compose/reply interface
│   ├── Platform-appropriate controls
│   └── Send confirmation
└── Keyboard navigation
    └── Full shortcut system
```

### Critical Path

The minimum viable feature set to ship v1:

1. **Polling infrastructure** - Get messages from all sources
2. **Unified data model** - Normalize across iMessage/Gmail/Instagram
3. **Stream view** - Display unreplied messages
4. **Thread view** - Show conversation context
5. **Reply** - Send responses back to source
6. **Auto-removal** - Remove from stream after reply + navigate away

Everything else is enhancement.

---

## MVP Recommendation

Based on table stakes analysis, the MVP must include:

### Must Have for MVP

1. **Unified unreplied stream** with source icons and newest-first sorting
2. **Source filtering** (all / iMessage / Gmail / Instagram buttons)
3. **Thread view** with recent context (20-30 messages)
4. **Reply functionality** for all three platforms
5. **Auto-removal** after reply + navigate away
6. **Auto-refresh** for new messages
7. **Basic keyboard shortcuts** (navigate, reply, filter)
8. **iMessage**: Contact resolution, reactions display, group chats
9. **Gmail**: Reply with subject preserved, Primary inbox only
10. **Instagram**: Text reply within API constraints

### Defer to Post-MVP

| Feature | Reason to Defer |
|---------|-----------------|
| Full attachment handling | Complexity; text gets you 80% of value |
| Email forward | Reply/reply-all covers most cases |
| Advanced keyboard shortcuts | Basic navigation is enough for v1 |
| Response time analytics | Nice-to-have, not core value |
| Notification preferences | System defaults work initially |
| Load more pagination | 20-30 messages is usually enough |
| CC/BCC | Reply without CC/BCC works for most cases |

---

## Competitive Landscape Summary

| Product | Focus | Pricing | Key Differentiator | Gap phoebeOS Fills |
|---------|-------|---------|-------------------|-------------------|
| **Superhuman** | Email only | $30/mo | Speed, keyboard shortcuts | Multi-channel, strict inbox zero |
| **Spark** | Email | Free/$8/mo | Smart inbox, collaboration | Multi-channel, no ML sorting |
| **Beeper** | Multi-channel | Free/$100/yr | 15+ platforms, privacy | Fewer platforms, inbox zero focus |
| **Front** | Team inbox | $19+/user/mo | Collaboration, CRM | Personal use, simpler |
| **Missive** | Team inbox | $14+/user/mo | Shared drafts, channels | Personal use, simpler |
| **Edison Mail** | Email | Free | Privacy (block trackers) | Multi-channel |
| **Spike** | Email + chat | Free/$12/mo | Conversational email | Multi-channel, strict inbox zero |

**phoebeOS unique position:** Personal multi-channel unified inbox with forced inbox zero. No competitor combines iMessage + Gmail + Instagram with "unreplied only" philosophy.

---

## Sources

**Unified Inbox Apps:**
- [Deemerge: Best Unified Inbox Apps 2025](https://www.deemerge.ai/post/best-unified-inbox-apps-in-2025)
- [Canary Mail: Best Email App for Multiple Accounts](https://canarymail.io/blog/best-email-app-multiple-accounts)
- [Mailbird: Managing Multiple Email Accounts Guide](https://www.getmailbird.com/managing-multiple-email-accounts-unified-inbox/)

**Superhuman (Premium Email):**
- [Superhuman Mail Official](https://superhuman.com/products/mail)
- [Superhuman Review 2026](https://efficient.app/apps/superhuman)
- [Clean Email: Superhuman Review](https://clean.email/blog/email-clients/superhuman-review)

**Multi-Channel Messaging:**
- [TechCrunch: Beeper Relaunch 2025](https://techcrunch.com/2025/07/16/beepers-all-in-one-messaging-app-relaunches-with-an-on-device-model-and-premium-upgrades/)
- [Washington Post: Beeper Review](https://www.washingtonpost.com/technology/2025/02/28/beeper-combine-messaging-apps/)
- [Zapier: Best All-in-One Messaging Apps](https://zapier.com/blog/best-all-in-one-messaging-app/)
- [ClickUp: All-in-One Messenger Apps](https://clickup.com/blog/all-in-one-messaging-apps/)

**Team Inbox (for feature comparison):**
- [Missive Features](https://missiveapp.com/features)
- [Front Omnichannel Inbox](https://front.com/product/omnichannel-inbox)
- [Spike Unified Inbox](https://www.spikenow.com/features/unified-inbox/)

**Inbox Zero & Anti-Patterns:**
- [Superhuman: Inbox Zero Method Guide](https://blog.superhuman.com/inbox-zero-method/)
- [Missive: Inbox Zero Method](https://missiveapp.com/blog/inbox-zero)
- [Canary Mail: Shared Inbox Best Practices](https://canarymail.io/blog/shared-inbox-best-practices)

**macOS & UX:**
- [Apple: Use Notification Center on Mac](https://support.apple.com/guide/mac-help/get-notifications-mchl2fb1258f/mac)
- [Mailbird: Email Threading](https://www.getmailbird.com/email-thread/)
- [Edison Mail: Smarter Search](https://www.edisonmail.com/blog/edison-mail-smarter-search)

**Confidence Level:** HIGH - Features verified across multiple commercial products with consistent patterns.
