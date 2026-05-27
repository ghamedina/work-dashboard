# Meetings Summary — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Meetings this week" block at the bottom of the Weekly Update card that renders LLM-generated bullet summaries of the user's Granola meeting notes (fetched from a Notion database, summarized via the Claude Code CLI), cached per ISO week with an inline Regenerate button.

**Architecture:** Server-side pipeline: cache lookup → on miss, fetch Notion DB rows for the current ISO week + page bodies → build a single Claude CLI prompt → spawn `claude -p` → parse bullets from stdout → write cache. A POST endpoint blows the cache to force regeneration. The block hides entirely if `notion:` config is absent.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Node `child_process.spawn`, Notion REST API v1, Claude Code CLI (print mode).

**No test framework.** Verification is `npm run check` + manual browser smoke (Task 13). Same convention as Phase 1.

**Spec:** `docs/superpowers/specs/2026-05-27-meetings-summary-design.md`

**Branch context:** Work happens on `feature/my-manager-tab` (Phase 1 branch — not yet merged to main). Phase 2 commits stack on top.

---

## File map

**Created:**
- `src/lib/meetingsCache.ts` — pure file I/O (read/write/clear per-week JSON cache)
- `src/lib/api/notion.ts` — `fetchMeetingsForWeek(config, weekStart)`
- `src/lib/api/claudeCli.ts` — `runClaudePrompt(claudeCfg, system, user)`
- `src/lib/api/meetingsSummary.ts` — orchestrator: `getMeetingsSummary(config, week)`, `regenerateMeetingsSummary(config, week)`
- `src/lib/components/MeetingsSummaryBlock.svelte`
- `src/routes/api/meetings/regenerate/+server.ts`

**Modified:**
- `src/lib/types.ts` — `MeetingNote`, `MeetingsSummary`
- `src/lib/config.ts` — parse `notion:` + `claudeCli:`; expose `notion`, `notionConfigured`, `claudeCli`
- `src/routes/+page.server.ts` — add `streamed.meetingsSummary` + `notionConfigured`
- `src/lib/components/WeeklyUpdateCard.svelte` — render `<MeetingsSummaryBlock>` at bottom
- `settings.yml.example` — document `notion:` + `claudeCli:` blocks
- `.env.example` — document `NOTION_TOKEN`
- `.gitignore` — add `data/meeting-summaries/`

---

## Task 1: Types

**Files:**
- Modify: `src/lib/types.ts` (append)

- [ ] **Step 1: Append the new types**

Append at the END of `src/lib/types.ts`:

```ts
export interface MeetingNote {
	id: string;
	title: string;
	date: string;                  // ISO timestamp
	attendees: string[];
	notesPreview: string;          // ≤ 1500 chars, paragraph body of the Notion page
	notionUrl: string;
}

export interface MeetingsSummary {
	generatedAt: string;           // ISO timestamp of when synthesis ran
	isoWeekYear: number;
	isoWeekNumber: number;
	bullets: string[];             // one bullet per meeting
	meetingsCount: number;
	meetings: MeetingNote[];       // kept for Open-in-Notion links and Phase 3 reuse
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "Add types for meeting notes and weekly meetings summary"
```

---

## Task 2: ISO week cache file I/O

**Files:**
- Create: `src/lib/meetingsCache.ts`

- [ ] **Step 1: Create the file**

Write `src/lib/meetingsCache.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import type { IsoWeek } from './managerWeek';
import type { MeetingsSummary } from './types';

const CACHE_DIR = join(process.cwd(), 'data', 'meeting-summaries');

function cachePath(week: IsoWeek): string {
	const w = String(week.week).padStart(2, '0');
	return join(CACHE_DIR, `${week.year}-W${w}.json`);
}

export function readCache(week: IsoWeek): MeetingsSummary | null {
	const path = cachePath(week);
	if (!existsSync(path)) return null;
	try {
		const raw = readFileSync(path, 'utf-8');
		return JSON.parse(raw) as MeetingsSummary;
	} catch {
		return null;
	}
}

export function writeCache(week: IsoWeek, summary: MeetingsSummary): void {
	try {
		if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
		writeFileSync(cachePath(week), JSON.stringify(summary, null, 2), 'utf-8');
	} catch {
		// Cache write failures are non-fatal; next load will re-synthesize.
	}
}

export function clearCache(week: IsoWeek): void {
	const path = cachePath(week);
	if (existsSync(path)) {
		try {
			rmSync(path);
		} catch {
			// best-effort
		}
	}
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/meetingsCache.ts
git commit -m "Add per-ISO-week file cache for meetings summary"
```

