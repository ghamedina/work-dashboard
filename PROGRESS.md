# Progress

## Status: Initial build complete ✓

---

## How to Run

1. **Install dependencies** (already done)
   ```bash
   yarn install
   ```

2. **Configure environment** — edit `.env` and fill in:
   - `JIRA_EMAIL` — your Atlassian email address
   - `GITLAB_AUTHOR_USERNAME` — your GitLab username

   The Jira and GitLab tokens are already set in `.env`.

3. **Start dev server**
   ```bash
   yarn dev
   ```
   Open http://localhost:5173

---

## Completed Tasks

### Task 1 — Project scaffold
- SvelteKit + TypeScript initialized via `npx sv create`
- `.env.example` created with all required variable names
- `src/app.css` with CSS custom properties (design tokens)
- `src/lib/types.ts` — `JiraWorkItem`, `GitLabMR`, `CIPipelineStatus`, `DashboardRow`, `RenderMode`
- `src/lib/config.ts` — reads env vars into typed `DashboardConfig`

### Task 2 — API clients
- `src/lib/api/jira.ts` — fetches active Jira items assigned to current user
- `src/lib/api/gitlab.ts` — fetches open + merged MRs, CI pipeline status
- Both use typed responses and throw descriptive errors on failure

### Task 3 — Server load function
- `src/routes/+page.server.ts` — SvelteKit streaming load
- Concurrent Jira + GitLab fetches (shared promises, no duplicate calls)
- Matches MRs to Jira items by looking for the Jira key in the MR title
- Fetches CI pipeline status concurrently for all matched MRs

### Task 4 — Loader component
- `src/lib/components/Loader.svelte`
- Spinner + two status lines (one per API)
- Each line shows pending → success (count) → error state via `{#await}`

### Task 5 — DataTable component
- `src/lib/components/DataTable.svelte`
- 7 columns: Work Item, Summary, Status, MR, MR Status, CI, Comments
- 3 render modes (summary/compact/relaxed) via CSS and conditional rendering
- Summary truncation: 40 / 80 / ∞ chars per mode
- CI and Comments columns hidden in summary mode
- Colored badges for Jira status, MR status, CI status

### Task 6 — Controls component
- `src/lib/components/Controls.svelte`
- Reload button with 400ms tooltip delay
- Mode toggle group (Summary / Compact / Relaxed) with icons

### Task 7 — Main page
- `src/routes/+page.svelte` — wires Controls + Loader + DataTable
- Reload triggers `invalidateAll()` to re-run server load
- Error boundary with "Try again" button

### Task 8 — Validation
- `npm run check` → 0 TypeScript errors
- `npm run build` → successful production build

---

## Architecture

```
src/
├── app.css                        # CSS custom properties (design tokens)
├── lib/
│   ├── types.ts                   # Shared TypeScript types
│   ├── config.ts                  # Env var → typed config
│   ├── api/
│   │   ├── jira.ts                # Jira REST API v3 client
│   │   └── gitlab.ts              # GitLab REST API client
│   └── components/
│       ├── Controls.svelte        # Reload + mode toggle buttons
│       ├── Loader.svelte          # Loading state with API status
│       └── DataTable.svelte       # Main 7-column table
└── routes/
    ├── +layout.svelte             # Imports app.css
    ├── +page.server.ts            # SSR load with streaming
    └── +page.svelte               # Main page
```

---

## Refinements Scope — Status: Planned (2026-02-22)

Tasks in `PLAN_TASKS/`:

| # | Task | Status |
|---|------|--------|
| 01 | DropdownMenu component | complete |
| 02 | ModalContainer component | complete |
| 03 | Flag Switcher refresh button | complete |
| 04 | Flag key combo-box | complete |
| 05 | Clone row | complete |
| 06 | Comments modal | complete |
| 07 | Jira status update API route | complete |
| 08 | Jira status picker in DataTable | complete |

---

## Known Limitations / Future Work

- **`JIRA_EMAIL` and `GITLAB_AUTHOR_USERNAME`** must be filled in `.env` (placeholders set)
- **Adapter** — using `@sveltejs/adapter-auto`; configure a specific adapter for production deployment
- **Additional scope** (from spec, not in initial build): Amplitude feature flag switcher

---

## Environment Variables

| Variable | Description | Default in .env |
|---|---|---|
| `JIRA_BASE_URL` | Jira instance base URL | `https://housecall.atlassian.net` |
| `JIRA_EMAIL` | Your Atlassian email | `placeholder@example.com` ← update this |
| `JIRA_TOKEN` | Jira API token | ✓ set |
| `JIRA_PROJECT_KEY` | Jira project key to query | `REP` |
| `GITLAB_BASE_URL` | GitLab instance URL | `https://gitlab.housecalldev.com` |
| `GITLAB_TOKEN` | GitLab personal access token | ✓ set |
| `GITLAB_PROJECT_ID` | GitLab project numeric ID | `435` |
| `GITLAB_REPO` | GitLab repo path | `housecall/housecall-web` |
| `GITLAB_AUTHOR_USERNAME` | Your GitLab username | `placeholder` ← update this |
