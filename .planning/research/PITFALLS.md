# Pitfalls Research: phoebeOS

**Domain:** Native macOS unified inbox (iMessage, Gmail, Instagram DMs)
**Researched:** 2026-01-20
**Confidence:** HIGH (multiple verified sources)

---

## Critical Pitfalls

These mistakes cause rewrites, major issues, or project failure. Address in early phases.

### 1. Full Disk Access and App Store Incompatibility

**What goes wrong:** Building core functionality around chat.db access, then discovering Mac App Store apps cannot require Full Disk Access. The App Sandbox restrictions are separate from and stricter than TCC prompts.

**Why it happens:** Developers assume "I'll just ask for Full Disk Access" without understanding that sandboxed apps (required for App Store) cannot escape their sandbox even with TCC permissions.

**Consequences:**
- Cannot distribute via Mac App Store
- Must use direct distribution (website, notarization)
- Limits discoverability and trust with users
- Cannot use App Store features (automatic updates, family sharing)

**Prevention:**
- **Decide distribution strategy in Phase 1** before any implementation
- If App Store is required, iMessage reading must use alternative approaches (user-granted access via security-scoped bookmarks, or no iMessage read support)
- For direct distribution: Plan notarization workflow, update mechanisms

**Warning signs:** Building iMessage features without documented distribution decision

**Phase to address:** Phase 1 (Architecture/Foundation)