---

## Task 3: Config — parse `notion:` and `claudeCli:` blocks

**Files:**
- Modify: `src/lib/config.ts`

- [ ] **Step 1: Extend `YamlSettings`**

In `src/lib/config.ts`, inside the `YamlSettings` interface (lines 10-70), add (alongside the other optional blocks):

```ts
	notion?: {
		meetingsDbId?: string;
	};
	claudeCli?: {
		binary?: string;
		model?: string;
	};
```

- [ ] **Step 2: Extend `DashboardConfig`**

In the `DashboardConfig` interface, add (near `confluence`):

```ts
	notion: {
		token: string;
		meetingsDbId: string;
	} | null;
	notionConfigured: boolean;
	claudeCli: {
		binary: string;
		model: string;
	};
```

- [ ] **Step 3: Wire into `getConfig`**

In `getConfig()`, after the existing `const teams = buildTeams(settings);` line, add:

```ts
	const notionDbId = settings.notion?.meetingsDbId;
	const notionToken = privateEnv.NOTION_TOKEN ?? '';
	if (notionDbId && !notionToken) {
		throw new Error('settings.yml: notion.meetingsDbId is set but NOTION_TOKEN is missing from .env');
	}
```

In the returned object (top-level), add (near `confluence:`):

```ts
		notion: notionDbId
			? { token: notionToken, meetingsDbId: notionDbId }
			: null,
		notionConfigured: !!notionDbId,
		claudeCli: {
			binary: settings.claudeCli?.binary ?? 'claude',
			model: settings.claudeCli?.model ?? 'claude-haiku-4-5'
		},
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts
git commit -m "Parse notion: and claudeCli: config blocks for meetings summary"
```

---

## Task 4: Document config in `settings.yml.example` + `.env.example` + `.gitignore`

**Files:**
- Modify: `settings.yml.example`
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: `settings.yml.example`**

Find the existing `# ─── My Manager tab ───` block (added in Phase 1). After it ends and BEFORE the `# ─── Slack ───` separator, insert:

```yaml
# ─── Notion (for meetings summary in My Manager tab) ──────────────────────────
# Optional: if you use Granola to take meeting notes and Granola is configured
# to sync those notes into a Notion database, the My Manager tab can render an
# LLM-summarized bullet list of this week's meetings.
# Requires NOTION_TOKEN in .env (Notion internal integration token).
# Omit this block to hide the meetings block.
# notion:
#   meetingsDbId: 00000000000000000000000000000000   # 32-char hex (Notion DB id)

# ─── Claude CLI (for meetings summary synthesis) ──────────────────────────────
# The dashboard shells out to your local Claude Code CLI to summarize meeting
# notes. Uses your existing subscription auth — no API key needed.
# claudeCli:
#   binary: claude                                    # CLI command (or absolute path)
#   model: claude-haiku-4-5                           # cheapest, fastest model
```

- [ ] **Step 2: `.env.example`**

Read `.env.example`. If it doesn't already mention Notion, append:

```
# Notion internal integration token (https://www.notion.so/profile/integrations)
# Required only if settings.yml has a notion: block configured.
NOTION_TOKEN=
```

- [ ] **Step 3: `.gitignore`**

Append to `.gitignore`:

```
data/meeting-summaries/
```

- [ ] **Step 4: Commit**

