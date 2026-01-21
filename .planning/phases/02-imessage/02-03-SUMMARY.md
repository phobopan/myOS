---
phase: 02-imessage
plan: 03
subsystem: ipc
tags: [electron, ipc, typescript, imessage]

# Dependency graph
requires:
  - phase: 02-imessage
    plan: 01
    provides: iMessageService with getConversations, getMessages, getAttachments
  - phase: 02-imessage
    plan: 02
    provides: contactService with resolveHandle, permissionService
provides:
  - IPC handlers for renderer to fetch iMessage data
  - Typed window.electron.imessage API
  - Contact name resolution in IPC responses
  - Attachment metadata with expanded paths
  - Reaction extraction from tapback messages
affects: [02-04 (UI components), 02-05 (conversation view)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IPC namespace pattern: imessage:getConversations"
    - "Shared types in src/shared/ for cross-process typing"
    - "Reaction extraction via guid mapping"

key-files:
  created:
    - src/main/ipc.ts
    - src/shared/ipcTypes.ts
  modified:
    - src/main/main.ts
    - src/main/preload.ts
    - src/renderer/electron.d.ts
    - src/renderer/types.ts
    - tsconfig.json
    - tsconfig.main.json
    - package.json

key-decisions:
  - "Create src/shared/ directory for cross-process types"
  - "Centralize IPC handlers in ipc.ts instead of inline in main.ts"
  - "Build reaction map by extracting tapbacks from message list"

patterns-established:
  - "IPC handlers in src/main/ipc.ts with registerIpcHandlers()"
  - "Shared types in src/shared/ipcTypes.ts"
  - "React GUI accesses iMessage via window.electron.imessage.*"

# Metrics
duration: 4min
completed: 2026-01-21
---

# Phase 2 Plan 03: IPC Bridge Summary

**IPC layer connecting renderer to iMessage services with typed APIs for conversations, messages, attachments, and reactions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-21T21:56:01Z
- **Completed:** 2026-01-21T22:00:17Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created centralized IPC handler module (`src/main/ipc.ts`)
- Implemented `imessage:getConversations` with contact name resolution and group participant lookup
- Implemented `imessage:getMessages` with attachment metadata and reaction extraction
- Created shared types directory for cross-process type safety
- Updated TypeScript configs to support shared types

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend renderer types for iMessage data** - `f99dd76` (feat)
2. **Task 2: Create IPC handlers and preload API** - `3dff781` (feat)

## Files Created/Modified

- `src/main/ipc.ts` - Centralized IPC handler registration with iMessage, permission, and contact handlers
- `src/shared/ipcTypes.ts` - Shared types for IMessageConversation, IMessageMessage, Attachment, Reaction
- `src/main/main.ts` - Now calls registerIpcHandlers(), removed inline permission handlers
- `src/main/preload.ts` - Added window.electron.imessage namespace with typed methods
- `src/renderer/electron.d.ts` - Full type declarations for window.electron API
- `src/renderer/types.ts` - Re-exports IPC types, extended Message/Conversation interfaces
- `tsconfig.json` - Added src/shared to includes
- `tsconfig.main.json` - Changed rootDir to src, added src/shared to includes
- `package.json` - Updated main entry point for new directory structure

## Decisions Made

1. **Created src/shared/ directory** - TypeScript's rootDir restriction prevented importing renderer types from main process. Shared types in neutral directory allows both processes to import.

2. **Centralized IPC handlers in ipc.ts** - Moved permission handlers from main.ts to ipc.ts. Single file for all IPC registrations improves maintainability and discoverability.

3. **Reaction extraction via guid mapping** - Instead of returning tapbacks as separate messages, extract them into a Map keyed by parent guid, then attach to parent messages. Cleaner API for UI consumption.

4. **Updated package.json main entry** - With rootDir changed to `src`, output structure changed to `dist/main/main/`. Updated entry point accordingly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript rootDir restriction**
- **Found during:** Task 2 (creating ipc.ts)
- **Issue:** Main process tsconfig had `rootDir: "src/main"` which prevented importing from `../renderer/types.ts`
- **Fix:** Created `src/shared/ipcTypes.ts` for cross-process types, updated both tsconfigs to include shared directory, changed main rootDir to `src`
- **Files modified:** tsconfig.json, tsconfig.main.json, package.json
- **Verification:** `npm run typecheck` and `npm run build` both pass
- **Committed in:** 3dff781 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Architecture improved - shared types directory is cleaner pattern than importing across process boundaries.

## Issues Encountered

None - deviation was handled smoothly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- IPC bridge complete, renderer can now fetch real iMessage data
- Ready for Plan 02-04 (UI components for conversation list)
- Ready for Plan 02-05 (message thread view)
- Contact names will show as phone numbers until node-mac-contacts alternative implemented

---
*Phase: 02-imessage*
*Plan: 03*
*Completed: 2026-01-21*
