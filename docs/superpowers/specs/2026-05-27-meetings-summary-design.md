# Meetings Summary block — Phase 2 of My Manager tab

**Status:** Spec for Phase 2 of the My Manager tab feature.
**Date:** 2026-05-27.

## Goal

Surface a concise, LLM-generated summary of Noor's meetings for the current ISO week inside the Weekly Update card, so his manager can see at a glance who he met with and what was discussed.

## Phase context

- **Phase 1 (shipped).** New "My Manager" tab. Per-team Weekly Update card. Auto-pulled Jira/MRs/PRs for Design System; manual notes for Reporting.
- **Phase 2 (this spec).** Adds a single "Meetings this week" block at the bottom of the card. LLM-summarized bullets, one per meeting, derived from Granola notes that auto-sync to a Notion database. Cached per ISO week with a "Regenerate" button.
- **Phase 3 (future).** Full Weekly Update draft generation + Confluence archive. Not in scope here.

## Pipeline

```
Granola (Mac app) → Notion DB (auto-sync) → Dashboard reads via Notion API → Claude Code CLI summarizes → cached to disk → rendered as bullets
```

External prereqs the user owns:
- Granola desktop app installed and signed in.
- Notion workspace.
- Granola's Notion integration configured to write meeting notes into a destination database.
- A Notion internal integration ("work-dashboard") with the destination database shared to it; token saved as `NOTION_TOKEN`.
- Claude Code CLI (`claude`) installed and authenticated under the user's subscription.

## Scope (Phase 2)

In scope:
- New `notion:` and `claudeCli:` blocks in `settings.yml`.
- New `NOTION_TOKEN` env var.
- New `src/lib/api/notion.ts` — fetch meeting notes for the current ISO week.
- New `src/lib/api/claudeCli.ts` — shell out to `claude -p` with a prompt, return stdout.
- New `src/lib/api/meetingsSummary.ts` — orchestrator (cache → Notion → Claude → cache write).
- New `src/lib/meetingsCache.ts` — pure file I/O for the per-week cache.
- New `src/lib/components/MeetingsSummaryBlock.svelte` — render bullets + Regenerate button.
- New `src/routes/api/meetings/regenerate/+server.ts` — POST endpoint that clears the cache and returns a fresh summary.
- Integration into the existing Weekly Update card.

Out of scope:
- Per-team meeting tagging (a single global block; meetings belong to the user, not to a team).
- A full Weekly Update draft (Phase 3).
- Confluence archive (Phase 3).
- Notion writes (read-only access).
- Reading meetings from sources other than Notion.
- Auto-refresh on schedule. Cache only refreshes when (a) ISO week rolls over and triggers a miss, or (b) user clicks Regenerate.

## Config

### `settings.yml`

New optional `notion:` block:

```yaml
notion:
  meetingsDbId: <32-char-hex-db-id>     # Notion database Granola syncs into
```

New `claudeCli:` block:

```yaml
claudeCli:
  binary: claude                         # CLI command on PATH (or absolute path)
  model: claude-haiku-4-5                # model arg passed via -p flag
```

Rules:
- `notion:` is optional. If `notion.meetingsDbId` is absent or empty, the Meetings block is hidden (consistent with how Slack / Confluence / teams tabs hide).
- `claudeCli:` is optional. If absent, default to `{ binary: 'claude', model: 'claude-haiku-4-5' }`.
- `getConfig()` exposes a new boolean `notionConfigured: boolean` and a new `claudeCli: { binary: string; model: string }` block.

### `.env`

```
NOTION_TOKEN=secret_xxxxxxxxxx
```

If `notion.meetingsDbId` is set but `NOTION_TOKEN` is missing, fail fast at config load with a clear error.

### `.gitignore`

Add:
```
data/meeting-summaries/
```

Personal content; never committed.

## Data semantics

**ISO week boundary** reuses `getCurrentIsoWeek()` from Phase 1 (`src/lib/managerWeek.ts`).

**Fetch** all Notion DB rows where `created_time >= weekStart`. The Notion API's `/v1/databases/<dbId>/query` endpoint accepts a filter:

