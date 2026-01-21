# Project Research Summary

**Project:** phoebeOS - Native macOS Unified Inbox
**Domain:** Personal communication aggregation (iMessage, Gmail, Instagram DMs)
**Researched:** 2026-01-20
**Confidence:** HIGH

## Executive Summary

phoebeOS is a native macOS app that consolidates three communication channels (iMessage, Gmail, Instagram DMs) into a single "unreplied messages only" inbox with forced inbox-zero philosophy. This is a well-documented product category with clear patterns: use SwiftUI + Swift 6 for the UI, GRDB.swift for reading the local iMessage database, Google Sign-In for Gmail OAuth, and direct REST calls for Instagram's Graph API. The architecture follows a clean Repository Pattern with protocol-driven adapters that normalize all three sources into a unified message stream.

The unique "unreplied only" approach is a genuine differentiator. Most unified inboxes show everything; phoebeOS shows only what needs attention. This forces specific architectural decisions: auto-removal after reply, no snooze/dismiss, and real-time tracking of response debt. The glassmorphism aesthetic aligns with Apple's Liquid Glass direction in macOS 26.

**Key risks:** (1) Distribution strategy must be decided immediately. iMessage integration requires Full Disk Access, which is incompatible with Mac App Store sandboxing. This means direct distribution via website and notarization. (2) Apple's chat.db schema has no stability guarantee and can break after macOS updates. A schema abstraction layer with graceful degradation is essential. (3) Instagram's 24-hour messaging window creates UX complexity. Messages must track window expiry and show time remaining, or users will experience frustrating send failures.

## Key Findings

### Recommended Stack

The stack is mature and well-documented. Swift 6.1 + SwiftUI on macOS 15+ provides modern concurrency and declarative UI. GRDB.swift 7.9.0 is the clear winner for SQLite access due to its database observation capabilities (critical for auto-refreshing when Messages.app receives new messages). GoogleSignIn-iOS 9.1.0 handles Gmail OAuth complexity. URLSession with async/await is sufficient for API calls; Alamofire is unnecessary.

**Core technologies:**
- **Swift 6.1 + SwiftUI (macOS 15+):** UI framework. Mature on macOS, 6x list performance improvements in 2025, built-in glassmorphism via materials
- **GRDB.swift 7.9.0:** SQLite access for chat.db. Database observation enables auto-refresh when new messages arrive
- **GoogleSignIn-iOS 9.1.0:** Gmail OAuth. Official SDK, handles token refresh, Swift 6 compatible
- **URLSession:** API networking for Gmail and Instagram. Native async/await, no dependencies needed
- **AppleScript via NSAppleScript:** Only supported method for sending iMessages programmatically
- **SwiftUI Materials / Liquid Glass:** Glassmorphism. GPU-optimized blur, native macOS aesthetic

### Expected Features

**Must have (table stakes):**
- Unified message stream with source icons (iMessage/Gmail/Instagram)
- Source filtering (toggle buttons)
- Thread/conversation view (20-30 messages context)
- Quick reply for all three platforms
- Auto-refresh when new messages arrive
- Keyboard shortcuts (navigate, reply, filter)
- iMessage: contact name resolution, reactions display, group chat support
- Gmail: reply with subject preserved, Primary inbox only
- Instagram: text reply (API limitation)
- Auto-removal after reply + navigate away

**Should have (competitive differentiators):**
- "Response debt" visualization (how long each message has waited)
- Priority ranking by wait time
- "Clear the deck" celebration when inbox reaches zero
- Sub-100ms interactions (Superhuman-level speed)
- Command palette (Cmd+K)

**Defer (v2+):**
- Full attachment handling (text covers 80% of value)
- Email forward (reply/reply-all sufficient)
- Advanced keyboard shortcuts
- Response time analytics
- Smart compose / AI suggestions
- Thread summarization

### Architecture Approach

