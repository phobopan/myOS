---
phase: 04-instagram
plan: 03
subsystem: ui
tags: [instagram, components, thread-view, countdown, settings, react]

# Dependency graph
requires:
  - phase: 04-02
    provides: Instagram IPC bridge with window.electron.instagram API
provides:
  - CountdownBadge component for 24-hour window display
  - InstagramMessage component for message bubbles with attachments
  - InstagramThreadView for full conversation display
  - Settings integration for Instagram connect/disconnect
affects: [04-04 (unified-inbox-integration), unified-inbox]

# Tech tracking
tech-stack:
  added: []
  patterns: [Countdown urgency colors (green/orange/gray), Expired conversation UI pattern]

key-files:
  created:
    - src/renderer/components/CountdownBadge.tsx
    - src/renderer/components/InstagramMessage.tsx
    - src/renderer/components/InstagramThreadView.tsx
  modified:
    - src/renderer/components/Settings.tsx

key-decisions:
  - "Instagram icon uses gradient background (yellow-pink-purple) matching brand"
  - "Expired threads replace composer with 'Open in Instagram' button"
  - "Character counter turns orange when <100 chars remaining"
  - "Business/Creator account requirement shown as yellow note when not connected"

patterns-established:
  - "CountdownBadge: green (normal), orange (warning <1hr), gray (expired)"
  - "Thread expired state: read-only messages + action button"

# Metrics
duration: 2min 30sec
completed: 2026-01-22
---

# Phase 4 Plan 03: Instagram UI Components Summary

**Instagram thread view components with 24-hour countdown badge, message bubbles supporting images/shares, and Settings integration for account connection**

## Performance

- **Duration:** 2min 30sec
- **Started:** 2026-01-22T21:35:02Z
- **Completed:** 2026-01-22T21:37:32Z
- **Tasks:** 4
- **Files created:** 3
- **Files modified:** 1

## Accomplishments
- CountdownBadge displays time remaining with urgency-based colors
- InstagramMessage renders text, images, shared content, and audio placeholders
- InstagramThreadView shows full conversation with header, messages, and footer
- Expired conversations show "Open in Instagram" button instead of composer
- Settings panel shows Instagram connection status with Connect/Disconnect buttons
- Business/Creator account requirement note displayed for new users

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CountdownBadge component** - `742db45` (feat)
2. **Task 2: Create InstagramMessage component** - `5e0df46` (feat)
3. **Task 3: Create InstagramThreadView component** - `47618aa` (feat)
4. **Task 4: Update Settings with Instagram connect/disconnect** - `1a88cce` (feat)

## Files Created/Modified
- `src/renderer/components/CountdownBadge.tsx` - 24-hour window countdown with urgency colors
- `src/renderer/components/InstagramMessage.tsx` - Message bubble with attachment support
- `src/renderer/components/InstagramThreadView.tsx` - Full thread display with header and composer
- `src/renderer/components/Settings.tsx` - Instagram account connection UI

## Decisions Made
- **Instagram icon gradient:** Yellow-pink-purple gradient matching Instagram brand colors
- **Expired thread behavior:** Read-only messages with "Open in Instagram" button replacing composer
- **Character limit feedback:** Counter turns orange at <100 remaining (visual urgency)
- **Account requirement note:** Yellow info box explaining Business/Creator requirement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

No additional setup required for this plan. The Instagram authentication and API services from Plans 04-01 and 04-02 are used via the IPC bridge.

## Next Phase Readiness
- UI components ready for integration into main App layout
- InstagramThreadView can be rendered when user selects Instagram conversation
- Settings panel ready to trigger authentication flow
- Plan 04-04 will wire these components into the unified inbox

---
*Phase: 04-instagram*
*Completed: 2026-01-22*
