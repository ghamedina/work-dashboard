# Tabs nav + Slack todos + Confluence starred-docs

**Status:** draft
**Date:** 2026-05-22
**Author:** Noor Ghamedi

## Summary

The dashboard is becoming card-heavy. Replace the current vertical stack of cards
with a top tab bar (Work / Reviews / Slack / Docs) and add two new data sources:

- **Slack todos:** Slack messages I reacted to with the `:todo:` emoji on or
  after a configurable cutoff date. "Done" semantics = remove the reaction in
  Slack; the item disappears on next refresh.
- **Document reviews:** Confluence pages I starred (favorited) on or after a
  configurable cutoff date.

Both new tabs are gated by config presence and silently hide when their
config block is absent from `settings.yml`.

## Goals

- Reduce vertical scrolling on the dashboard by collapsing four cards into
  four tabs sharing one panel area.
- Surface Slack `:todo:` reactions as a working follow-up list without changing
  any team's existing Slack workflow.
- Surface Confluence pages I've recently starred so doc-review requests don't
  get lost.
- Keep the dashboard usable when Slack or Confluence aren't configured.

## Non-goals

- A local "mark as done" toggle for Slack todos (state lives in Slack).
- Posting to Slack or Confluence from the dashboard (read-only).
- Confluence comments, mentions, or inline-comment review queues.
- Tabs scaling beyond four — if a fifth category appears, revisit layout.
- Deep-linking tabs via URL (uses `localStorage` only).

## Architecture

### File layout

```
src/lib/
  api/
    slack.ts                # new: fetchSlackTodos
    confluence.ts           # new: fetchStarredPages
  components/
    Tabs.svelte             # new: top tab strip + active-tab state
    SlackTodosCard.svelte   # new
    DocsReviewsCard.svelte  # new
  types.ts                  # +SlackTodo, +ConfluenceStarredPage
  config.ts                 # +slack, +confluence blocks (both optional)
src/routes/
  +page.server.ts           # +slackTodos + docsReviews streams
  +page.svelte              # restructure into <Tabs> with 4 panels
.env.example                # +SLACK_TOKEN
settings.yml.example        # +slack, +confluence blocks
```

### Layout

```
UpdateBanner
TabsBar  ←  [Work (n)] [Reviews (n)] [Slack (n)] [Docs (n)]   ⟳ Reload
<Container>
  {#if active === 'work'}    <Controls /> + <DataTable />     (existing)
  {:else if active === 'reviews'}  <ReviewsTable />            (existing)
  {:else if active === 'slack'}    <SlackTodosCard />          (new)
  {:else if active === 'docs'}     <DocsReviewsCard />         (new)
  {/if}
FlagSwitcher   (unchanged, stays floating)
```

- Panels are `{#if}`-mounted (re-mount on switch). Data lives in
  `data.streamed.*` promises that resolve once, regardless of mount state,
  so re-mount is cheap.
- `<Controls>` (mode toggle + status filters) stays inside the Work panel —
  it's work-table-specific.
- The reload button moves into the right side of `TabsBar` so it's always
  reachable.
- Tabs whose config block is missing are not rendered in the tab bar at all
  (mirrors how `githubConfigured` is used today).

### `Tabs.svelte` API

```ts
interface Props {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;                  // bindable
  onReload: () => void;
}
```

- Persists last-active to `localStorage['dashboard-active-tab']` on change.
- On mount, reads stored value; falls back to `tabs[0].id` if the stored
  value isn't in the currently-visible tab set.
- Counts render as a subdued number next to the label; omitted while the
  tab's data promise is unresolved.

## Data flow

### Slack todos — `fetchSlackTodos(config)`

1. `GET /api/reactions.list?user=<me>&limit=200`, paginate via `cursor`.
   Returns items the authenticated user reacted to (messages / files /
   file_comments), with `message.reactions[]` listing every reaction.
2. Client-side filter: keep items where some `reactions[]` entry has
   `name === config.slack.emojiName` AND `users` includes my user ID AND
   `Number(message.ts) * 1000 >= sinceMs`.
3. Build permalink directly from workspace + channel + ts:
   `https://<workspaceSubdomain>.slack.com/archives/<channelId>/p<ts.replace('.','')>`.
   Avoids one `chat.getPermalink` round-trip per item.
4. Resolve author + channel names with a single `users.list` +
   `conversations.list` upfront, cached in module scope per request.

Returns `SlackTodo[]` sorted by `reactedAt` desc.

### Confluence starred — `fetchStarredPages(config)`

1. Resolve my `accountId` once via `GET /wiki/rest/api/user/current`.
2. `GET /wiki/api/v2/users/<accountId>/relations/favorite?relationName=favourite&entityType=page`
   returns favorited pages plus the relation's `createdAt` (when I starred).