```bash
git add settings.yml.example .env.example .gitignore
git commit -m "Document Notion + Claude CLI config and ignore meetings cache"
```

---

## Task 5: Notion API client

**Files:**
- Create: `src/lib/api/notion.ts`

- [ ] **Step 1: Create the file**

Write `src/lib/api/notion.ts`:

```ts
import type { DashboardConfig } from '$lib/config';
import type { MeetingNote } from '$lib/types';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionTitleProp {
	type: 'title';
	title: Array<{ plain_text: string }>;
}

interface NotionDateProp {
	type: 'date';
	date: { start: string } | null;
}

interface NotionRichTextProp {
	type: 'rich_text';
	rich_text: Array<{ plain_text: string }>;
}

interface NotionMultiSelectProp {
	type: 'multi_select';
	multi_select: Array<{ name: string }>;
}

interface NotionPeopleProp {
	type: 'people';
	people: Array<{ name?: string }>;
}

type NotionProperty =
	| NotionTitleProp
	| NotionDateProp
	| NotionRichTextProp
	| NotionMultiSelectProp
	| NotionPeopleProp
	| { type: string };                            // catch-all for unhandled types

interface NotionPage {
	id: string;
	created_time: string;
	url: string;
	properties: Record<string, NotionProperty>;
}

interface NotionQueryResponse {
	results: NotionPage[];
}

interface NotionBlock {
	type: string;
	paragraph?: { rich_text: Array<{ plain_text: string }> };
	heading_1?: { rich_text: Array<{ plain_text: string }> };
	heading_2?: { rich_text: Array<{ plain_text: string }> };
	heading_3?: { rich_text: Array<{ plain_text: string }> };
	bulleted_list_item?: { rich_text: Array<{ plain_text: string }> };
	numbered_list_item?: { rich_text: Array<{ plain_text: string }> };
}

interface NotionBlocksResponse {
	results: NotionBlock[];
}

function authHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		'Notion-Version': NOTION_VERSION,
		'Content-Type': 'application/json'
	};
}

export async function fetchMeetingsForWeek(
	config: DashboardConfig,
	weekStart: Date
): Promise<MeetingNote[]> {
	if (!config.notion) return [];

	const queryUrl = `${NOTION_API}/databases/${config.notion.meetingsDbId}/query`;
	const queryBody = {
		filter: {
			timestamp: 'created_time',
			created_time: { on_or_after: weekStart.toISOString() }
		},
		sorts: [{ timestamp: 'created_time', direction: 'ascending' }]
	};

	const response = await fetch(queryUrl, {
		method: 'POST',
		headers: authHeaders(config.notion.token),
		body: JSON.stringify(queryBody)
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Notion query error ${response.status}: ${body}`);
	}

	const data: NotionQueryResponse = await response.json();

	// Fetch body blocks in parallel for each page; cap concurrency by relying on Promise.all (small N).
	return Promise.all(
		data.results.map((page) => buildMeetingNote(page, config.notion!.token))
	);
}

async function buildMeetingNote(page: NotionPage, token: string): Promise<MeetingNote> {
	const title = extractTitle(page) || '(untitled meeting)';
	const date = extractDate(page) ?? page.created_time;
	const attendees = extractAttendees(page);
	const notesPreview = await fetchPageNotesPreview(page.id, token);

	return {
		id: page.id,
		title,
		date,
		attendees,
		notesPreview,
		notionUrl: page.url
	};
}

function extractTitle(page: NotionPage): string {
	for (const prop of Object.values(page.properties)) {
		if (prop.type === 'title') {
			const titleProp = prop as NotionTitleProp;
			return titleProp.title.map((t) => t.plain_text).join('').trim();
		}
	}
	return '';
}

function extractDate(page: NotionPage): string | null {
	for (const [name, prop] of Object.entries(page.properties)) {
		if (prop.type === 'date' && name.toLowerCase() === 'date') {
			const dateProp = prop as NotionDateProp;
			return dateProp.date?.start ?? null;
		}
	}
	return null;
}

