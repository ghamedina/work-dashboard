# Personal Dashboard — Implementation Plan

## Summary

SvelteKit SSR app displaying a table of active Jira work items cross-referenced with GitLab MRs. Single-user, token-authenticated, no login.

---

## Architecture

### Project Structure

```
dashboard/
├── .env                    # Secrets (never committed)
├── .env.example            # Template for env vars
├── src/
│   ├── app.html
│   ├── app.css             # Global styles (design tokens)
│   ├── lib/
│   │   ├── types.ts        # Shared TypeScript types
│   │   ├── config.ts       # Reads env vars into typed config object
│   │   └── api/
│   │       ├── jira.ts     # Jira REST API v3 client
│   │       └── gitlab.ts   # GitLab REST API client
│   └── routes/
│       ├── +page.server.ts # Server load: concurrent API calls + data merge
│       └── +page.svelte    # Main page: controls + loader + table
├── static/
└── svelte.config.js
```

### Key Design Decisions

1. **SSR with streaming** — `+page.server.ts` returns streamed promises so the client sees a loader while data arrives, not a blank page.
2. **Token protection** — All API calls happen server-side. Tokens never reach the client.
3. **Reload** — Uses SvelteKit `invalidateAll()` to re-run the server load function on demand.
4. **Render modes** — `summary` / `compact` / `relaxed` are client-side CSS class toggles; no re-fetch required.

---

## Data Flow

```
Browser loads page
  └── SvelteKit streams page HTML
        └── Server: concurrent fetch(Jira items) + fetch(GitLab MRs open+merged)
              └── Server: for each Jira item with matching MR, fetch CI pipeline status
                    └── Merge: [{jiraItem, mr?, ciStatus?}]
                          └── Client renders table
```

**Matching logic:** Find MR whose `title` contains the Jira work item key (e.g. `REP-123`). Same as shell script.

---

## Table Columns (7)

| Column     | Source       | Notes                              |
|------------|--------------|------------------------------------|
| Work Item  | Jira         | Key as button linking to Jira      |
| Summary    | Jira         | Truncated in summary mode          |
| Status     | Jira         | Colored badge                      |
| MR         | GitLab       | `!{iid}` as button linking to MR   |
| MR Status  | GitLab       | draft / open / merged              |
| CI         | GitLab       | Pipeline status badge              |
| Comments   | GitLab       | `user_notes_count`                 |

---

## .env Variables

```
JIRA_BASE_URL=https://housecall.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=...
JIRA_PROJECT_KEY=REP

GITLAB_BASE_URL=https://gitlab.housecalldev.com
GITLAB_TOKEN=...
GITLAB_PROJECT_ID=435
GITLAB_REPO=housecall/housecall-web
GITLAB_AUTHOR_USERNAME=...
```

---

## Render Modes

- **summary** — tight row height, summary text truncated to 40 chars, no comment count
- **compact** — standard row height, full summary up to 80 chars (default)
- **relaxed** — generous padding, full summary, all fields

Mode is stored in Svelte `$state`, no server round-trip.

---

## Refinements Scope (2026-02-22)

### Overview

Five areas of new work, organized into three phases:

**Phase 1 — Reusable components** (no feature-specific logic)
- `DropdownMenu.svelte` — positioned overlay used by combo-box and status picker
- `ModalContainer.svelte` — generic modal dialog used by comments

**Phase 2 — Flag Switcher enhancements**
- Refresh button (re-fetch flags + revalidate all rows)
- Flag key combo-box (DropdownMenu-powered filtered suggestions)
- Clone row (copy button, inserts below, re-fetches flags)

**Phase 3 — Jira/GitLab table enhancements**
- Comments: count becomes a Button; click opens ModalContainer with MR comment table; comments fetched lazily via new SvelteKit API route
- Jira status: badge becomes clickable; DropdownMenu shows statuses from current rows; selecting one transitions the issue via Jira API

---

### DropdownMenu component

Generic positioned overlay. Props:
- `open: boolean` (bindable)
- `items: { label: string; value: string }[]`
- `onSelect: (value: string) => void`
- `maxItems?: number` (default 10)
- `anchor` — reference element for positioning (below it)

Renders as a `<ul>` absolutely positioned below anchor. Closes on outside click or Escape. Scroll if items exceed `maxItems`.

---

### ModalContainer component

Generic modal overlay. Props:
- `open: boolean` (bindable)
- `title` snippet — header content
- `children` snippet — body content

Semi-transparent backdrop, centered card, close button (×), Escape to close. Scroll overflow on body.

---

### Flag Switcher — Refresh button

