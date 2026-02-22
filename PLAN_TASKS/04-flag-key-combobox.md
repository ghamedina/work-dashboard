# Task 04 — Flag key combo-box

## Goal
Upgrade the flag-key text input in `FlagSwitcherRow` to a combo-box: typing opens a filtered dropdown of matching flag keys.

## Acceptance criteria
- [x] Input works as before (typing updates `flagKey`)
- [x] When input is non-empty, a dropdown overlay appears below the input showing matching flag keys
- [x] Filtering: case-insensitive substring match against `flags[].key`
- [x] Dropdown shows up to 10 items; scrollable if more
- [x] Clicking an item sets `flagKey` to that value and closes the dropdown
- [x] Dropdown closes on Escape or when input loses focus (with ~150ms delay to allow click)
- [x] Dropdown is hidden when input is empty
- [x] Uses the `DropdownMenu` component from Task 01

## Architecture notes
- The input wrapper needs `position: relative` so DropdownMenu positions correctly
- `filteredKeys` is a derived list: `flags.filter(f => f.key.includes(inputValue.toLowerCase())).map(f => ({ label: f.key, value: f.key }))`
- `open` state: set to `true` on input focus/typing (if value non-empty), set to `false` on blur (delayed) or item select
- Blur delay: use `setTimeout(() => (open = false), 150)` so click on dropdown item registers before blur fires
- File to modify: `src/lib/components/FlagSwitcherRow.svelte`

## Dependencies
- Task 01 (DropdownMenu) must be complete first