function extractAttendees(page: NotionPage): string[] {
	for (const [name, prop] of Object.entries(page.properties)) {
		if (name.toLowerCase() !== 'attendees') continue;
		if (prop.type === 'multi_select') {
			return (prop as NotionMultiSelectProp).multi_select.map((o) => o.name);
		}
		if (prop.type === 'people') {
			return (prop as NotionPeopleProp).people
				.map((p) => p.name)
				.filter((n): n is string => Boolean(n));
		}
		if (prop.type === 'rich_text') {
			const text = (prop as NotionRichTextProp).rich_text
				.map((t) => t.plain_text)
				.join('');
			return text
				.split(/[,;]+/)
				.map((s) => s.trim())
				.filter(Boolean);
		}
	}
	return [];
}

async function fetchPageNotesPreview(pageId: string, token: string): Promise<string> {
	const url = `${NOTION_API}/blocks/${pageId}/children?page_size=100`;
	const response = await fetch(url, { headers: authHeaders(token) });
	if (!response.ok) return '';

	const data: NotionBlocksResponse = await response.json();
	const text = data.results
		.map(blockToText)
		.filter(Boolean)
		.join('\n');

	return text.slice(0, 1500);
}

function blockToText(block: NotionBlock): string {
	const richText =
		block.paragraph?.rich_text ??
		block.heading_1?.rich_text ??
		block.heading_2?.rich_text ??
		block.heading_3?.rich_text ??
		block.bulleted_list_item?.rich_text ??
		block.numbered_list_item?.rich_text ??
		[];
	return richText.map((t) => t.plain_text).join('');
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/notion.ts
git commit -m "Add Notion API client for fetching weekly meeting notes"
```

---

## Task 6: Claude CLI helper

**Files:**
- Create: `src/lib/api/claudeCli.ts`

- [ ] **Step 1: Create the file**

Write `src/lib/api/claudeCli.ts`:

```ts
import { spawn } from 'child_process';

export interface ClaudeCliConfig {
	binary: string;
	model: string;
}

/**
 * Spawn `claude -p` with the given prompt and return stdout.
 * Throws if the process exits non-zero or if the binary is not found.
 */
export function runClaudePrompt(
	cfg: ClaudeCliConfig,
	systemPrompt: string,
	userPrompt: string
): Promise<string> {
	return new Promise((resolve, reject) => {
		const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
		const child = spawn(cfg.binary, ['-p', combinedPrompt, '--model', cfg.model], {
			env: process.env
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf-8');
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString('utf-8');
		});

		child.on('error', (err) => {
			reject(new Error(`Failed to spawn '${cfg.binary}': ${err.message}`));
		});

		child.on('close', (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new Error(`'${cfg.binary} -p' exited with code ${code}: ${stderr.trim() || '(no stderr)'}`));
			}
		});
	});
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/claudeCli.ts
git commit -m "Add Claude Code CLI helper for prompt-mode synthesis"
```

---

## Task 7: Meetings summary orchestrator

**Files:**
- Create: `src/lib/api/meetingsSummary.ts`

- [ ] **Step 1: Create the file**

Write `src/lib/api/meetingsSummary.ts`:

```ts
import type { DashboardConfig } from '$lib/config';
import type { IsoWeek } from '$lib/managerWeek';
import { formatIsoWeekLabel } from '$lib/managerWeek';
import type { MeetingNote, MeetingsSummary } from '$lib/types';
import { fetchMeetingsForWeek } from './notion';
import { runClaudePrompt } from './claudeCli';
import { readCache, writeCache, clearCache } from '$lib/meetingsCache';

const SYSTEM_PROMPT = `You are summarizing a user's meetings this week for their manager.
Output one bullet per meeting in the order given. Choose the most natural
phrasing per bullet — past tense, third person. Each bullet should convey:
who was met with and what was discussed.
Keep bullets concise (one line each, ~15 words max).
Output only the bullets, one per line, each starting with "- ".
No preamble, no commentary, no summary line.`;