```json
{
  "filter": {
    "timestamp": "created_time",
    "created_time": { "on_or_after": "<weekStart ISO>" }
  },
  "sorts": [{ "timestamp": "created_time", "direction": "ascending" }]
}
```

**Per-row extraction.** Granola's default schema is assumed:
- `title` — the page title property (rich_text type)
- A `Date` property (date type) — optional; falls back to `created_time` if absent
- An `Attendees` property — accepts `multi_select`, `people`, or `rich_text` types; whichever Granola uses
- Page body content blocks — fetched via `/v1/blocks/<pageId>/children`, paragraph blocks concatenated, truncated to 1500 chars per page

Resulting `MeetingNote` type:
```ts
interface MeetingNote {
  id: string;
  title: string;
  date: string;                          // ISO timestamp
  attendees: string[];                   // names extracted from whichever property type
  notesPreview: string;                  // truncated body, ≤1500 chars
  notionUrl: string;                     // page URL for "Open in Notion" link
}
```

**Property name discovery.** First implementation reads property by name (`Date`, `Attendees`). If absent, the row falls back gracefully: `date = created_time`, `attendees = []`. If the title is also absent, the row is skipped.

**Synthesis prompt.** Sent as a single Claude CLI call:

```
SYSTEM:
You are summarizing a user's meetings this week for their manager.
Output one bullet per meeting in the order given. Choose the most natural
phrasing per bullet — past tense, third person. Each bullet should convey:
who was met with and what was discussed.
Keep bullets concise (one line each, ~15 words max).
Output only the bullets, one per line, each starting with "- ".
No preamble, no commentary, no summary line.

USER:
Week of <weekLabel>.

[Meeting 1]
Title: <title>
Date: <YYYY-MM-DD HH:mm>
Attendees: <comma-separated names>
Notes: <notesPreview>

[Meeting 2]
...
```

Each meeting's `notesPreview` is truncated to 500 chars at prompt-build time (the 1500 char body fetch leaves slack for the Notion->preview step, then we re-trim before sending to Claude).

**CLI invocation** (`src/lib/api/claudeCli.ts`):
```ts
spawnSync(config.claudeCli.binary, ['-p', combinedPrompt, '--model', config.claudeCli.model], { encoding: 'utf-8' });
```

`combinedPrompt` is the SYSTEM + USER text joined with a newline. `claude -p` (print mode) runs once non-interactively and exits with the response on stdout.

Result type:
```ts
interface MeetingsSummary {
  generatedAt: string;                   // ISO timestamp
  isoWeekYear: number;
  isoWeekNumber: number;
  bullets: string[];                     // one bullet per meeting
  meetingsCount: number;
  meetings: MeetingNote[];               // kept for "Open in Notion" links + Phase 3 reuse
}
```

## Cache

**Path:** `data/meeting-summaries/<isoYear>-W<isoWeek>.json`, two-digit week (e.g. `2026-W22.json`).

**Read:** `meetingsCache.readCache(week): MeetingsSummary | null`. Returns `null` on missing file or parse error.

**Write:** `meetingsCache.writeCache(week, summary): void`. Creates `data/meeting-summaries/` if needed.

