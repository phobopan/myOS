# Phase 1: Foundation - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

App shell with glassmorphism UI ready to receive data sources. Two-pane layout (message list left, thread view right), standard macOS window behavior, and settings panel skeleton. No data integration yet — this is the visual foundation.

</domain>

<decisions>
## Implementation Decisions

### Glassmorphism style
- Semi-transparent main window background — desktop visible but muted, content readable
- Heavy blur effect — very frosted glass, shapes behind are unrecognizable
- No color tint — pure neutral frosted glass, takes color from what's behind
- Layered glass for inner widgets — slightly more opaque than background, creates subtle depth

### Pane layout
- Balanced 33/67 proportions — left pane (message list) gets 1/3, right pane (thread view) gets 2/3
- Fixed divider — not user-resizable
- Thin line divider between panes — subtle vertical line separator
- Separate containers — each pane is its own rounded glass card, not one unified container

### Empty states
- Inbox zero: minimal/nothing — just empty space, clean and quiet
- No conversation selected: instruction text — "Select a conversation to view" centered in right pane
- Phase 1 placeholder: show fake/sample messages to demonstrate the layout before data sources connected

### Settings panel
- Slide-over sheet from left side — slides in over main content
- Sidebar navigation within settings — mini sidebar for section navigation (Accounts, Notifications, Shortcuts, etc.)
- Close with X button AND click-outside — both methods work to dismiss

### Claude's Discretion
- Whether placeholder items should be labeled as "Sample" or look realistic
- Exact typography choices within "white-ish text" constraint
- Specific rounded corner radii
- Animation timing for settings slide-in

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants the app named "phoebeOS"
- "Glassmorphism look" with "widgets with round corners that are more opaque than the background to enhance readability but should still have a translucent effect"
- "Nice clean modern fonts, text should mostly be white-ish"
- Background "pretty much transparent and show what's behind the tab"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-01-20*
