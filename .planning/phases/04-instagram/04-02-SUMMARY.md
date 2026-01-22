---
phase: 04-instagram
plan: 02
subsystem: api
tags: [instagram, graph-api, ipc, electron, rate-limiting, messaging-window]

# Dependency graph
requires:
  - phase: 04-01
    provides: Instagram OAuth authentication service and type definitions
provides:
  - Instagram Graph API service for conversations and messages
  - IPC handlers for renderer to main process communication
  - Preload API exposing window.electron.instagram
  - Rate limiter preventing API quota exhaustion
  - 24-hour messaging window calculation
affects: [04-03 (UI), 04-04 (unified-inbox), unified-inbox]

# Tech tracking
tech-stack:
  added: []
  patterns: [Rate limiting with sliding window, messaging window status calculation]

key-files:
  created:
    - src/main/services/instagramService.ts
  modified:
    - src/main/ipc.ts
    - src/main/preload.ts

key-decisions:
  - "180 requests/hour rate limit (20 buffer from 200 API limit)"
  - "Window urgency levels: normal (>1hr), warning (<1hr), expired (0)"
  - "1000 character message limit enforced at service layer"

patterns-established:
  - "Instagram service pattern: ensureAuthenticated() check before API calls"
  - "Instagram error codes: WINDOW_EXPIRED, PERMISSION_DENIED, TOKEN_EXPIRED, MESSAGE_TOO_LONG"

# Metrics
duration: 6min
completed: 2026-01-22
---

# Phase 4 Plan 02: Instagram IPC Bridge Summary

**Instagram Graph API service with rate limiting, 24-hour window calculation, and IPC bridge exposing window.electron.instagram to renderer**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-22T18:00:00Z
- **Completed:** 2026-01-22T18:06:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Instagram service fetching conversations and messages via Graph API
- Rate limiter using sliding window algorithm (180 requests/hour)
- 24-hour messaging window calculation with urgency levels
- Send message with detailed error handling for various failure modes
- IPC handlers bridging main and renderer processes
- Preload API matching Gmail pattern for consistency

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Instagram data service** - `dcc7989` (feat)
2. **Task 2: Add Instagram IPC handlers** - `dd8b406` (feat)
3. **Task 3: Add Instagram preload API** - `86fa036` (feat)

## Files Created/Modified
- `src/main/services/instagramService.ts` - Graph API operations for conversations, messages, and sending
- `src/main/ipc.ts` - 7 new IPC handlers for instagram:* namespace
- `src/main/preload.ts` - window.electron.instagram API exposed to renderer

## Decisions Made
- **180 requests/hour rate limit:** Leave 20 request buffer from 200 API limit for safety
- **Window urgency levels:** normal (>1hr remaining), warning (<1hr), expired (0)
- **1000 character limit:** Enforced at service layer per CONTEXT.md specification
- **Error codes:** Distinct codes for WINDOW_EXPIRED, PERMISSION_DENIED, TOKEN_EXPIRED, MESSAGE_TOO_LONG

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed type assertion in instagramAuthService.ts**
- **Found during:** Final verification (build step)
- **Issue:** TypeScript error - pageId and instagramBusinessAccountId could be null when constructing accountInfo
- **Fix:** Added non-null assertions (!) since values are assigned immediately before use in initializeFromToken
- **Files modified:** src/main/services/instagramAuthService.ts
- **Verification:** Build passes, `npm run build` succeeds
- **Committed in:** `2b3d8ca` (separate fix commit for 04-01 file)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug in prior plan's code - fix essential for build to succeed. No scope creep.

## Issues Encountered

None - all tasks completed without issues once the type bug was fixed.

## User Setup Required

**External services require manual configuration.** This plan requires the same setup from Plan 04-01:
- FACEBOOK_APP_ID environment variable
- FACEBOOK_APP_SECRET environment variable
- Facebook App with instagram_basic and instagram_manage_messages permissions
- Instagram Business/Creator account linked to Facebook Page

## Next Phase Readiness
- Instagram service ready for UI integration (Plan 04-03)
- Rate limiting in place to prevent API quota issues
- 24-hour window status available for countdown display
- Send message returns appropriate errors for UI feedback

---
*Phase: 04-instagram*
*Completed: 2026-01-22*
