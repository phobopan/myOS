---
phase: 02-imessage
plan: 05
subsystem: messaging
tags: [imessage, send, applescript, electron, ipc, polling]

# Dependency graph
requires:
  - phase: 02-04
    provides: UI components (MessageBubble, Composer placeholder)
  - phase: 02-03
    provides: IPC bridge, iMessageService
provides:
  - Send messages to any conversation via chat identifier
  - Optimistic UI for instant send feedback
  - Auto-expanding Composer component
  - 5-second polling for near-instant updates
  - attributedBody parsing for null-text messages
affects: [03-gmail, unified-inbox]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AppleScript chat id reference for universal send"
    - "Optimistic UI with rollback on failure"
    - "attributedBody binary plist parsing"
    - "setInterval polling with cleanup"

key-files:
  created:
    - src/main/services/sendService.ts
  modified:
    - src/main/ipc.ts
    - src/main/preload.ts
    - src/main/services/iMessageService.ts
    - src/main/services/types.ts
    - src/renderer/App.tsx
    - src/renderer/components/ThreadView.tsx
    - src/renderer/components/MessageBubble.tsx
    - src/renderer/components/Composer.tsx
    - src/renderer/components/ConversationList.tsx
    - src/renderer/electron.d.ts

key-decisions:
  - "sendToChat with chat identifier replaces sendToGroupChat for all conversations"
  - "attributedBody parsed via string extraction (no full plist lib)"
  - "5-second polling interval balances freshness vs battery"
  - "Participant lists truncated to 2 max to prevent overflow"

patterns-established:
  - "Chat identifier is universal key for sending to any conversation"
  - "senderHandle fallback when senderName unavailable in group chats"
  - "Polling useEffect with cleanup interval pattern"

# Metrics
duration: 15min
completed: 2026-01-21
---

# Phase 02 Plan 05: Message Sending Summary

**Complete iMessage send functionality with optimistic UI, universal chat identifier send, and user feedback fixes**

## Performance

- **Duration:** 15 min
- **Started:** 2026-01-21T22:15:00Z
- **Completed:** 2026-01-21T22:30:00Z
- **Tasks:** 7 (2 original + 5 user feedback fixes)
- **Files modified:** 11

## Accomplishments

### Original Plan (Tasks 1-2)
- Created sendService.ts with AppleScript-based message sending
- Added sendMessage (1:1), sendToGroupChat (named groups) functions
- Built auto-expanding Composer with shift+enter for newlines
- Implemented optimistic UI with immediate message display
- Added error handling with rollback on send failure

### User Feedback Fixes (Tasks 3-7)
- **Fix 1:** Added sendToChat function using chat identifier, enabling replies to unnamed group chats
- **Fix 2:** Added senderHandle fallback in MessageBubble for group chat sender identification
- **Fix 3:** Implemented attributedBody parsing to resolve messages showing only timestamps
- **Fix 4:** Added 5-second polling interval for near-instant conversation updates
- **Fix 5:** Truncated participant lists (max 2) to prevent UI overflow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create send service** - `c03153b` (feat)
2. **Task 2: Add Composer with optimistic UI** - `dba07d6` (feat)
3. **Fix 1: Group chat sending** - `55cb33d` (fix)
4. **Fix 2: Sender identification** - `9b48dc5` (fix)
5. **Fix 3: attributedBody parsing** - `e67c2ff` (fix)
6. **Fix 4: Polling refresh** - `8fa8c5d` (fix)
7. **Fix 5: Participant overflow** - `6492022` (fix)

## Files Created/Modified

### New Files
- `src/main/services/sendService.ts` - AppleScript message sending (sendMessage, sendToGroupChat, sendToChat)

### Modified Files
- `src/main/ipc.ts` - Added send IPC handlers, attributedBody parsing for conversations
- `src/main/preload.ts` - Exposed send APIs to renderer
- `src/main/services/iMessageService.ts` - Added parseAttributedBody function, updated conversation query
- `src/main/services/types.ts` - Added last_message_attributed_body to DBConversation
- `src/renderer/App.tsx` - Added 5-second polling useEffect
- `src/renderer/components/ThreadView.tsx` - sendToChat integration, participant truncation
- `src/renderer/components/MessageBubble.tsx` - senderHandle fallback for sender display
- `src/renderer/components/Composer.tsx` - Auto-expanding textarea, disabled state
- `src/renderer/components/ConversationList.tsx` - Participant truncation (max 2)
- `src/renderer/electron.d.ts` - sendToChat type definition

## Decisions Made

1. **Chat identifier for universal send** - AppleScript `chat id` reference works for all conversation types, eliminating the need for separate named/unnamed group handling
2. **attributedBody string extraction** - Lightweight parsing without full binary plist library, extracts text via readable character matching
3. **5-second polling** - Balances user experience (near-instant updates) with system resources
4. **Max 2 participants shown** - Prevents long phone number lists from causing layout issues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added sendToChat for unnamed group chats**
- **Found during:** User verification feedback
- **Issue:** Original sendToGroupChat only worked for named groups
- **Fix:** Added sendToChat using AppleScript chat id reference
- **Commit:** `55cb33d`

**2. [Rule 2 - Missing Critical] Added senderHandle fallback**
- **Found during:** User verification feedback
- **Issue:** Group chat messages showed no sender when contact name unavailable
- **Fix:** Display phone/email as fallback
- **Commit:** `9b48dc5`

**3. [Rule 1 - Bug] Fixed messages showing only timestamp**
- **Found during:** User verification feedback
- **Issue:** Many messages had null text (content in attributedBody blob)
- **Fix:** Added parseAttributedBody function to extract text
- **Commit:** `e67c2ff`

**4. [Rule 2 - Missing Critical] Added conversation polling**
- **Found during:** User verification feedback
- **Issue:** New messages only appeared after manual refresh
- **Fix:** Added 5-second polling interval
- **Commit:** `8fa8c5d`

**5. [Rule 1 - Bug] Fixed participant overflow**
- **Found during:** User verification feedback
- **Issue:** Long participant lists broke layout
- **Fix:** Truncate to max 2, show "+X" or "and X more"
- **Commit:** `6492022`

## Issues Encountered

None blocking - all user feedback issues were fixable within deviation rules.

## User Setup Required

None - send functionality uses AppleScript which works with existing Messages.app without additional configuration.

## Phase 2 Completion Status

With Plan 05 complete, Phase 2 (iMessage Integration) is 100% complete:

| Plan | Status | Description |
|------|--------|-------------|
| 02-01 | Complete | SQLite chat.db access |
| 02-02 | Complete | Contact resolution + FDA onboarding |
| 02-03 | Complete | IPC bridge for renderer |
| 02-04 | Complete | UI data integration |
| 02-05 | Complete | Send functionality |

**Ready for Phase 3:** Gmail integration can proceed. The patterns established here (IPC bridge, optimistic UI, polling) will inform Gmail implementation.

---
*Phase: 02-imessage*
*Completed: 2026-01-21*
