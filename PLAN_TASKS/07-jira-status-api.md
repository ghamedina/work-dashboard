# Task 07 — Jira status update API route

## Goal
Create a server-side API route that transitions a Jira issue to a new status by name.

## Acceptance criteria
- [x] Route: `PATCH /api/jira/issues/[key]/status`
- [x] Request body: `{ statusName: string }`
- [x] Step 1: `GET /rest/api/3/issue/{key}/transitions` with Basic auth
- [x] Step 2: Find transition where `transition.to.name` matches `statusName` (case-insensitive)
- [x] Step 3: If found, `POST /rest/api/3/issue/{key}/transitions` with `{ transition: { id } }`
- [x] Returns `{ ok: true }` on success
- [x] Returns `{ ok: false, error: string }` with appropriate HTTP status on failure
  - 404 if no matching transition found
  - 500 on Jira API error
- [x] Uses `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_TOKEN` from private env

## Architecture notes
- File to create: `src/routes/api/jira/issues/[key]/status/+server.ts`
- Jira transitions endpoint: `GET {JIRA_BASE_URL}/rest/api/3/issue/{key}/transitions`
  - Response: `{ transitions: [{ id, name, to: { name } }] }`
- Jira transition POST: `POST {JIRA_BASE_URL}/rest/api/3/issue/{key}/transitions`
  - Body: `{ transition: { id: "transitionId" } }`
- Auth header: `Basic base64(email:token)`

## Related tasks
- Used by Task 08 (Jira status picker in DataTable)
