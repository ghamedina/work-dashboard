# Task 05 — Clone row

## Goal
Add a "clone" button to each FlagSwitcherRow that creates a duplicate row immediately below the original, then re-fetches flags.

## Acceptance criteria
- [x] Each row has a copy/clone icon button, placed next to the `×` (remove) button
- [x] Clicking clone creates a new row with the same `flagKey`, `segmentName`, and `email` values, but a new UUID `id`
- [x] New row is inserted immediately after the cloned row in the list (not at the bottom)
- [x] Updated rows array is persisted to localStorage
- [x] After insertion, flags are re-fetched (reusing the refresh logic from Task 03), revalidating the new row's status
- [x] Uses `Button` component with `variant="icon"` and a copy/duplicate icon

## Architecture notes
- Add `onClone: (row: FlagSwitcherRowData) => void` prop to `FlagSwitcherRow`
- In `FlagSwitcher`, handle `onClone`: find index of row by id, splice new row in at `index + 1`, then call `loadFlags()`
- New row: `{ id: crypto.randomUUID(), flagKey: row.flagKey, segmentName: row.segmentName, email: row.email }`
- File to modify: `src/lib/components/FlagSwitcher.svelte`, `src/lib/components/FlagSwitcherRow.svelte`

## Dependencies
- Task 03 (refresh logic) should be in place so `loadFlags()` is cleanly callable
