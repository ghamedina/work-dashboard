# My Manager tab — Weekly Update card

**Status:** Spec for Phase 1.
**Date:** 2026-05-26.

## Goal

Help Noor keep his manager informed about what he and his two teams (Design System, Reporting) are doing each week. The dashboard's "My Manager" tab will host this and future manager-facing cards. The first card is a **Weekly Update** for the current ISO week.

## Phasing

The full feature lands across three phases. Each phase ships independently and leaves the dashboard in a useful state.

- **Phase 1 (this spec).** New "My Manager" tab. Card renders the current ISO week's activity for two teams. Design System pulls Jira tickets + GitLab/GitHub PRs automatically. Reporting has no auto-pull; only a Notes textarea. Both teams' sections include the Notes textarea. No Zoom, no Claude, no Confluence.
- **Phase 2.** Adds a Zoom Server-to-Server OAuth integration. Each team's section gains a Meetings sub-section listing this week's Zoom cloud recordings + transcripts (Noor's only — meetings are not team-scoped).
- **Phase 3.** Adds "Generate draft" (Claude API call that folds the structured lists + notes + meeting transcripts into a narrative) and "Save to Confluence" (appends the draft to a designated page, one section per ISO week). Three actions on the rendered draft: Copy as markdown, Copy as Slack mrkdwn, Save to Confluence.

Phase 1 must leave seams for 2 and 3:
- The per-team data shape needs a slot for meetings (Phase 2).
- The card layout needs a place for the draft panel (Phase 3).

## Scope (Phase 1)

In scope:
- New `teams:` block in `settings.yml`.
- New "My Manager" tab in the existing tab nav, last in the visible-tabs list.
- One card on that tab: Weekly Update.
- Per-team rendering for Design System (auto-pull) and Reporting (notes only).
- Notes textarea per team, persisted to `localStorage` keyed by team + ISO week.
- Streamed SSR load for the per-team auto-pull, matching the existing pattern.

Out of scope:
- Zoom integration (Phase 2).
- Claude draft generation (Phase 3).
- Confluence archive (Phase 3).
- Cross-machine notes persistence (localStorage is per-browser; accepted limitation).
- Any change to the existing `team:` config used by the Work tab.

## Config

New optional top-level `teams:` block in `settings.yml`:

```yaml
teams:
  - name: Design System
    jiraProjectKeys: [DSTM, GDSP]
    members:
      - name: Noor
        jiraEmail: noor.ghamedi@housecallpro.com
        gitlabAuthorUsername: noor.ghamedi
        githubAuthorUsername: noor-hcp
      - name: Erick
        jiraEmail: erick@housecallpro.com
        gitlabAuthorUsername: erick.tatsui
  - name: Reporting
    # no jiraProjectKeys, no members → manual notes only
```

Rules:
- `teams:` is optional. If absent or empty, the My Manager tab is hidden (matching the Slack/Confluence tab pattern via a `managerConfigured` boolean in `config.ts`).
- For each team:
  - `name` is required.
  - `jiraProjectKeys` is optional. **Presence enables auto-pull** (Jira + MRs/PRs). Absence means manual only.
  - `members` is optional. Required only if `jiraProjectKeys` is set (auto-pull needs identities to filter on).
  - Each member has the same shape as the existing flat `team[]`: `{ name?, jiraEmail?, gitlabAuthorUsername?, githubAuthorUsername? }`.
- The existing `team:` block is unchanged. It continues to power the Work tab. Members may be duplicated between `team:` and `teams[].members`; we accept the duplication for v1 (a future cleanup can merge them).

`settings.yml.example` is updated to document the new block.

## Data semantics

The week boundary is the current ISO week — Monday 00:00 through Sunday 23:59 in the dashboard host's local timezone. We compute `weekStart` once at the top of the server load and pass it down.

### Per-team auto-pull (Design System)

For each team with `jiraProjectKeys` set, the server fetches:

**Jira tickets.** JQL: `project IN (teamProjectKeys) AND assignee IN (teamMemberEmails) AND updated >= startOfWeek`. Returned tickets are bucketed by current status:
- **Done this week** — `statusCategory` is "Done" AND `statusCategoryChangedDate >= weekStart`.
- **In flight** — currently in any in-progress category (`In Progress`, `In Review`, etc.) and updated this week.
- **Started this week** — moved out of "To Do" category into in-progress during this week. Requires Jira changelog data, fetched by adding `expand=changelog` to the existing search query (one extra response field, no extra requests). Detection: any status transition entry in the changelog where `from.statusCategory == 'To Do'`, `to.statusCategory == 'In Progress'`, and timestamp ≥ weekStart.

The "Done" classification reuses the Work tab's terminal-state list (`['Done', 'Closed', 'Resolved']`) plus anything in the Jira "Done" `statusCategory`. This matches existing dashboard behavior.

**GitLab MRs.** From the configured GitLab project: MRs where author username is in the team's `gitlabAuthorUsername` list AND (`merged_at` ≥ weekStart OR `updated_at` ≥ weekStart). Bucketed:
- **Merged this week** — `merged_at` ≥ weekStart.
- **Opened this week (still open)** — `created_at` ≥ weekStart AND state is open.
- **Has activity this week** — neither merged nor newly opened, but updated this week.

**GitHub PRs.** Same shape as GitLab, across all configured GitHub repos, filtered by team members' `githubAuthorUsername`.

**Jira ↔ PR merging.** When a Done-this-week Jira ticket's key appears in the title of a Merged-this-week MR/PR, render them as a single line ("REP-123 — Add export filter — !44 merged"). Otherwise they render independently in their respective buckets.

### Per-team manual (Reporting)

Teams without `jiraProjectKeys` have no auto-pull. Their section renders only the Notes textarea (and, in Phase 2, the Meetings sub-section).

### Notes

Every team's section includes a Notes textarea, regardless of auto-pull status.

- Stored in `localStorage` under the key `weekly-notes-<team-slug>-<iso-year>-W<iso-week>` (e.g. `weekly-notes-reporting-2026-W22`). `team-slug` is `name` lowercased with non-alphanumerics replaced by `-`.
- Saved on a 500 ms debounced text change.
- Each new ISO week starts blank. Prior weeks' notes remain in localStorage but are not surfaced anywhere in Phase 1 (Phase 3 will read them at save-to-Confluence time).
- localStorage is per-browser. Notes drafted on a different machine are not available — accepted limitation.

## Architecture

### Files

New:
- `src/lib/api/managerWeekly.ts` — `fetchWeeklyActivityForTeam(config, team, weekStart, weekEnd): Promise<WeeklyTeamActivity>`. Pure function; wraps the existing Jira/GitLab/GitHub clients with team-scoped queries. Returns `{ jira: null, prs: null }` for manual-only teams.
- `src/lib/components/WeeklyUpdateCard.svelte` — top-level card; renders the ISO-week header and iterates over teams.
- `src/lib/components/TeamWeeklySection.svelte` — one team's render. Conditionally renders auto-pull sub-sections, always renders `<NotesEditor>`.
- `src/lib/components/NotesEditor.svelte` — textarea + debounced localStorage hook, takes a `storageKey` prop.

Edited:
- `src/lib/types.ts` — add `TeamConfig`, `WeeklyTeamActivity` types.
- `src/lib/config.ts` — parse and validate the new `teams:` block; expose `config.teams` and `config.managerConfigured`.
- `src/routes/+page.server.ts` — add `streamed.weekly` Promise resolving `{ teams: Array<{ name, activity: ApiResult<WeeklyTeamActivity> }> }`. Each team fetched independently (per-team `resilient(...)` wrap).
- `src/routes/+page.svelte` — add `'manager'` to `visibleTabIds` (after `'docs'`), add a tab def with label `"My Manager"`, add the `{:else if active === 'manager'}` branch rendering `<WeeklyUpdateCard />` and `<Loader>` while awaiting.
- `settings.yml.example` — document `teams:`.

### Data flow

1. `+page.server.ts` reads `config.teams`. Computes `weekStart`/`weekEnd` for the current ISO week.
2. For each team, calls `fetchWeeklyActivityForTeam(...)` wrapped in `resilient(...)`. The promises are added under `streamed.weekly`.
3. `+page.svelte` awaits `data.streamed.weekly` only when the active tab is `'manager'`, following the existing per-tab `{#await}` pattern.
4. `WeeklyUpdateCard` receives the resolved `{ teams: [...] }` and iterates, rendering one `<TeamWeeklySection>` per team.
5. `TeamWeeklySection` decides whether to show auto-pull sub-sections based on `activity.jira !== null`, and always mounts `<NotesEditor>` with the appropriate storage key.

### Error handling

- The card uses the same `{#await}` + `ApiResult<T>` pattern as the Slack and Doc Reviews cards.
- Per-team failures are isolated. If the Design System Jira fetch fails, Reporting still renders. If GitLab is down for Design System, its Jira sub-sections still render and the MR sub-sections show an inline error.
- An empty team (no activity, e.g. quiet week) renders "No activity this week" rather than collapsing the auto-pull sub-sections.
- GitLab VPN unavailability uses the same `isGitLabUnavailable` detection that exists today.

## Open questions / risks

- **Notes drift across machines.** localStorage is per-browser. Accepted for v1; Phase 3's Confluence archive becomes the durable record.
- **Member duplication.** Same teammate listed in both `team:` and `teams[].members`. Acceptable for v1; a follow-up could let `teams:` be the source of truth and derive a flat `team:` from it.
- **ISO week timezone.** Computed from the dashboard host's local time. Edge case: dashboard run from a non-Pacific TZ on Sunday night could show the "wrong" week. Not a Phase 1 concern.
- **"Has activity this week" MR bucket** may be noisy. We'll observe in v1 and trim if needed.

## Future phases (sketch only)

**Phase 2 — Zoom.** Server-to-Server OAuth app at marketplace.zoom.us. New `src/lib/api/zoom.ts` listing cloud recordings + downloading VTT transcripts for the current week (Noor only). New `<MeetingsSection>` component mounted in `TeamWeeklySection` (or as a single block across teams — TBD when we get there). New env vars: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`.

**Phase 3 — Draft + archive.** "Generate draft" POSTs to `/api/manager/weekly-draft`, which calls the Anthropic SDK with the structured activity + notes + meeting transcripts as input and returns a markdown narrative. New env var: `ANTHROPIC_API_KEY`. Draft renders in an expandable panel under the card. Three buttons: Copy as markdown, Copy as Slack mrkdwn, Save to Confluence. Save POSTs to `/api/manager/save-confluence` which appends the draft (with an ISO-week heading) to a designated Confluence page configured under `manager.confluencePageId` in `settings.yml`.