Clean Architecture with Repository Pattern. Three protocol-driven adapters (iMessage, Gmail, Instagram) feed into a UnifiedInboxRepository that normalizes data into platform-agnostic models. Views observe state via @Observable; they never talk directly to adapters. This enables independent testing, graceful degradation when one source fails, and clean separation between platform-specific complexity and unified business logic.

**Major components:**
1. **Data Source Layer (Adapters):** iMessageAdapter (SQLite), GmailAdapter (REST), InstagramAdapter (Graph API). Each implements `MessageSourceAdapter` protocol.
2. **Domain Layer (Unified Models):** `UnifiedConversation`, `UnifiedMessage`, `Participant`. Platform-agnostic, shared by all components.
3. **Repository Layer:** `UnifiedInboxRepository` aggregates from all adapters, handles concurrent refresh, partial failures, and caching.
4. **State Management:** `AppState` using @Observable macro, with sub-states for auth and settings.
5. **View Layer:** SwiftUI with sidebar (filter + conversation list) and detail panel (thread + composer).
6. **Services:** AuthService (OAuth, Keychain), ContactResolver (phone-to-name), NotificationService, KeyboardShortcutService.

### Critical Pitfalls

1. **Full Disk Access vs App Store:** App requires Full Disk Access to read chat.db. Sandboxed Mac App Store apps cannot escape sandbox. **Decision required immediately:** Direct distribution via notarization.

2. **chat.db Schema Fragility:** Apple provides no stability guarantee. Schema has changed between macOS versions. **Mitigation:** Build schema abstraction layer, validate expected columns exist, graceful degradation on mismatch.

3. **AppleScript iMessage Sending Unreliability:** Scripts fail silently, send to wrong recipients, or break after macOS updates. **Mitigation:** Verify send by checking chat.db afterward, recipient confirmation UI, robust error handling.

4. **Instagram 24-Hour Window:** Messages expire after 24 hours. Users attempting to reply to expired messages get API errors. **Mitigation:** Track window expiry, show time remaining, auto-archive expired.

5. **Aggregator Availability:** Three sources mean 99% x 99% x 99% = 97% availability. One slow source blocks everything. **Mitigation:** Independent refresh per source, per-source status indicators, graceful degradation.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Distribution Decision
**Rationale:** Distribution strategy (direct vs App Store) must be locked before any code. Full Disk Access requirement forces this decision. Also establishes concurrency patterns and UI shell.
**Delivers:** Project setup, distribution decision documented, @MainActor strategy, basic UI shell with glassmorphism, unified domain models
**Addresses:** Project structure, distribution strategy
**Avoids:** Full Disk Access pitfall, SwiftUI concurrency data races, glassmorphism performance issues

### Phase 2: iMessage Integration
**Rationale:** iMessage is local data (no network/auth complexity), validates the unified model design, fastest path to seeing real data. Also the most fragile integration.
**Delivers:** chat.db reading, contact resolution, thread display, iMessage sending via AppleScript, send verification
**Uses:** GRDB.swift, NSAppleScript, Contacts framework
**Implements:** iMessageAdapter, first concrete MessageSourceAdapter implementation
**Avoids:** Schema fragility, AppleScript unreliability

### Phase 3: OAuth Infrastructure & Gmail
**Rationale:** Gmail OAuth is more mature than Instagram. Building auth infrastructure here enables reuse for Instagram.
**Delivers:** OAuth flow, Keychain token storage, Gmail fetching, Gmail composer, multi-source repository aggregation
**Uses:** GoogleSignIn-iOS, URLSession, Keychain
**Implements:** AuthService, GmailAdapter, Keychain wrapper
**Avoids:** Keychain service name mismatches, Gmail quota exhaustion

### Phase 4: Instagram Integration
**Rationale:** Instagram has significant API constraints (24-hour window, Business/Creator only, text-only). Building it after Gmail means auth infrastructure exists.
**Delivers:** Instagram OAuth, DM fetching with window tracking, window expiry UI, text replies
**Uses:** URLSession, Meta OAuth
**Implements:** InstagramAdapter, window expiry tracking
**Avoids:** 24-hour window expiration issues

