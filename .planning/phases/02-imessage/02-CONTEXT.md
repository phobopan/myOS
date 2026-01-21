# Phase 2: iMessage - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can read and respond to iMessage conversations directly from the app. This includes viewing conversation list, reading threads with images/attachments/reactions, and sending replies via AppleScript. Requires Full Disk Access permission.

</domain>

<decisions>
## Implementation Decisions

### Conversation List
- Show contact name with small iMessage source badge (distinguishes from future Gmail/Instagram)
- Display truncated last message + relative timestamp ("2m ago")
- Group chats show group name if set, otherwise "John, Jane, +2" format
- No visual distinction for unread (unified inbox filters to unreplied anyway)
- Fallback to phone/email when no contact name available

### Thread Display
- Glassmorphism bubbles matching app aesthetic (translucent glass effect)
- Messages aligned by sender (sent right, received left)
- Images show as inline thumbnails, click to expand
- Other file attachments show as clickable chips with filename/type
- Reactions display as small emoji badges on bubble corner
- Date/time separators between message groups ("Today", "Yesterday", etc.)

### Compose & Send
- Floating glass panel at bottom of thread pane with margin
- Auto-expanding textarea (single line grows as you type, up to max height)
- Enter to send, Shift+Enter for newline
- Optimistic UI: sent message appears immediately with sending indicator
- Auto-scroll thread to bottom after sending

### Permission Flow
- Dedicated onboarding flow on first launch
- Text instructions with button to deep link directly to Privacy settings
- If permission denied: empty state with friendly explanation + "Grant Access" retry button
- Non-blocking: user can still access other features (Gmail/Instagram when added)

### Claude's Discretion
- Privacy explanation depth (how much detail about local-only access)
- Exact bubble styling and glass opacity values
- Loading states and error handling
- Sending indicator design
- Max height for auto-expanding textarea

</decisions>

<specifics>
## Specific Ideas

- Glassmorphism bubbles should match the app's existing glass panel aesthetic established in Phase 1
- Source badge prepares for unified inbox where iMessage/Gmail/Instagram mix together
- Enter-to-send matches iMessage behavior users already know

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-imessage*
*Context gathered: 2026-01-21*
