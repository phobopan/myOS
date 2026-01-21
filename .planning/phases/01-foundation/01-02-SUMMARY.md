---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [swift, swiftui, sample-data, preview]

# Dependency graph
requires:
  - phase: none
    provides: n/a (first data models)
provides:
  - SampleMessage and SampleConversation data models
  - MessageSource enum with iMessage/Gmail/Instagram
  - 6 sample conversations for UI development
  - Static preview data extensions
affects: [01-03-PLAN, 01-04-PLAN, phase-2, phase-3, phase-4]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extension-based static sample data"
    - "RelativeDateTimeFormatter for timestamps"

key-files:
  created:
    - phoebeOS/Models/SampleMessage.swift
    - phoebeOS/Preview Content/PreviewData.swift
  modified: []

key-decisions:
  - "PreviewData.swift in main target (not just Preview Content) for Phase 1 placeholder UI"
  - "RelativeDateTimeFormatter for human-readable timestamps"
  - "SF Symbols for message source icons"

patterns-established:
  - "Models in phoebeOS/Models/ directory"
  - "Static sample data via type extensions"
  - "Preview Content folder for development data"

# Metrics
duration: 3min
completed: 2026-01-21
---

# Phase 01 Plan 02: Sample Data Models Summary

**MessageSource enum and SampleConversation/SampleMessage models with 6 realistic sample conversations across iMessage, Gmail, and Instagram**

## Performance

- **Duration:** 2 min 42 sec
- **Started:** 2026-01-21T02:30:12Z
- **Completed:** 2026-01-21T02:32:54Z
- **Tasks:** 2
- **Files modified:** 8 (including blocker fix)

## Accomplishments

- Created MessageSource enum with iMessage, Gmail, Instagram cases and SF Symbol icons
- Implemented SampleMessage model with all required properties for message display
- Implemented SampleConversation model with messages array and formattedTime computed property
- Generated 6 realistic sample conversations (2 per source) with varied content

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sample data models** - `58458a7` (feat)
2. **Task 2: Create preview sample data** - `b5f59b4` (feat)

**Blocker fix:** `0d0ca4b` (chore) - Minimal Xcode project structure

## Files Created/Modified

- `phoebeOS/Models/SampleMessage.swift` - MessageSource enum, SampleMessage, SampleConversation models
- `phoebeOS/Preview Content/PreviewData.swift` - Static sample data extensions with 6 conversations
- `phoebeOS.xcodeproj/project.pbxproj` - Xcode project configuration (blocker fix)
- `phoebeOS/phoebeOSApp.swift` - App entry point (blocker fix)
- `phoebeOS/ContentView.swift` - Main content view placeholder (blocker fix)
- `phoebeOS/phoebeOS.entitlements` - App entitlements (blocker fix)
- `phoebeOS/Assets.xcassets/Contents.json` - Asset catalog (blocker fix)
- `phoebeOS/Preview Content/Preview Assets.xcassets/Contents.json` - Preview assets (blocker fix)

## Decisions Made

1. **PreviewData.swift included in main target** - For Phase 1 placeholder UI, sample data needs to be accessible in the running app, not just previews. Will move to Preview Content only after real data sources connected.
2. **RelativeDateTimeFormatter for timestamps** - Provides localized, human-readable "2h ago" style timestamps automatically.
3. **SF Symbols for source icons** - Using system symbols (message.fill, envelope.fill, camera.fill) for consistent macOS appearance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created minimal Xcode project structure**
- **Found during:** Pre-task analysis
- **Issue:** Plan 01-02 requires `phoebeOS/Models/` directory but Xcode project doesn't exist (scheduled for 01-01 which wasn't executed)
- **Fix:** Created minimal Xcode project with:
  - project.pbxproj with macOS 14.0 target
  - phoebeOSApp.swift with hidden titlebar window
  - ContentView.swift placeholder
  - Asset catalogs structure
  - Entitlements file
- **Files created:** phoebeOS.xcodeproj/project.pbxproj, phoebeOS/phoebeOSApp.swift, phoebeOS/ContentView.swift, phoebeOS/phoebeOS.entitlements, Assets.xcassets/Contents.json, Preview Assets.xcassets/Contents.json
- **Verification:** Swift compiler parses all files without errors
- **Committed in:** 0d0ca4b

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Necessary blocker fix to enable plan execution. Note: 01-01 plan may have redundant work now.

## Issues Encountered

- **xcodebuild unavailable:** Xcode CLI tools configured without full Xcode. Used `swiftc -parse` for compilation verification instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Sample data models ready for MessageListPane (01-03) and ThreadViewPane (01-04)
- All 3 message sources represented with realistic sample conversations
- `SampleConversation.samples` array available for list display
- `SampleConversation.sample` available for single-item previews
- `formattedTime` property ready for timestamp display

**Note:** Plan 01-01 (glassmorphism foundation) has overlap with blocker fix created here. Recommend reviewing 01-01 to avoid redundant work.

---
*Phase: 01-foundation*
*Completed: 2026-01-21*