### Phase 5: Unified Inbox Consolidation
**Rationale:** All sources now feed into repository. This phase focuses on the aggregation experience: filtering, sorting, graceful degradation.
**Delivers:** Source filtering UI, unified sorting, per-source status indicators, independent refresh, graceful degradation
**Implements:** Full UnifiedInboxRepository, FilterBar, ConversationList with real multi-source data
**Avoids:** Aggregator availability issues

### Phase 6: Polish & Performance
**Rationale:** Core functionality complete. Focus on keyboard shortcuts, notifications, battery optimization, edge cases.
**Delivers:** Full keyboard navigation, notification system with batching, adaptive polling, energy profiling, error handling polish
**Avoids:** Battery drain, notification fatigue

### Phase Ordering Rationale

- **Foundation first:** Distribution decision blocks everything. Schema abstraction and concurrency patterns prevent later rewrites.
- **iMessage before network sources:** Local data validates architecture without auth complexity. Proves the unified model works.
- **Gmail before Instagram:** Gmail OAuth is more mature. Auth infrastructure built here is reusable.
- **Instagram after auth exists:** Most constrained API (24-hour window) benefits from proven patterns.
- **Unification after all sources:** Can't build proper aggregation without all sources feeding data.
- **Polish last:** Optimization without complete functionality is premature.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (iMessage):** chat.db schema may have changed since research. Verify columns exist on current macOS version. AppleScript behavior should be tested on macOS 15/26.
- **Phase 4 (Instagram):** 24-hour window behavior and HUMAN_AGENT tag usage need validation with real API calls.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-documented SwiftUI patterns, @Observable is standard.
- **Phase 3 (Gmail):** GoogleSignIn-iOS is official SDK with good documentation.
- **Phase 5 (Unification):** Repository pattern is established, no new research needed.
- **Phase 6 (Polish):** Standard optimization techniques, keyboard shortcuts well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Apple frameworks, verified GitHub releases, mature ecosystem |
| Features | HIGH | Verified against multiple commercial products (Superhuman, Beeper, Front) |
| Architecture | HIGH | Clean Architecture + Repository Pattern is established in SwiftUI ecosystem |
| Pitfalls | HIGH | Multiple verified sources (forums, official docs, post-mortems) |

**Overall confidence:** HIGH

### Gaps to Address

- **chat.db schema on macOS 15/26:** Research was based on documented schema; verify column names on target OS during Phase 2
- **Instagram Business/Creator account requirement:** Need to verify user has qualifying account during onboarding
- **AppleScript macOS 26 compatibility:** Apple's Liquid Glass update may have affected Messages.app scripting; test early
- **Notification database location in Sequoia:** TCC changes may affect notification integration; verify during Phase 6

## Sources

### Primary (HIGH confidence)
- Apple SwiftUI Documentation and WWDC 2025 sessions
- GRDB.swift GitHub (v7.9.0, Dec 2025)
- GoogleSignIn-iOS GitHub (v9.1.0, Jan 2025)
- Google Gmail API official documentation
- Instagram Graph API official documentation

### Secondary (MEDIUM confidence)
- Fat Bob Man: Deep Dive into iMessage (chat.db schema)
- David Bieber: iMessage SQL snippets
- Clean Architecture for SwiftUI (Alexey Naumov)
- Superhuman, Beeper, Front feature analysis (product research)
- Keyboard Maestro Forum: iMessage scripting reliability

### Tertiary (LOW confidence)
- Hacker News discussions on chat.db fragility (anecdotal but consistent)
- Medium articles on SwiftUI performance (variable quality, verified claims against Apple docs)

---
*Research completed: 2026-01-20*
*Ready for roadmap: yes*
