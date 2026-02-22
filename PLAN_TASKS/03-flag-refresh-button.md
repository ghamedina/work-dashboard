# Task 03 — Flag Switcher refresh button

## Goal
Add a refresh button to the FlagSwitcher header that re-fetches all flags and revalidates the status column for all rows.

## Acceptance criteria
- [x] A `↻` icon button appears in the FlagSwitcher header, visually adjacent to the `+` (add row) button
- [x] Clicking the button re-fetches flags from `GET /api/amplitude/flags`
- [x] While fetching, the button shows a loading/disabled state
- [x] After fetching, `flags` state is updated — all rows' `emailInSegment` status revalidates automatically (derived state)
- [x] On fetch error, button returns to normal state (no crash)

## Architecture notes
- `FlagSwitcher.svelte` already has a `loadFlags()` function called on mount
- The refresh button should call the same function — just expose it as a handler
- The button should use the existing `Button` component with `variant="icon"` and a `↻` label or SVG icon
- File to modify: `src/lib/components/FlagSwitcher.svelte`

## Related tasks
- Shares flag-fetch logic with Task 05 (clone row also triggers re-fetch)