**Invalidate (clear current week's cache):** `meetingsCache.clearCache(week): void`. Used by the Regenerate endpoint.

ISO week rollover is implicit: the new week's first load misses cache, runs the pipeline, writes a new file. Old weeks' files persist but are never read again (Phase 3 may surface them; out of scope here).

## Architecture

### Files

New:
- `src/lib/api/notion.ts` — `fetchMeetingsForWeek(config, weekStart): Promise<MeetingNote[]>`. Calls `/v1/databases/<id>/query` and `/v1/blocks/<pageId>/children` per row.
- `src/lib/api/claudeCli.ts` — `runClaudePrompt({ binary, model }, systemPrompt, userPrompt): Promise<string>`. Spawns the CLI, captures stdout. Throws on non-zero exit with stderr in the message.
- `src/lib/api/meetingsSummary.ts` — `getMeetingsSummary(config, week): Promise<MeetingsSummary>`. Orchestrator: cache-hit → return; cache-miss → fetch + synthesize + cache + return. `regenerate(config, week): Promise<MeetingsSummary>` clears cache then runs the same pipeline.
- `src/lib/meetingsCache.ts` — pure I/O helpers above.
- `src/lib/components/MeetingsSummaryBlock.svelte` — renders bullets list, Regenerate button, loading/empty/error states.
- `src/routes/api/meetings/regenerate/+server.ts` — POST handler. Calls `regenerate(config, currentWeek)`. Returns JSON `MeetingsSummary`.

Modified:
- `src/lib/types.ts` — adds `MeetingNote`, `MeetingsSummary`.
- `src/lib/config.ts` — parses `notion:` and `claudeCli:` blocks, exposes `notionConfigured`, `notion`, `claudeCli` on `DashboardConfig`. Surfaces `NOTION_TOKEN` from env.
- `src/routes/+page.server.ts` — adds `streamed.meetingsSummary: Promise<ApiResult<MeetingsSummary | null>>`. Returns `null` data (not error) when Notion isn't configured, so the card can simply hide the block.
- `src/lib/components/WeeklyUpdateCard.svelte` — appends `<MeetingsSummaryBlock>` after the teams loop. Receives the resolved summary as a prop.
- `settings.yml.example` — documents `notion:` and `claudeCli:` blocks.
- `.env.example` — documents `NOTION_TOKEN`.
- `.gitignore` — adds `data/meeting-summaries/`.

### Data flow

1. Page load → `+page.server.ts` resolves `streamed.meetingsSummary`:
   - If `!config.notionConfigured` → `{ data: null, error: null }`.
   - Else: `getMeetingsSummary(config, currentWeek)` wrapped in `resilient(...)`.
2. `+page.svelte`'s `manager` branch passes the resolved summary to `<WeeklyUpdateCard>`.
3. `WeeklyUpdateCard` passes the summary down to `<MeetingsSummaryBlock>` (only if non-null).
4. `MeetingsSummaryBlock` renders bullets + the Regenerate button.
5. Regenerate click → `fetch('/api/meetings/regenerate', { method: 'POST' })`. Component shows a spinner during the call. On 200, swap in the new summary. On 4xx/5xx, show the error inline; keep the prior summary visible.

### Error isolation

- Notion fetch fails (network, 401, wrong DB id) → block shows `Failed to fetch meetings: <reason>`. Card otherwise unaffected.
- Claude CLI fails (binary not found, subscription expired, non-zero exit) → block shows `Failed to summarize meetings: <stderr or message>` + a degraded fallback of meeting titles ("Met: 'Bug triage', 'Roadmap sync', ..."). Regenerate button still available.
- Empty Notion result → renders `No meetings recorded this week.` placeholder.
- Cache write fails (disk full, perms) → silently log; summary returned but next load will re-synthesize.

## Open questions / risks

- **Notion property names.** Granola's defaults are assumed (`Date`, `Attendees`). If the user's DB diverges, attendees will be `[]` and the date falls back to `created_time`. We accept this and surface a generic empty-attendees behavior. A follow-up could let the user override property names in `notion:` config.
- **Claude CLI on `$PATH`.** SvelteKit's `spawn` inherits the parent process env, so dev-server invocations resolve `claude`. Production builds may need an absolute path; the `claudeCli.binary` config exists to override.
- **Prompt size.** ~10 meetings × 500 chars = ~5KB. Well within Claude Haiku's input window. Cost per regenerate is sub-cent on Haiku.
- **Granola sync latency.** Notes appear in Notion only after Granola finishes processing — minutes to ~hour. A user clicking Regenerate immediately after a meeting may not see it yet.
- **Stale prior-week cache files.** Old files accumulate in `data/meeting-summaries/`. Acceptable for personal use; not in scope to GC here.

## Future phases

- **Phase 3.** Full Weekly Update draft (folds Jira + PRs + notes + this Phase 2 meetings summary into a manager-ready narrative). Confluence archive on save. Reuses the same Claude CLI helper from this phase.