3. Filter `createdAt >= sinceMs`, paginate via the `_links.next` cursor.
4. Prepend `confluence.baseUrl` to each page's webui path for full URL.

**Risk:** The exact v2 favorites endpoint exposing per-relation `createdAt`
is not 100% certain — Atlassian's favorites surface has shifted across API
versions. Implementation MUST begin with a cURL probe to confirm before
writing more code.

**Fallback if `createdAt` is unavailable:** filter by page `lastModified
>= sinceMs` instead. Card displays a small "(filtered by page update date)"
caption under the header so the behavior change is visible.

## Config

### `.env.example` additions

```
SLACK_TOKEN=xoxp-...   # Slack user OAuth token
                       # Scopes: reactions:read, channels:read, groups:read,
                       #         im:read, mpim:read, users:read
```

Confluence reuses `JIRA_TOKEN` + `jira.email` (Atlassian basic auth).

### `settings.yml.example` additions

```yaml
slack:
  workspaceSubdomain: acme       # used to build https://acme.slack.com/... links
  emojiName: todo                # bare name, no colons; defaults to 'todo'
  since: "2026-05-15"            # ISO date; only items reacted to on/after

confluence:
  baseUrl: https://acme.atlassian.net/wiki
  since: "2026-05-15"
```

Both blocks fully optional. Missing block → tab hidden, no startup error
(mirrors the existing `github` treatment).

### `config.ts` shape

```ts
slack: {
  token: string;
  workspaceSubdomain: string;
  emojiName: string;
  since: string;        // ISO date
} | null;

confluence: {
  token: string;        // == JIRA_TOKEN
  email: string;        // == jira.email
  baseUrl: string;
  since: string;        // ISO date
} | null;
```

`getConfig()` returns `null` for each block when absent. Callers gate on
`config.slack !== null` / `config.confluence !== null`.

## Types

```ts
export interface SlackTodo {
  channelId: string;
  channelName: string;     // '#general' or 'DM with Alice'
  authorName: string;
  text: string;            // raw Slack message text (may contain markdown)
  permalink: string;
  ts: string;              // Slack timestamp, used as React key
  reactedAt: number;       // ms epoch
}

export interface ConfluenceStarredPage {
  id: string;
  title: string;
  spaceName: string;
  webUrl: string;
  starredAt: number;       // ms epoch; falls back to lastModified per Risk above
}
```

## Cards

Both `SlackTodosCard.svelte` and `DocsReviewsCard.svelte` mirror
`ReviewsTable.svelte` — header row + `<Table>` primitive + empty state.

- **Slack columns:** `Channel | Message (truncated, links to permalink) |
  Author | Reacted`.
- **Docs columns:** `Space | Title (links to page) | Starred`.

## Error handling

- Both new fetchers wrapped in the existing `resilient()` helper. API failures
  surface as inline error blocks inside the panel (same pattern as
  `rows`/`reviews` today); page load never breaks.
- Missing config block → tab hidden silently; no startup error.
- Slack `not_authed` / `invalid_auth` → panel shows
  "Slack: re-authenticate (check SLACK_TOKEN)".
- Confluence favorites endpoint returns no `createdAt` → fall back to
  `lastModified` filter + show caption (see Risk above).
- `users.list` / `conversations.list` partial failure → render items with
  raw IDs; show "(some names unavailable)" caption.
- Empty result + no error → existing `ReviewsTable` empty-state pattern.

## Manual test plan

This repo has no unit-test framework. `yarn check` (TypeScript + svelte-check)
is the only automated gate.

1. `yarn check` passes.
2. `slack` and `confluence` both absent from `settings.yml`: page loads,
   only Work + Reviews tabs visible, no errors in console or server log.
3. With `slack` configured and valid token: Slack tab visible with count;
   opens to a list of reacted items from on/after `since`; clicking a row
   opens the correct Slack permalink in a new tab.
4. Remove a `:todo:` reaction in Slack, hit reload → item disappears.
5. With `confluence` configured: Docs tab visible; starred pages from
   on/after `since` listed; clicking opens correct Confluence page; if
   `createdAt` unavailable, fallback caption is shown.
6. Tab persistence: select Slack, reload → still on Slack. Remove `slack`
   from settings, reload → falls back to Work (stored value no longer in
   visible set).
7. Existing flows unchanged: Work tab still shows Jira rows with PRs/MRs
   plus Controls; Reviews tab still shows existing review aggregation.

## Open questions

None at design time. The Confluence favorites endpoint shape is a known
implementation risk with a defined fallback (see Risk under Data flow).
