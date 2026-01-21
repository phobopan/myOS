# Project State: phoebeOS

**Last updated:** 2026-01-21
**Current phase:** 2 (iMessage) - Complete

## Project Reference

See: .planning/PROJECT.md
**Core value:** Never miss an important message. One place to see everything that needs a response.
**Current focus:** Phase 2 - iMessage Integration (Complete)

## Progress

| Phase | Status | Progress |
|-------|--------|----------|
| 1 - Foundation | Complete | 100% |
| 2 - iMessage | Complete | 100% |
| 3 - Gmail | Pending | 0% |
| 4 - Instagram | Pending | 0% |
| 5 - Unified Inbox | Pending | 0% |
| 6 - Polish | Pending | 0% |

**Overall:** 2/6 phases complete (7/7 Phase 2 plans done)

## Current Position

- **Phase:** 2 - iMessage (Complete)
- **Plan:** 05 of 05 complete
- **Status:** Phase complete
- **Last activity:** 2026-01-21 - Completed 02-05-PLAN.md with user feedback fixes
- **Progress:** [██████████] 100%

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 7 |
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

### Open Questions

- chat.db schema on macOS 15/26 - verify column names during Phase 2 (verified working)
- Instagram Business/Creator account requirement - verify during onboarding
- Electron vibrancy on macOS Tahoe 26 - test for GPU regression (fixed in Electron 36.9.2+)
- node-mac-contacts alternative - need solution for contact resolution

### Blockers

- **node-mac-contacts:** Fails to build with Node.js 24 (N-API signature change). Contact names show as phone numbers until alternative implemented.

### Technical Debt

None accumulated yet.

## Session Continuity

### Last Session

- **Date:** 2026-01-21
- **Activity:** Completed Plan 02-05 - Send functionality with user feedback fixes
- **Stopped at:** Phase 2 complete, ready for Phase 3 (Gmail)

### Next Session

- **Resume with:** Phase 3 - Gmail integration
- **Context needed:** OAuth2 patterns, Gmail API, threading model

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
