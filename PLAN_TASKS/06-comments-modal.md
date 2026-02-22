# Task 06 — Comments modal

## Goal
Render the comment count in the DataTable as a clickable button that opens a modal showing the full MR comment thread.

## Acceptance criteria

### API route
- [x] `GET /api/gitlab/mrs/[iid]/comments` returns `MRComment[]`
- [x] Fetches from GitLab `/api/v4/projects/:id/merge_requests/:iid/notes?sort=asc&per_page=100`
- [x] Filters out system notes (`system: true`)
- [x] Each item: `{ id: number; body: string; webUrl: string }` where `webUrl = "{mr.webUrl}#note_{id}"`
- [x] Uses `GITLAB_TOKEN`, `GITLAB_BASE_URL`, `GITLAB_PROJECT_ID` from private env

### DataTable
- [x] Comment count renders as `<Button variant="link">` showing the count
- [x] If `!mr` or `userNotesCount === 0`, renders `—` (plain text, no button)
- [x] Clicking the button opens `ModalContainer` for that row
- [x] Modal header: MR title + `!{iid}` as a link (opens `mr.webUrl` in new tab)
- [x] Modal body: table with columns `#` | Comment | Link
- [x] `#`: 1-based index
- [x] Comment cell: text is truncated by default (`max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`)
- [x] Clicking comment text toggles expanded state (removes truncation, allows line wrap)
- [x] Link cell: icon button that opens `comment.webUrl` in new tab
- [x] While fetching: show loading indicator inside modal
- [x] On fetch error: show error message inside modal
- [x] Comments are cached per MR iid in a local `Map` for the session (avoid re-fetching on re-open)

## Architecture notes
- DataTable currently renders snippets for table rows; opening a modal per-row requires tracking `openModalForMr: number | null` state (the MR iid)
- `commentsCache: Map<number, MRComment[]>` in DataTable state
- Add `MRComment` type to `src/lib/types.ts`
- File to create: `src/routes/api/gitlab/mrs/[iid]/comments/+server.ts`
- Files to modify: `src/lib/components/DataTable.svelte`, `src/lib/types.ts`

## Dependencies
- Task 02 (ModalContainer) must be complete first