**Sources:**
- [Apple Developer Forums - Sandbox vs Full Disk Access](https://developer.apple.com/forums/thread/124895)
- [iBoysoft - Full Disk Access Issues](https://iboysoft.com/tips/full-disk-access-mac-not-working.html)

---

### 2. iMessage chat.db Schema Fragility

**What goes wrong:** Code hardcoded to specific chat.db schema breaks after macOS updates. Apple provides no stability guarantees for this database structure.

**Why it happens:** Developers reverse-engineer the current schema without building abstractions that can adapt to changes. Apple has renamed database files (e.g., `chat.db.incompatible.v9004.sqlitedb`) and changed schema between OS versions.

**Consequences:**
- App breaks silently after macOS updates
- Messages appear missing or corrupted
- Group chat handling breaks (handle_id=0 semantics)
- Timestamp calculations fail (macOS epoch is 2001-01-01, not Unix 1970-01-01)

**Prevention:**
- **Schema abstraction layer** that validates expected tables/columns exist before querying
- **Graceful degradation** - detect schema mismatch, show user-friendly error, don't crash
- **Timestamp handling** - always convert macOS epoch to standard timestamps explicitly
- **Test on macOS betas** - schema changes typically appear in beta releases
- **Version detection** - store last-known-working macOS version, warn on major updates

**Warning signs:**
- Hardcoded SQL queries without schema validation
- Missing timestamp conversion logic
- No error handling for missing columns/tables

**Phase to address:** Phase 2 (iMessage Integration)

**Sources:**
- [Hacker News - chat.db schema complexity](https://news.ycombinator.com/item?id=27320833)
- [Fat Bob Man - Deep Dive into iMessage](https://fatbobman.com/en/posts/deep-dive-into-imessage)
- [David Bieber - iMessage SQL](https://davidbieber.com/snippets/2020-05-20-imessage-sql-db/)

---

### 3. AppleScript iMessage Sending Unreliability

**What goes wrong:** AppleScript-based message sending fails silently, sends to wrong recipients, or breaks after macOS updates. Apple has shipped Messages with broken bundled AppleScript features since 2014.

**Why it happens:** Apple doesn't prioritize AppleScript maintenance. The Messages app was significantly rewritten in macOS Big Sur, breaking many scripts. Scripts require existing conversations (buddies) and don't work for new contacts.

**Consequences:**
- Messages sent to wrong recipients (serious trust/privacy issue)
- Silent failures - user thinks message sent when it wasn't
- Script breaks after OS updates with cryptic errors (error -10002, -1708)
- Cannot message new contacts (must be existing "buddy")

**Prevention:**
- **Verification step** - after sending, check chat.db for the message actually appearing
- **Recipient confirmation UI** - show who message will go to before sending
- **Robust error handling** - translate AppleScript errors to user-friendly messages
- **Fallback behavior** - if sending fails, offer to open Messages app directly
- **Beta testing** - test on every macOS beta for script compatibility

**Warning signs:**
- No send verification logic
- Assuming AppleScript "just works"
- No error mapping for AppleScript failure codes

**Phase to address:** Phase 2 (iMessage Integration)

**Sources:**
- [Keyboard Maestro Forum - iMessage reliability 2023](https://forum.keyboardmaestro.com/t/send-imessage-action-2023-reliability-and-alternate-methods/32267)
- [Robservatory - Messages broken AppleScripts](https://robservatory.com/fix-messages-broken-bundled-applescripts/)
- [MacScripter - iMessage scripting unreliability](https://www.macscripter.net/t/is-sending-imessages-sms-mms-by-scripting-the-messages-program-completely-unreliable/76738)

---

### 4. Instagram 24-Hour Messaging Window Expiration

**What goes wrong:** App shows messages as "actionable" when the 24-hour reply window has expired. User attempts to reply, fails, loses trust in the app.

**Why it happens:** The Instagram Graph API enforces a strict 24-hour window for automated replies. After that window closes, the API blocks the message. Apps that don't track window expiry show stale "to respond" items.

**Consequences:**
- User attempts reply, gets cryptic API error
- Frustration and loss of trust
- Stale items clog the "to respond" queue
- Users blame the app, not Instagram's policy

**Prevention:**
- **Track window expiry** - store `last_interaction_timestamp` for each conversation
- **Visual indicator** - show time remaining (e.g., "4h left to reply")
- **Auto-archive expired** - move expired conversations to "expired" state, not "to respond"
- **Warn before expiry** - push notification when window is about to close (e.g., 1 hour left)
- **Graceful failure** - if API returns window-expired error, show clear explanation, not generic error

**Warning signs:**
- No timestamp tracking on Instagram messages
- No UI differentiation between fresh and stale messages
- Generic error handling for API failures

**Phase to address:** Phase 3 (Gmail + Instagram Integration)

**Sources:**
- [Elfsight - Instagram Graph API Guide 2025](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2025/)
- [CreatorFlow - Instagram API Rate Limits](https://creatorflow.so/blog/instagram-api-rate-limits-explained/)

---

### 5. OAuth Token Storage Keychain Mismatches

**What goes wrong:** Token refresh succeeds on server but fails to persist to Keychain. User must re-authenticate repeatedly. Or worse: tokens readable by unintended processes.

**Why it happens:** Keychain service name mismatches between write and read operations. Keychain entries scoped incorrectly. Permissions not properly set on Keychain items.

**Consequences:**
- Users must re-login daily or after every app restart
- Security vulnerabilities if tokens stored insecurely
- Refresh tokens lost, requiring full re-auth flow
- Confusing errors ("item not found" when item exists under different service name)

**Prevention:**
- **Consistent service names** - define Keychain service name as constant, use everywhere
- **Keychain wrapper abstraction** - single module handles all Keychain operations
- **Test the full cycle** - write token, read token, refresh token, write new token, read new token
- **Handle Keychain errors gracefully** - if read fails, trigger re-auth flow
- **Clean up on sign-out** - explicitly delete Keychain items, verify deletion

**Warning signs:**
- Hardcoded service name strings in multiple places
- No integration tests for token persistence
- Missing error handling on Keychain operations

**Phase to address:** Phase 3 (OAuth flows)

**Sources:**
- [Google OAuth Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Claude Code Issue #9403 - Keychain issues](https://github.com/anthropics/claude-code/issues/9403)
- [Auth0 - Token Storage](https://auth0.com/docs/secure/security-guidance/data-security/token-storage)

---

### 6. Aggregator Availability Math

**What goes wrong:** With three data sources (iMessage, Gmail, Instagram), if any one fails, the entire "unified" experience degrades. Availability compounds: 99% x 99% x 99% = 97%.

**Why it happens:** Developers treat the aggregator as "just combining data" without considering that it's a choke point. One slow or failing source blocks the entire refresh.

**Consequences:**
- If Gmail API is slow, entire app feels slow
- If Instagram returns errors, app shows "sync failed" even though iMessage/Gmail are fine
- Users see "something's broken" without knowing which source

**Prevention:**
- **Independent source refresh** - each source updates independently, never blocks others
- **Per-source status indicators** - show which sources are healthy/stale/erroring
- **Graceful degradation** - if Instagram fails, still show iMessage + Gmail
- **Timeout budgets** - each source has individual timeout; don't wait indefinitely
- **Cache aggressively** - show stale data immediately, refresh in background

**Warning signs:**
- Single refresh function that fetches all sources sequentially
- Global "loading" state instead of per-source states
- No timeout handling on API calls

**Phase to address:** Phase 4 (Unified inbox consolidation)

**Sources:**
- [AKF Partners - Microservice Aggregator Pattern](https://akfpartners.com/growth-blog/microservice-aggregator-pattern)
- [Enterprise Integration Patterns - Aggregator](https://www.enterpriseintegrationpatterns.com/patterns/messaging/Aggregator.html)

---

## Common Mistakes

These cause delays, technical debt, or degraded UX. Important but not catastrophic.

### 7. Polling-Induced Battery Drain and High CPU

**What goes wrong:** App polls three sources frequently, causing high energy impact. macOS marks app as "High Energy Impact" in Activity Monitor. Users report hot laptops and poor battery.

**Why it happens:** Polling seems simpler than push notifications. Developers set aggressive poll intervals (every 30 seconds) without measuring energy impact.

**Consequences:**
- Users uninstall due to battery drain
- Bad reviews mentioning "drains my battery"
- macOS may throttle the app
- SwiftUI view updates on every poll cycle compound the problem

**Prevention:**
- **Adaptive polling** - poll less frequently when no recent activity; more when actively using
- **Use Gmail Pub/Sub** - eliminates Gmail polling entirely (push notifications)
- **Batch UI updates** - don't re-render entire list on every refresh
- **Profile with Instruments** - measure energy impact during development
- **Exponential backoff** - if source hasn't changed, increase poll interval

**Warning signs:**
- Fixed, aggressive poll intervals
- UI re-renders on every timer tick
- No energy profiling during development

**Phase to address:** Phase 5 (Auto-refresh optimization)

**Sources:**
- [Apple - Analyzing Battery Use](https://developer.apple.com/documentation/xcode/analyzing-your-app-s-battery-use)
- [WWDC 2019 - Improving Battery Life and Performance](https://developer.apple.com/videos/play/wwdc2019/417/)

---

### 8. Gmail API Quota Exhaustion

**What goes wrong:** App hits Gmail API rate limits, shows errors, or stops syncing. Google returns HTTP 429 or 403 errors that persist for hours.

**Why it happens:** Developers don't understand Gmail's quota unit system. Each API call costs quota units, and per-user limits (250 units/second) cannot be increased.

**Consequences:**
- Sync stops for hours when daily quota exhausted
- Users see "Sync failed" with no explanation
- Retry loops make the problem worse
- Batch requests larger than 50 trigger rate limiting

**Prevention:**
- **Use Pub/Sub push notifications** instead of polling for new mail
- **Implement exponential backoff** with jitter for rate limit errors
- **Partial responses** - only fetch needed fields to reduce quota usage
- **Batch requests** - but keep batches under 50 items
- **Cache aggressively** - don't re-fetch unchanged data
- **Monitor quota usage** - track quota consumption, alert before exhaustion

**Warning signs:**
- Polling Gmail API frequently
- Fetching full message objects when only headers needed
- No retry logic with backoff
- Large batch requests

**Phase to address:** Phase 3 (Gmail Integration)

**Sources:**
- [Google - Gmail API Usage Limits](https://developers.google.com/workspace/gmail/api/reference/quota)
- [Google - Resolve Gmail API Errors](https://developers.google.com/workspace/gmail/api/guides/handle-errors)

---

### 9. Notification Fatigue Leading to App Abandonment

**What goes wrong:** App sends too many notifications, users disable all notifications, then miss important messages. Or users uninstall entirely.

**Why it happens:** Developers notify on every new message across all three sources. 68% of Americans report notification frequency interferes with productivity.

**Consequences:**
- Users disable notifications, defeating the app's purpose
- Users uninstall due to constant interruptions
- Important messages get missed in the noise
- 40% productivity loss from constant context-switching

**Prevention:**
- **Smart notification consolidation** - batch notifications, don't notify per-message
- **Priority-based notifications** - only notify for messages matching user-defined criteria
- **Quiet hours** - respect user's focus time
- **Digest mode option** - single notification summarizing unread across sources
- **Notification preferences per source** - maybe notify for iMessage but not promotional emails

**Warning signs:**
- Notification per message design
- No notification preference UI
- No batching/consolidation logic

**Phase to address:** Phase 5 (Notifications)

**Sources:**
- [MagicBell - Help Users Avoid Notification Fatigue](https://www.magicbell.com/blog/help-your-users-avoid-notification-fatigue)
- [Smashing Magazine - Notifications UX Guidelines](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/)

---

### 10. Glassmorphism Performance on Older Hardware

**What goes wrong:** Blur effects cause high CPU usage, especially with frequent UI updates. App marked as "High Energy Impact" and feels sluggish on older Macs.

**Why it happens:** `.blur()` modifier in SwiftUI is computationally expensive. Multiple blur layers compound the issue. Animating blur effects is particularly costly.

**Consequences:**
- 13%+ CPU usage just for UI rendering
- "High Energy Impact" badge in Activity Monitor
- Sluggish scrolling and interactions
- Poor experience on MacBooks without dedicated GPU

**Prevention:**
- **Use .material modifiers** instead of `.blur()` - they're GPU-optimized
- **Pre-blur static backgrounds** - don't compute blur at runtime for static elements
- **Reduce transparency layers** - fewer overlapping translucent views
- **Profile with Instruments** - identify which views cause most redraw
- **Hardware-tier detection** - simpler UI for older Macs
- **User preference** - offer "reduce visual effects" option

**Warning signs:**
- Multiple `.blur()` modifiers on frequently-updating views
- No performance profiling of UI
- Assuming all users have M-series Macs

**Phase to address:** Phase 1 (UI Foundation)

**Sources:**
- [Medium - SwiftUI Performance Optimization](https://medium.com/@garejakirit/optimizing-swiftui-performance-best-practices-93b9cc91c623)
- [Apple - Understanding SwiftUI Performance](https://developer.apple.com/documentation/Xcode/understanding-and-improving-swiftui-performance)

---

### 11. SwiftUI Concurrency Data Races

**What goes wrong:** Multiple async operations updating shared state cause crashes, especially with Swift 6 strict concurrency. Crashes are intermittent and hard to reproduce.

**Why it happens:** Three data sources mean three concurrent async operations. Without proper @MainActor isolation, UI state updates from multiple threads cause data races.

**Consequences:**
- Random crashes during refresh
- Inconsistent UI state
- "Sending main actor-isolated to nonisolated callee" warnings become crashes
- Debugging is nightmarish due to non-deterministic nature

**Prevention:**
- **@MainActor on ViewModels** - ensure all UI state changes happen on main thread
- **Use Swift Concurrency properly** - `await MainActor.run {}` for UI updates from async contexts
- **One source of truth** - centralized state management, not scattered @State variables
- **Enable strict concurrency checking** - catch issues at compile time
- **Test with Thread Sanitizer** - run with TSan to detect races during development

**Warning signs:**
- Multiple @Published properties updated from different async contexts
- No @MainActor annotations on view models
- Intermittent crashes during multi-source refresh
- Swift 6 concurrency warnings being ignored

**Phase to address:** Phase 1 (Architecture)

**Sources:**
- [Swift Forums - @MainActor conflicts](https://forums.swift.org/t/mainactor-conflict-with-async-usecase-in-swiftui-viewmodel/79461)
- [SwiftUI Snippets - Avoiding Data Races in Swift 6](https://swiftuisnippets.wordpress.com/2024/09/20/avoiding-data-race-issues-in-swift6/)

---

## Platform-Specific Gotchas

### iMessage

| Issue | Impact | Mitigation |
|-------|--------|------------|
| macOS epoch timestamps (2001, not 1970) | Wrong dates displayed | Add 978307200 seconds to convert |
| chat.db requires Full Disk Access | Permission UX friction | Clear onboarding explaining why |
| WAL mode (chat.db-wal file) | Incomplete data if ignored | Open database in read-only mode, handle all three files |
| Group chat handle_id=0 | Misidentifying sender | Special handling for group chat queries |
| Contacts must be "buddies" | Can't message new numbers | Document limitation, suggest opening Messages.app |
| TCC changes in Sequoia | Notification DB moved | Test on latest macOS, handle location changes |

### Gmail

| Issue | Impact | Mitigation |
|-------|--------|------------|
| 250 quota units/user/second | Rate limiting during heavy sync | Partial responses, batch requests |
| Watch expires every 7 days | Push notifications stop | Cron job to refresh watch daily |
| History ID handling | Missing messages if misused | Store historyId after each notification, query history properly |
| IMAP rate limiting (2025 changes) | Sync failures | Use API, not IMAP |
| 429 vs 403 for quota errors | Inconsistent error handling | Handle both status codes |

### Instagram

| Issue | Impact | Mitigation |
|-------|--------|------------|
| 24-hour messaging window | Can't reply to old messages | Track timestamps, show expiry countdown |
| 200 DMs/hour rate limit | Bulk operations blocked | Queue messages, respect rate limits |
| Business/Creator accounts only | Personal accounts unsupported | Clear documentation in onboarding |
| Text only (no media) | Incomplete message display | Show placeholder for media, link to Instagram app |
| Requires user-initiated first message | Can't cold-message | Document limitation |
| 96% API limit reduction (2024) | Much stricter than expected | Design for 200/hour from start |

---

## Warning Signs Checklist

Run through this checklist during development to catch pitfalls early:

### Architecture Phase
- [ ] Distribution strategy documented (App Store vs Direct)?
- [ ] Full Disk Access requirement understood?
- [ ] @MainActor strategy defined for ViewModels?
- [ ] Per-source error states designed (not global "error")?

### iMessage Phase
- [ ] Schema validation before queries?
- [ ] Timestamp epoch conversion implemented?
- [ ] AppleScript error codes mapped to user messages?
- [ ] Send verification logic (check chat.db after send)?

### Gmail/Instagram Phase
- [ ] Pub/Sub push vs polling decision made?
- [ ] Keychain service name constants defined?
- [ ] Token refresh error handling tested?
- [ ] Instagram window expiry tracking implemented?
- [ ] Rate limit handling with exponential backoff?

### Unification Phase
- [ ] Independent refresh per source?
- [ ] Graceful degradation when one source fails?
- [ ] Per-source status indicators in UI?

### Polish Phase
- [ ] Energy impact profiled?
- [ ] Blur effects performance tested on older hardware?
- [ ] Notification batching/consolidation logic?
- [ ] User notification preferences UI?

---

## Phase-Specific Risk Map

| Phase | Primary Pitfalls | Risk Level | Mitigation |
|-------|-----------------|------------|------------|
| 1. Foundation | Distribution decision, SwiftUI concurrency, Glassmorphism perf | HIGH | Decide distribution first, @MainActor strategy, profile blur effects |
| 2. iMessage | chat.db schema fragility, AppleScript unreliability, Full Disk Access | HIGH | Schema abstraction, send verification, clear permission UX |
| 3. Gmail + Instagram | OAuth keychain, Gmail quotas, Instagram 24hr window | MEDIUM | Keychain wrapper, Pub/Sub for Gmail, window tracking |
| 4. Unification | Aggregator availability, Data races | MEDIUM | Independent refresh, graceful degradation |
| 5. Polish | Battery drain, Notification fatigue | LOW | Adaptive polling, notification consolidation |

---

## Sources Summary

### Official Documentation
- [Apple - Analyzing Battery Use](https://developer.apple.com/documentation/xcode/analyzing-your-app-s-battery-use)
- [Apple - SwiftUI Performance](https://developer.apple.com/documentation/Xcode/understanding-and-improving-swiftui-performance)
- [Google - Gmail API Quotas](https://developers.google.com/workspace/gmail/api/reference/quota)
- [Google - Gmail Push Notifications](https://developers.google.com/workspace/gmail/api/guides/push)
- [Google - OAuth Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)

### Developer Community
- [Fat Bob Man - Deep Dive into iMessage](https://fatbobman.com/en/posts/deep-dive-into-imessage)
- [Hacker News - chat.db schema](https://news.ycombinator.com/item?id=27320833)
- [Keyboard Maestro Forum - iMessage reliability](https://forum.keyboardmaestro.com/t/send-imessage-action-2023-reliability-and-alternate-methods/32267)
- [Hiver Engineering - Gmail Pub/Sub bugs](https://medium.com/hiver-engineering/gmail-apis-push-notifications-bug-and-how-we-worked-around-it-at-hiver-a0a114df47b4)
- [Swift Forums - @MainActor conflicts](https://forums.swift.org/t/mainactor-conflict-with-async-usecase-in-swiftui-viewmodel/79461)

### UX Research
- [MagicBell - Notification Fatigue](https://www.magicbell.com/blog/help-your-users-avoid-notification-fatigue)
- [Smashing Magazine - Notifications UX](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/)
- [Deemerge - Unified Inbox Apps 2025](https://www.deemerge.ai/post/best-unified-inbox-apps-in-2025)
- [AKF Partners - Aggregator Pattern](https://akfpartners.com/growth-blog/microservice-aggregator-pattern)

### Platform-Specific
- [Elfsight - Instagram Graph API 2025](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2025/)
- [CreatorFlow - Instagram Rate Limits](https://creatorflow.so/blog/instagram-api-rate-limits-explained/)
- [9to5Mac - macOS Sequoia Notification Database](https://9to5mac.com/2024/09/01/security-bite-apple-addresses-privacy-concerns-around-notification-center-database-in-macos-sequoia/)