function buildUserPrompt(week: IsoWeek, meetings: MeetingNote[]): string {
	const lines: string[] = [];
	lines.push(`Week of ${formatIsoWeekLabel(week)}.`);
	lines.push('');
	meetings.forEach((m, i) => {
		const attendees = m.attendees.length > 0 ? m.attendees.join(', ') : '(unknown)';
		const notes = m.notesPreview.slice(0, 500);
		lines.push(`[Meeting ${i + 1}]`);
		lines.push(`Title: ${m.title}`);
		lines.push(`Date: ${m.date}`);
		lines.push(`Attendees: ${attendees}`);
		lines.push(`Notes: ${notes}`);
		lines.push('');
	});
	return lines.join('\n');
}

function parseBullets(output: string): string[] {
	return output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.startsWith('- '))
		.map((line) => line.slice(2).trim())
		.filter(Boolean);
}

async function buildSummary(
	config: DashboardConfig,
	week: IsoWeek
): Promise<MeetingsSummary> {
	const meetings = await fetchMeetingsForWeek(config, week.start);

	if (meetings.length === 0) {
		return {
			generatedAt: new Date().toISOString(),
			isoWeekYear: week.year,
			isoWeekNumber: week.week,
			bullets: [],
			meetingsCount: 0,
			meetings: []
		};
	}

	const userPrompt = buildUserPrompt(week, meetings);
	const output = await runClaudePrompt(config.claudeCli, SYSTEM_PROMPT, userPrompt);
	const bullets = parseBullets(output);

	return {
		generatedAt: new Date().toISOString(),
		isoWeekYear: week.year,
		isoWeekNumber: week.week,
		bullets,
		meetingsCount: meetings.length,
		meetings
	};
}

export async function getMeetingsSummary(
	config: DashboardConfig,
	week: IsoWeek
): Promise<MeetingsSummary> {
	const cached = readCache(week);
	if (cached) return cached;

	const summary = await buildSummary(config, week);
	writeCache(week, summary);
	return summary;
}

