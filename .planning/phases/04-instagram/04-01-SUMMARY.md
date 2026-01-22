---
phase: 04-instagram
plan: 01
subsystem: auth
tags: [instagram, facebook, oauth, graph-api, electron-store, safeStorage]

# Dependency graph
requires:
  - phase: 03-gmail
    provides: OAuth authentication pattern with electron-store and safeStorage
provides:
  - Instagram type definitions (tokens, account info, conversations, messages)
  - Facebook OAuth flow with BrowserWindow redirect interception
  - Secure token storage matching Gmail pattern
  - TypeScript declarations for window.electron.instagram API
affects: [04-02 (IPC handlers), 04-03 (UI), unified-inbox]

# Tech tracking
tech-stack:
  added: [axios (already present)]
  patterns: [Facebook OAuth with success page redirect, Page Access Token vs User Token]

key-files:
  created:
    - src/main/services/instagramTypes.ts
    - src/main/services/instagramAuthService.ts
  modified:
    - src/shared/ipcTypes.ts
    - src/renderer/types.ts
    - src/renderer/electron.d.ts

key-decisions:
  - "Facebook success page redirect for OAuth (Facebook deprecated localhost)"
  - "Store Page Access Token, not User Access Token (required for Instagram API)"
  - "60-day token expiry check on initialization"

patterns-established:
  - "Instagram OAuth: Use will-redirect event to intercept Facebook success page"
  - "Instagram tokens: Exchange short-lived -> long-lived, then get Page token from /me/accounts"

# Metrics
duration: 8min
completed: 2026-01-22
---

# Phase 4 Plan 01: Instagram Auth Foundation Summary

**Facebook OAuth with BrowserWindow redirect interception, Page Access Token storage, and TypeScript declarations for Instagram Graph API**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-22T17:30:00Z
- **Completed:** 2026-01-22T17:38:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Created comprehensive Instagram type definitions for tokens, account info, conversations, messages, and 24-hour window status
- Implemented Facebook OAuth flow using BrowserWindow with will-redirect interception (Facebook deprecated localhost)
- Token storage using electron-store + safeStorage encryption (matching Gmail pattern exactly)
- Full TypeScript declarations for window.electron.instagram API in renderer

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Instagram type definitions** - `0212d19` (feat)
2. **Task 2: Create Instagram auth service** - `735f794` (feat)
3. **Task 3: Update electron.d.ts with Instagram API types** - `86a41a2` (feat)

## Files Created/Modified
- `src/main/services/instagramTypes.ts` - Token, account, conversation, message, and window status types
- `src/main/services/instagramAuthService.ts` - Facebook OAuth flow with secure token storage
- `src/shared/ipcTypes.ts` - Duplicated Instagram types for renderer access
- `src/renderer/types.ts` - Re-exports Instagram types from shared
- `src/renderer/electron.d.ts` - window.electron.instagram API declarations

## Decisions Made
- **Facebook success page redirect:** Facebook deprecated localhost as valid redirect URI; using `https://www.facebook.com/connect/login_success.html` with will-redirect interception
- **Page Access Token storage:** Instagram API requires Page Access Token (not User Access Token); exchange user token via /me/accounts endpoint
- **Token expiry check:** 60-day long-lived token expiry checked on service initialization; clears expired tokens automatically

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

**External services require manual configuration.** This plan requires:
- FACEBOOK_APP_ID environment variable (from Facebook Developers Console)
- FACEBOOK_APP_SECRET environment variable (from Facebook Developers Console)
- Facebook App with instagram_basic and instagram_manage_messages permissions
- Valid OAuth Redirect URI: https://www.facebook.com/connect/login_success.html

## Next Phase Readiness
- Instagram auth service ready for IPC handler registration (Plan 04-02)
- Type definitions ready for instagramService implementation
- Patterns established match Gmail implementation for consistency

---
*Phase: 04-instagram*
*Completed: 2026-01-22*
