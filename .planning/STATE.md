# Project State: phoebeOS

**Last updated:** 2026-01-22
**Current phase:** 4 (Instagram) - In Progress

## Project Reference

See: .planning/PROJECT.md
**Core value:** Never miss an important message. One place to see everything that needs a response.
**Current focus:** Phase 4 - Instagram Integration (In Progress)

## Progress

| Phase | Status | Progress |
|-------|--------|----------|
| 1 - Foundation | Complete | 100% |
| 2 - iMessage | Complete | 100% |
| 3 - Gmail | In Progress | 60% |
| 4 - Instagram | In Progress | 25% |
| 5 - Unified Inbox | Pending | 0% |
| 6 - Polish | Pending | 0% |

**Overall:** 2/6 phases complete (11 total plans done)

## Current Position

- **Phase:** 4 - Instagram (In Progress)
- **Plan:** 01 of 04 complete
- **Status:** In progress
- **Last activity:** 2026-01-22 - Completed 04-01-PLAN.md (Instagram auth foundation)
- **Progress:** [██░░░░░░░░] 25%

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 11 |
| Requirements delivered | 0/32 |
| Phases completed | 2/6 |

## Accumulated Context

### Key Decisions

| Decision | Date | Rationale |
|----------|------|-----------|
| Electron over Swift/SwiftUI | 2026-01-20 | No Xcode required, faster iteration |
| React + TypeScript + Tailwind | 2026-01-20 | Type safety, component model, ecosystem |
| better-sqlite3 for chat.db | 2026-01-20 | Synchronous SQLite access from Node.js |
| Direct distribution (no App Store) | 2026-01-20 | Full Disk Access for iMessage incompatible with sandboxing |
| Official Instagram API only | 2026-01-20 | Account safety over functionality |
| No dismiss/snooze | 2026-01-20 | Forces inbox zero behavior |
| Vite over webpack | 2026-01-21 | Faster HMR, simpler config, ESM-native |
| Separate TypeScript configs | 2026-01-21 | Main process needs CommonJS, renderer uses ESM |
| under-window vibrancy + active state | 2026-01-21 | Best for full-window glassmorphism that persists when unfocused |
| 52px header height | 2026-01-21 | Space for traffic lights and future titlebar content |
| Sidebar width 320px | 2026-01-21 | Provides enough space for conversation previews |
| Glass-modal darker than glass-panel | 2026-01-21 | Modal needs more contrast to stand out |
| Defer node-mac-contacts | 2026-01-21 | Node.js 24 N-API incompatibility - address in Plan 02-03 |
| Singleton pattern for iMessageService | 2026-01-21 | Lazy init, readonly mode, single connection |
| Stub contactService interface | 2026-01-21 | Provides API for future contact resolution when alternative found |
| IPC handler pattern namespace:action | 2026-01-21 | Consistent naming for main-renderer communication |
| Shared types in src/shared/ | 2026-01-21 | TypeScript rootDir restriction requires neutral directory for cross-process types |
| Centralize IPC handlers in ipc.ts | 2026-01-21 | Single file for all IPC registrations improves maintainability |
| Reaction extraction via guid mapping | 2026-01-21 | Extract tapbacks into Map, attach to parent messages for cleaner API |
| Reaction badges at bubble bottom | 2026-01-21 | Left for sent messages, right for received |
| Date separators with Today/Yesterday | 2026-01-21 | Locale-aware with friendly shortcuts |
| Display name fallback chain | 2026-01-21 | contactName > displayName > participants > handleId |
| Chat identifier for universal send | 2026-01-21 | AppleScript chat id works for all conversation types including unnamed groups |
| attributedBody string extraction | 2026-01-21 | Lightweight parsing without full binary plist library |
| 5-second polling interval | 2026-01-21 | Balance between freshness and system resources |
| Max 2 participants displayed | 2026-01-21 | Prevents layout overflow with large group chats |
| electron-store v8 for Gmail auth | 2026-01-22 | v11 is ESM-only, main process uses CommonJS |
| PKCE over basic OAuth | 2026-01-22 | S256 code challenge prevents authorization code interception |
| Loopback server on 127.0.0.1:8847 | 2026-01-22 | More reliable than custom protocol handlers for OAuth callback |
| Always prompt=consent for Gmail | 2026-01-22 | Ensures refresh_token always granted for offline access |
| safeStorage with plaintext fallback | 2026-01-22 | Use hardware encryption when available without breaking compatibility |
| Base64 attachment transfer over IPC | 2026-01-22 | Electron IPC cannot transfer Buffer objects directly |
| Duplicate Gmail types in ipcTypes.ts | 2026-01-22 | TypeScript rootDir restrictions prevent import from main process |
| Primary inbox only via category:primary | 2026-01-22 | Gmail API category label for inbox filtering |
| Full thread details for all threads | 2026-01-22 | No lazy loading - fetch full details immediately for simpler implementation |
| Expand most recent email by default | 2026-01-22 | Most important message visible immediately, older messages collapsed |
| HTML email rendering via dangerouslySetInnerHTML | 2026-01-22 | React's XSS protection prevents script injection |
| Quoted text progressive disclosure | 2026-01-22 | Detect "On X wrote:" pattern, show toggle to reduce visual clutter |
| Base64 attachment download with blob conversion | 2026-01-22 | IPC limitation requires base64 transfer, convert to blob on client |
| Facebook success page redirect for Instagram OAuth | 2026-01-22 | Facebook deprecated localhost as redirect URI |
| Page Access Token for Instagram API | 2026-01-22 | Instagram requires Page token, not User token |
| 60-day token expiry check on init | 2026-01-22 | Clear expired tokens automatically on service startup |

