# Task 08 — Jira status picker in DataTable

## Goal
Make the Jira status badge in the DataTable clickable. Clicking opens a dropdown of all statuses present in the current rows, and selecting one transitions the issue via the API from Task 07.

## Acceptance criteria
- [x] Status badge has `cursor: pointer` styling
- [x] Clicking a status badge opens `DropdownMenu` anchored below it
- [x] Dropdown lists all unique status strings collected from `rows` (deduped, sorted)
- [x] Selecting a status:
  1. Immediately updates that row's status in local state (optimistic update)
  2. Calls `PATCH /api/jira/issues/{key}/status` with `{ statusName }`
  3. On error: reverts the row's status to the previous value, shows brief visual error on badge
- [x] Only one dropdown open at a time (clicking a different row's badge closes the previous)
- [x] DataTable needs a local mutable copy of `rows` (was prop-only before):
  - `let localRows = $state(untrack(() => [...rows]))` (Svelte 5 runes pattern)
  - Updates to `localRows` are local-only (no server sync beyond the PATCH)

## Architecture notes
- `activeStatusRow: string | null` state tracks which Jira key has its dropdown open (`null` = none)
- `statusOptions`: derived from `localRows` — `[...new Set(localRows.map(r => r.jiraItem.status))].sort()`
- The status badge wrapper needs `position: relative` for DropdownMenu anchoring
- File to modify: `src/lib/components/DataTable.svelte`

## Dependencies
- Task 01 (DropdownMenu) must be complete first
- Task 07 (Jira status API) must be complete first