export async function regenerateMeetingsSummary(
	config: DashboardConfig,
	week: IsoWeek
): Promise<MeetingsSummary> {
	clearCache(week);
	const summary = await buildSummary(config, week);
	writeCache(week, summary);
	return summary;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/meetingsSummary.ts
git commit -m "Add meetings summary orchestrator (cache + Notion + Claude CLI)"
```

---

## Task 8: Wire `streamed.meetingsSummary` in the server load

**Files:**
- Modify: `src/routes/+page.server.ts`

- [ ] **Step 1: Add imports**

Near the existing `$lib/api/*` imports at the top of `src/routes/+page.server.ts`, add:

```ts
import { getMeetingsSummary } from '$lib/api/meetingsSummary';
```

In the existing `import type { ... } from '$lib/types'` block, add `MeetingsSummary`:

```ts
import type {
	ConfluenceStarredPage,
	DashboardRow,
	GitLabMR,
	ReviewItem,
	ReviewsData,
	SlackTodo,
	UnifiedPR,
	WeeklyTeamActivity,
	WeeklyTeamResult,
	MeetingsSummary
} from '$lib/types';
```

(If `MeetingsSummary` is already in the import list because another task added it, leave it.)

- [ ] **Step 2: Add the meetings summary stream**

Inside `export const load`, AFTER the existing `weekly` IIFE block and BEFORE the `return { ... }` statement, add:

```ts
	const meetingsSummary: Promise<ApiResult<MeetingsSummary | null>> = config.notionConfigured
		? resilient(getMeetingsSummary(config, week))
		: Promise.resolve({ data: null, error: null } as ApiResult<MeetingsSummary | null>);
```

Note: `week` was declared earlier in the load function for the weekly stream — reuse it (do NOT declare a second copy).

- [ ] **Step 3: Expose `notionConfigured` and `streamed.meetingsSummary`**

In the returned object, add `notionConfigured: config.notionConfigured,` near `managerConfigured: config.managerConfigured,`. Inside the `streamed:` block, add `meetingsSummary` after `weekly`:

```ts
		streamed: {
			jiraStatus,
			gitlabStatus,
			githubStatus,
			gitlabVpnError,
			rows,
			reviews,
			slackTodos,
			docsReviews,
			weekly,
			meetingsSummary,
			jiraStatuses: jiraStatusesPromise
		}
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.server.ts
git commit -m "Stream meetings summary from server load"
```

---

## Task 9: `MeetingsSummaryBlock` component

**Files:**
- Create: `src/lib/components/MeetingsSummaryBlock.svelte`

- [ ] **Step 1: Create the component**

Write `src/lib/components/MeetingsSummaryBlock.svelte`:

```svelte
<script lang="ts">
	import type { MeetingsSummary } from '$lib/types';

	interface Props {
		initial: MeetingsSummary | null;
		error: string | null;
	}

	let { initial, error: initialError }: Props = $props();

	let summary = $state<MeetingsSummary | null>(initial);
	let error = $state<string | null>(initialError);
	let regenerating = $state(false);

	async function regenerate() {
		regenerating = true;
		error = null;
		try {
			const r = await fetch('/api/meetings/regenerate', { method: 'POST' });
			if (!r.ok) {
				const text = await r.text().catch(() => '');
				throw new Error(`HTTP ${r.status}: ${text || 'regenerate failed'}`);
			}
			const next: MeetingsSummary = await r.json();
			summary = next;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			regenerating = false;
		}
	}

	function openLink(url: string) {
		window.open(url, '_blank', 'noopener');
	}
</script>

<section class="meetings-block">
	<header class="meetings-header">
		<h3>Meetings this week</h3>
		<button
			class="regen-btn"
			onclick={regenerate}
			disabled={regenerating}
			aria-label="Regenerate meetings summary"
		>
			{regenerating ? 'Regenerating…' : 'Regenerate'}
		</button>
	</header>

	{#if error}
		<div class="meetings-error">Failed to summarize meetings: {error}</div>
		{#if summary && summary.meetings.length > 0}
			<ul class="fallback-titles">
				{#each summary.meetings as m (m.id)}
					<li>
						<button class="link" onclick={() => openLink(m.notionUrl)}>{m.title}</button>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if !summary || summary.meetingsCount === 0}
		<div class="meetings-empty">No meetings recorded this week.</div>
	{:else}
		<ul class="bullets">
			{#each summary.bullets as bullet, i (i)}
				<li>{bullet}</li>
			{/each}
		</ul>
		{#if summary.meetings.length > 0}
			<details class="sources">
				<summary>Source meetings ({summary.meetings.length})</summary>
				<ul>
					{#each summary.meetings as m (m.id)}
						<li>
							<button class="link" onclick={() => openLink(m.notionUrl)}>{m.title}</button>
							{#if m.attendees.length > 0}
								<span class="who"> · {m.attendees.join(', ')}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
</section>

<style>
	.meetings-block {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-surface);
		margin: 0 16px 16px;
	}

	.meetings-header {
		padding: 12px 16px;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid var(--color-border);
	}

	.meetings-header h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.regen-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 4px 10px;
		font: inherit;
		font-size: 11px;
		color: var(--color-text);
		cursor: pointer;
	}

	.regen-btn:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.regen-btn:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.bullets {
		list-style: disc;
		margin: 0;
		padding: 12px 16px 12px 32px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.bullets li {
		font-size: 13px;
		line-height: 1.4;
	}

	.meetings-empty,
	.meetings-error {
		padding: 16px;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.meetings-error {
		color: var(--color-danger);
		font-family: monospace;
	}

	.sources {
		padding: 4px 16px 12px;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.sources summary {
		cursor: pointer;
		padding: 4px 0;
	}

	.sources ul {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--color-primary);
		cursor: pointer;
	}

	.link:hover {
		text-decoration: underline;
	}

	.who {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.fallback-titles {
		list-style: disc;
		margin: 0;
		padding: 8px 16px 12px 32px;
		font-size: 12px;
		color: var(--color-text-muted);
	}
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/MeetingsSummaryBlock.svelte
git commit -m "Add MeetingsSummaryBlock component with Regenerate button"
```

---

## Task 10: Regenerate endpoint

**Files:**
- Create: `src/routes/api/meetings/regenerate/+server.ts`

- [ ] **Step 1: Create the endpoint**

Write `src/routes/api/meetings/regenerate/+server.ts`:

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig } from '$lib/config';
import { getCurrentIsoWeek } from '$lib/managerWeek';
import { regenerateMeetingsSummary } from '$lib/api/meetingsSummary';

export const POST: RequestHandler = async () => {
	const config = getConfig();
	if (!config.notionConfigured) {
		throw error(400, 'Notion is not configured in settings.yml');
	}

	const week = getCurrentIsoWeek();
	try {
		const summary = await regenerateMeetingsSummary(config, week);
		return json(summary);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, message);
	}
};
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/meetings/regenerate/+server.ts
git commit -m "Add POST /api/meetings/regenerate endpoint"
```

---

## Task 11: Wire `MeetingsSummaryBlock` into `WeeklyUpdateCard`

**Files:**
- Modify: `src/lib/components/WeeklyUpdateCard.svelte`

- [ ] **Step 1: Import the block and accept new props**

Replace the entire content of `src/lib/components/WeeklyUpdateCard.svelte` with:

```svelte
<script lang="ts">
	import TeamWeeklySection from './TeamWeeklySection.svelte';
	import MeetingsSummaryBlock from './MeetingsSummaryBlock.svelte';
	import { formatIsoWeekLabel } from '$lib/managerWeek';
	import type { IsoWeek } from '$lib/managerWeek';
	import type { WeeklyTeamResult, MeetingsSummary } from '$lib/types';

	interface Props {
		week: IsoWeek;
		teams: WeeklyTeamResult[];
		meetings?: { data: MeetingsSummary | null; error: string | null };
	}

	let { week, teams, meetings }: Props = $props();
</script>

<div class="card">
	<header class="card-header">
		<h2>Weekly Update</h2>
		<span class="card-subtitle">{formatIsoWeekLabel(week)}</span>
	</header>

	{#if teams.length === 0}
		<div class="empty">No teams configured. Add a `teams:` block to settings.yml.</div>
	{:else}
		<div class="teams">
			{#each teams as t (t.name)}
				<TeamWeeklySection
					teamName={t.name}
					activity={t.activity.data}
					error={t.activity.error}
					{week}
				/>
			{/each}
		</div>
	{/if}

	{#if meetings && (meetings.data !== null || meetings.error !== null)}
		<MeetingsSummaryBlock initial={meetings.data} error={meetings.error} />
	{/if}
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.card-header {
		padding: 12px 16px;
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}

	.card-header h2 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.card-subtitle {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.teams {
		display: flex;
		flex-direction: column;
		padding: 0 16px 16px;
	}

	.empty {
		padding: 24px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: 12px;
	}
</style>
```

The `meetings` prop is optional. The block is hidden when `meetings.data === null && meetings.error === null` (Notion not configured) or when the entire prop is undefined (defensive).

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/WeeklyUpdateCard.svelte
git commit -m "Render MeetingsSummaryBlock inside WeeklyUpdateCard"
```

---

## Task 12: Pass `meetings` from the page to the card

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Update the `manager` tab branch to pass the new prop**

Find the existing `{:else if active === 'manager'}` block. Replace it with:

```svelte
		{:else if active === 'manager'}
			{#await Promise.all([data.streamed.weekly, data.streamed.meetingsSummary])}
				<div class="panel-loading">Loading weekly update…</div>
			{:then [weeklyResult, meetingsResult]}
				<WeeklyUpdateCard
					week={weeklyResult.week}
					teams={weeklyResult.teams}
					meetings={meetingsResult}
				/>
			{/await}
```

Note: We `Promise.all` the two streams so the card renders only when both have resolved. Each individual stream is still `resilient`-wrapped server-side, so per-source errors are surfaced as `error` strings, not thrown.

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "Pass meetings summary stream into WeeklyUpdateCard"
```

---

## Task 13: Manual smoke test

**Files:** none modified unless issues are found.

- [ ] **Step 1: Confirm prerequisites are in place**

Before testing, manually verify:
- `settings.yml` has a `notion:` block with the real `meetingsDbId` (Granola's destination database)
- `.env` has `NOTION_TOKEN=secret_...` (your Notion internal integration token)
- The Notion DB is shared with the integration
- Granola has at least one synced meeting note in that DB for this week (if no meetings exist, the "No meetings recorded this week" empty state is what you should see)
- `claude` is on `$PATH`: run `which claude` — should print a path

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: server starts at http://localhost:5173.

- [ ] **Step 3: Verify in the browser**

Open http://localhost:5173 and:

1. Click the "My Manager" tab.
2. Wait for the page to finish loading (first load synthesizes — may take 5-15s for the Claude call).
3. Below the team sections, confirm a "Meetings this week" block appears.
4. If you have meetings in Notion for the current week: a bullet list renders (one per meeting), plus a collapsed `<details>` "Source meetings (N)" listing the titles + attendees with click-through to Notion.
5. If you have no meetings yet: the empty placeholder "No meetings recorded this week." shows instead.
6. Click "Regenerate." Button text changes to "Regenerating…" and is disabled. After 5-15s, bullets refresh (may be identical content if meetings haven't changed).
7. Open browser DevTools → check the request to `/api/meetings/regenerate` returns 200 with a `MeetingsSummary` JSON body.
8. Confirm the cache file landed: `ls data/meeting-summaries/` — there should be a file like `2026-W22.json`.
9. Refresh the page. The Meetings block renders nearly instantly (cache hit).

- [ ] **Step 4: Error-path checks (optional but recommended)**

- Temporarily set `NOTION_TOKEN=invalid` in `.env`, restart dev server. Click the Manager tab — meetings block should show the red error message (e.g. `Failed to summarize meetings: Notion query error 401: ...`). Team sections should still render normally.
- Restore the token.

- [ ] **Step 5: If any tweaks were made, commit them**

```bash
git add -A
git commit -m "Polish meetings summary after smoke test"
```

If nothing changed, skip the commit.

---

## Self-review notes

**Spec coverage (each spec section → task):**
- Pipeline (Granola → Notion → Dashboard → Claude → cache → render) → Tasks 5, 6, 7, 8, 9 collectively
- Scope (single global block, no per-team tagging) → Task 11 placement
- Config (`notion:`, `claudeCli:`, `NOTION_TOKEN`, `data/meeting-summaries/` gitignore) → Tasks 3, 4
- ISO week boundary reuse → Task 7 imports `getCurrentIsoWeek` / `IsoWeek` from Phase 1's `managerWeek.ts`
- Notion query filter + per-row extraction (title, date, attendees, body preview) → Task 5
- Claude prompt (SYSTEM + USER, ~500 char per meeting note) → Task 7
- Result type (`MeetingsSummary`) + per-week cache file → Tasks 1, 2
- Regenerate flow → Task 10 endpoint + Task 9 component button
- Error isolation (Notion fail, Claude fail, empty meetings) → Task 9 render branches
- Hide block when Notion not configured → Task 11 prop check
- `.gitignore` for `data/meeting-summaries/` → Task 4

**Deliberately not in this plan (deferred):**
- Property-name override in `notion:` config (e.g. let user say "use 'Participants' instead of 'Attendees'"). Granola's defaults are assumed; if the user's DB diverges, attendees will be `[]` and we'll surface a generic empty state. Will revisit if it bites in practice.
- Old cache file garbage collection. Acceptable accumulation for personal use.
- Phase 3 (full draft + Confluence) — separate plan.