### Open Questions

- chat.db schema on macOS 15/26 - verify column names during Phase 2 (verified working)
- Instagram Business/Creator account requirement - verify during onboarding
- Electron vibrancy on macOS Tahoe 26 - test for GPU regression (fixed in Electron 36.9.2+)
- node-mac-contacts alternative - need solution for contact resolution
- Gmail credential management UX - should future plan add UI for credential setup vs environment variables?

### Blockers

- **node-mac-contacts:** Fails to build with Node.js 24 (N-API signature change). Contact names show as phone numbers until alternative implemented.
- **Gmail OAuth credentials:** Users must manually create Google Cloud project and configure OAuth credentials before authentication works. No validation until authenticate() is called.
- **Instagram OAuth credentials:** Users must create Facebook App with instagram_basic and instagram_manage_messages permissions. Requires Instagram Business/Creator account linked to Facebook Page.

### Technical Debt

None accumulated yet.

## Session Continuity

### Last Session

- **Date:** 2026-01-22
- **Activity:** Completed Plan 04-01 - Instagram auth foundation
- **Stopped at:** Plan 04-01 complete, ready for Plan 04-02

### Next Session

- **Resume with:** Plan 04-02 - Instagram IPC handlers and service
- **Context needed:** Wire instagramAuthService to IPC, implement instagramService for conversations/messages

---
*State initialized: 2026-01-20*
*Pivoted to Electron: 2026-01-20*
*Plan 01-01 completed: 2026-01-21*
*Plan 01-02 completed: 2026-01-21*
*Phase 1 complete: 2026-01-21*
*Plan 02-01 completed: 2026-01-21*
*Plan 02-02 completed: 2026-01-21*
*Plan 02-03 completed: 2026-01-21*
*Plan 02-04 completed: 2026-01-21*
*Plan 02-05 completed: 2026-01-21*
*Phase 2 complete: 2026-01-21*
*Plan 03-01 completed: 2026-01-22*
*Plan 03-02 completed: 2026-01-22*
*Plan 03-03 completed: 2026-01-22*
*Plan 04-01 completed: 2026-01-22*