- Add a `↻` icon button to FlagSwitcher header, visually adjacent to the `+` (add row) button
- On click: call the same flags-fetch logic used on mount, updating `flags` state
- `emailInSegment` in each row is already derived from `flags`, so refreshing `flags` automatically revalidates all rows' status column
- Show brief loading state on the button while fetching

---

### Flag Switcher — Flag key combo-box

In `FlagSwitcherRow.svelte`:
- Replace plain `<input>` with a combo-box pattern:
  - Typing shows `DropdownMenu` below input, filtered by substring match (case-insensitive) against `flags[].key`
  - Dropdown is hidden when input is empty
  - Max 10 items visible (scrollable)
  - Clicking an item sets `flagKey` and closes dropdown
  - Close on blur (with small delay to allow click) or Escape
- Filtering happens entirely client-side (flags already loaded in parent)

---

### Flag Switcher — Clone row

In `FlagSwitcher.svelte`:
- Add `onClone` handler: accepts a row, creates a copy with a new UUID, inserts it immediately after the source row in the `rows` array
- Persist updated rows to localStorage
- After insertion, trigger a flags re-fetch to revalidate the new row's status

In `FlagSwitcherRow.svelte`:
- Add clone button (copy icon, `icon` variant Button) next to the remove button
- Calls `onClone(row)` on click

---

### DataTable — Comments modal

**New API route:** `GET /api/gitlab/mrs/[iid]/comments`
- Server-side proxy to GitLab `/api/v4/projects/:id/merge_requests/:iid/notes?sort=asc&per_page=100`
- Filters out system notes (`system: true`)
- Returns: `{ id, body, webUrl }[]` where `webUrl = "{mr.webUrl}#note_{id}"`
- Uses existing `GITLAB_TOKEN`, `GITLAB_BASE_URL`, `GITLAB_PROJECT_ID` from env

**DataTable changes:**
- Comment count column: render as `<Button variant="link">` (or show `—` if no MR or count = 0)
- Clicking opens `ModalContainer` with:
  - Header: MR title + `!{iid}` as a clickable link (opens MR in new tab)
  - Body: `<Table>` with 3 columns: `#` | Comment | Link
    - `#`: comment index (1-based)
    - Comment: text truncated via CSS (`max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`); clicking removes truncation (toggles a per-row expanded state)
    - Link: small icon button that opens `{webUrl}` in new tab
- Comments fetched lazily: `null` until button clicked; loading state shown inside modal; cached per MR iid for session

---

### DataTable — Jira status update

**New API route:** `PATCH /api/jira/issues/[key]/status`
- Request body: `{ statusName: string }`
- Server-side:
  1. `GET /rest/api/3/issue/{key}/transitions` — fetch available transitions
  2. Find transition where `transition.to.name` matches `statusName` (case-insensitive)
  3. `POST /rest/api/3/issue/{key}/transitions` with `{ transition: { id } }`
  4. Return `{ ok: true }` or error

**DataTable changes:**
- Collect all unique statuses from `rows` into a `statusOptions` list
- Status column: replace static badge with a clickable element (same badge styling, cursor: pointer)
- Clicking opens `DropdownMenu` anchored to the badge, listing `statusOptions`
- Selecting an option:
  1. Calls `PATCH /api/jira/issues/{key}/status`
  2. Optimistic update: immediately update the row's status in local state
  3. On error: revert + show brief error state on the badge
- DataTable needs local row state (`rows` becomes `$state([...rows])` instead of a prop-only read)

---

### New files summary

| File | Purpose |
|------|---------|
| `src/lib/components/DropdownMenu.svelte` | Reusable dropdown overlay |
| `src/lib/components/ModalContainer.svelte` | Reusable modal dialog |
| `src/routes/api/gitlab/mrs/[iid]/comments/+server.ts` | Proxy GitLab MR notes |
| `src/routes/api/jira/issues/[key]/status/+server.ts` | Proxy Jira status transition |
| `src/PLAN_TASKS/` | Per-task implementation notes |

---

## Controls

- **Reload button** — icon only (`↻`), tooltip "Reload data" (appears after 400ms hover)
- **Mode toggle group** — 3 buttons: `⊟` Summary / `≡` Compact / `⊞` Relaxed

---

## Loader Screen

While streaming data:
- Spinner
- Status lines per API:
  - `Fetching Jira items...` → `✓ 5 items` (or error)
  - `Fetching GitLab MRs...` → `✓ 3 MRs` (or error)

---

## Styling

- Font: system-ui
- Colors: muted blue/gray palette
- Shadows: `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`
- Border radius: `4px` (nearly sharp)
- Hover: `filter: brightness(0.96)` on buttons
- No external CSS frameworks (plain CSS with custom properties)
