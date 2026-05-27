# My Manager Tab — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "My Manager" tab to the dashboard whose first card ("Weekly Update") renders this ISO week's activity for two teams: Design System (auto-pulled from Jira + GitLab/GitHub) and Reporting (manual notes only).

**Architecture:** Extends the existing streamed-SSR pattern: a new `teams:` config block, a per-team weekly fetcher that returns Jira buckets + PR buckets, a new tab branch in `+page.svelte`, and three new Svelte components. Each team is independently fetched with `resilient(...)` so one team's failure doesn't take out the other. Notes persist to `localStorage` keyed by team + ISO week.

**Tech Stack:** SvelteKit 2, Svelte 5 ($state/$props/$effect runes), TypeScript, server-side `fetch` against Jira REST `/rest/api/3/search/jql`, GitLab `/api/v4`, GitHub REST.

**No test framework.** The project has no vitest/jest setup — verification is `npm run check` (svelte-check + tsc) plus manual browser smoke tests in the dev server. Each task ends with both. This follows the project's existing convention; adding a test framework is out of scope.

**Spec:** `docs/superpowers/specs/2026-05-26-my-manager-tab-design.md`

---

## File map

**Created:**
- `src/lib/managerWeek.ts` — pure ISO-week utilities (no I/O, no Svelte deps)
- `src/lib/api/managerWeekly.ts` — `fetchWeeklyActivityForTeam(config, team, weekStart, weekEnd)`
- `src/lib/components/NotesEditor.svelte` — textarea + debounced localStorage
- `src/lib/components/TeamWeeklySection.svelte` — renders one team's section
- `src/lib/components/WeeklyUpdateCard.svelte` — top-level card, iterates teams

**Modified:**
- `src/lib/types.ts` — add `TeamConfig`, `WeeklyTeamActivity`, related types
- `src/lib/config.ts` — parse `teams:` block, expose `config.teams` + `config.managerConfigured`
- `src/routes/+page.server.ts` — add `streamed.weekly` promise
- `src/routes/+page.svelte` — add `manager` tab to nav + branch
- `settings.yml.example` — document the `teams:` block

---

## Task 1: ISO week utilities

**Files:**
- Create: `src/lib/managerWeek.ts`

- [ ] **Step 1: Create the file with utilities**

Write `src/lib/managerWeek.ts`:

```ts
export interface IsoWeek {
	year: number;        // ISO week-numbering year (may differ from calendar year near Jan 1 / Dec 31)
	week: number;        // 1-53
	start: Date;         // Monday 00:00:00.000 local time
	end: Date;           // Sunday 23:59:59.999 local time
}

/**
 * Returns the ISO week that `now` falls within, with Mon..Sun bounds in local time.
 * ISO 8601: weeks start on Monday; week 1 is the week containing the first Thursday of the year.
 */
export function getCurrentIsoWeek(now: Date = new Date()): IsoWeek {
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	const dayOfWeek = (start.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
	start.setDate(start.getDate() - dayOfWeek);

	const end = new Date(start);
	end.setDate(end.getDate() + 6);
	end.setHours(23, 59, 59, 999);

	// ISO week-numbering: copy date, shift to Thursday of the same ISO week, then number from Jan 4.
	const target = new Date(start);
	target.setDate(target.getDate() + 3); // Monday + 3 = Thursday
	const firstThursday = new Date(target.getFullYear(), 0, 4);
	const diffDays = Math.round((target.getTime() - firstThursday.getTime()) / 86400000);
	const week = 1 + Math.floor((diffDays + ((firstThursday.getDay() + 6) % 7)) / 7);
	const year = target.getFullYear();

	return { year, week, start, end };
}

export function formatIsoWeekLabel(w: IsoWeek): string {
	const fmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
	const startStr = w.start.toLocaleDateString(undefined, fmt);
	const endStr = w.end.toLocaleDateString(undefined, fmt);
	return `${startStr} – ${endStr} (W${String(w.week).padStart(2, '0')})`;
}

export function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function notesStorageKey(teamName: string, w: IsoWeek): string {
	return `weekly-notes-${slugify(teamName)}-${w.year}-W${String(w.week).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/managerWeek.ts
git commit -m "Add ISO week utilities for weekly update card"
```

---

## Task 2: Type definitions

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Append new types**

Add to the end of `src/lib/types.ts`:

```ts
export interface TeamConfig {
	name: string;
	jiraProjectKeys: string[];        // empty array → no auto-pull
	members: TeamMember[];            // empty array → no auto-pull
}

export interface WeeklyJiraTicket {
	key: string;
	summary: string;
	status: string;
	statusCategory: 'To Do' | 'In Progress' | 'Done' | 'Other';
	assigneeName: string | null;
	updated: string;                  // ISO timestamp
	url: string;
}

export interface WeeklyPR {
	source: 'gitlab' | 'github';
	id: number;
	title: string;
	authorUsername: string;
	state: 'merged' | 'opened' | 'updated';   // bucket the PR falls in for the week
	webUrl: string;
	repo: string;                              // gitlab.repo or owner/name
	mergedAt: string | null;
	updatedAt: string;
}

export interface WeeklyTeamActivity {
	teamName: string;
	autoPull: boolean;                         // false if jiraProjectKeys empty
	jira: {
		done: WeeklyJiraTicket[];
		inFlight: WeeklyJiraTicket[];
		started: WeeklyJiraTicket[];
	} | null;
	prs: {
		merged: WeeklyPR[];
		opened: WeeklyPR[];
		updated: WeeklyPR[];
	} | null;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "Add types for weekly team activity"
```

---

## Task 3: Config — parse the new `teams:` block

**Files:**
- Modify: `src/lib/config.ts`

- [ ] **Step 1: Extend `YamlSettings` and `DashboardConfig`**

In `src/lib/config.ts`, find the `YamlSettings` interface (lines 10-65) and add inside it (next to `team?:`):

```ts
	teams?: Array<{
		name?: string;
		jiraProjectKeys?: string[];
		members?: TeamMember[];
	}>;
```

In the same file, find the `DashboardConfig` interface (lines 84-145) and add (next to `team:`):

```ts
	teams: TeamConfig[];
	managerConfigured: boolean;
```

Update the import at the top of the file to include `TeamConfig`:

```ts
import type { TeamMember, TeamConfig } from '$lib/types';
```

- [ ] **Step 2: Add a `buildTeams` helper**

Add this function in `src/lib/config.ts` right after `buildTeam` (around line 156):

```ts
function buildTeams(settings: YamlSettings): TeamConfig[] {
	if (!settings.teams || settings.teams.length === 0) return [];
	return settings.teams
		.filter((t) => t.name)
		.map((t) => ({
			name: t.name!,
			jiraProjectKeys: t.jiraProjectKeys ?? [],
			members: t.members ?? []
		}));
}
```

- [ ] **Step 3: Wire it into `getConfig`**

In `getConfig` (around line 158-227), add these two properties to the returned object (place them near `team: buildTeam(settings)`):

```ts
		teams: buildTeams(settings),
		managerConfigured: (settings.teams ?? []).length > 0,
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts
git commit -m "Parse teams: config block for My Manager tab"
```

---

## Task 4: Settings example

**Files:**
- Modify: `settings.yml.example`

- [ ] **Step 1: Add a documented `teams:` block**

In `settings.yml.example`, after the existing `# team:` section (around line 50) and before the `# ─── Slack ───` separator, insert:

```yaml
# ─── My Manager tab ──────────────────────────────────────────────────────────
# Optional: define one or more teams you manage. The "My Manager" tab renders
# a Weekly Update card with one section per team. Each team can be either
# auto-pulled (Jira tickets + MRs/PRs for the current ISO week) or manual
# notes only.
#
# AUTO-PULL: set `jiraProjectKeys` AND list members with the relevant
# identities (jiraEmail for Jira, gitlabAuthorUsername for GitLab MRs,
# githubAuthorUsername for GitHub PRs).
#
# MANUAL ONLY: omit `jiraProjectKeys`. The section renders just a notes
# textarea (persisted in your browser's localStorage per ISO week).
#
# Omit this whole block to hide the tab.
#
# teams:
#   - name: Design System
#     jiraProjectKeys: [DSTM, GDSP]
#     members:
#       - name: Your Name
#         jiraEmail: you@company.com
#         gitlabAuthorUsername: your.username
#         githubAuthorUsername: your-gh
#       - name: Teammate
#         jiraEmail: teammate@company.com
#         gitlabAuthorUsername: teammate.gitlab
#   - name: Reporting
#     # no jiraProjectKeys, no members → manual notes only
```

- [ ] **Step 2: Commit**

```bash
git add settings.yml.example
git commit -m "Document teams: config block in settings example"
```

---

## Task 5: Per-team Jira fetcher

**Files:**
- Create: `src/lib/api/managerWeekly.ts`

- [ ] **Step 1: Create the file with Jira fetching only**

Write `src/lib/api/managerWeekly.ts`:

```ts
import type { DashboardConfig } from '$lib/config';
import type {
	TeamConfig,
	WeeklyJiraTicket,
	WeeklyPR,
	WeeklyTeamActivity
} from '$lib/types';

const DONE_STATUS_NAMES = ['done', 'closed', 'resolved'];

interface JiraSearchResponse {
	issues: Array<{
		key: string;
		fields: {
			summary: string;
			updated: string;
			status: {
				name: string;
				statusCategory: { key: string; name: string };
			};
			assignee: { displayName: string } | null;
		};
		changelog?: {
			histories: Array<{
				created: string;
				items: Array<{
					field: string;
					fromString: string | null;
					toString: string | null;
				}>;
			}>;
		};
	}>;
}

function jiraStatusCategory(name: string): WeeklyJiraTicket['statusCategory'] {
	const n = name.toLowerCase();
	if (n === 'done') return 'Done';
	if (n === 'in progress') return 'In Progress';
	if (n === 'to do' || n === 'new') return 'To Do';
	return 'Other';
}

function isDone(statusName: string, statusCategoryName: string): boolean {
	if (statusCategoryName.toLowerCase() === 'done') return true;
	return DONE_STATUS_NAMES.includes(statusName.toLowerCase());
}

async function fetchTeamJira(
	config: DashboardConfig,
	team: TeamConfig,
	weekStart: Date
): Promise<WeeklyTeamActivity['jira']> {
	const emails = team.members
		.map((m) => m.jiraEmail)
		.filter(Boolean) as string[];
	if (emails.length === 0) return { done: [], inFlight: [], started: [] };

	const projectClause = team.jiraProjectKeys.map((k) => `"${k}"`).join(', ');
	const assigneeClause = emails.map((e) => `"${e}"`).join(', ');
	const isoStart = weekStart.toISOString().slice(0, 10); // YYYY-MM-DD
	const jql = `project IN (${projectClause}) AND assignee IN (${assigneeClause}) AND updated >= "${isoStart}"`;
	const fields = 'key,summary,status,updated,assignee';
	const url = `${config.jira.baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields}&expand=changelog`;

	const credentials = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
	const response = await fetch(url, {
		headers: {
			Authorization: `Basic ${credentials}`,
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Jira API error ${response.status}: ${body}`);
	}

	const data: JiraSearchResponse = await response.json();

	const done: WeeklyJiraTicket[] = [];
	const inFlight: WeeklyJiraTicket[] = [];
	const started: WeeklyJiraTicket[] = [];

	for (const issue of data.issues) {
		const ticket: WeeklyJiraTicket = {
			key: issue.key,
			summary: issue.fields.summary,
			status: issue.fields.status.name,
			statusCategory: jiraStatusCategory(issue.fields.status.statusCategory.name),
			assigneeName: issue.fields.assignee?.displayName ?? null,
			updated: issue.fields.updated,
			url: `${config.jira.baseUrl}/browse/${issue.key}`
		};

		const isTicketDone = isDone(ticket.status, issue.fields.status.statusCategory.name);
		const startedThisWeek = transitionedFromToDoThisWeek(issue.changelog?.histories ?? [], weekStart);

		if (isTicketDone) {
			done.push(ticket);
		} else if (startedThisWeek) {
			started.push(ticket);
		} else {
			inFlight.push(ticket);
		}
	}

	return { done, inFlight, started };
}

function transitionedFromToDoThisWeek(
	histories: Array<{
		created: string;
		items: Array<{ field: string; fromString: string | null; toString: string | null }>;
	}>,
	weekStart: Date
): boolean {
	const startMs = weekStart.getTime();
	for (const h of histories) {
		if (new Date(h.created).getTime() < startMs) continue;
		for (const item of h.items) {
			if (item.field !== 'status') continue;
			const from = (item.fromString ?? '').toLowerCase();
			const to = (item.toString ?? '').toLowerCase();
			if ((from === 'to do' || from === 'new' || from === 'backlog') && to !== from) {
				return true;
			}
		}
	}
	return false;
}

export async function fetchWeeklyActivityForTeam(
	config: DashboardConfig,
	team: TeamConfig,
	weekStart: Date,
	_weekEnd: Date
): Promise<WeeklyTeamActivity> {
	const autoPull = team.jiraProjectKeys.length > 0 && team.members.length > 0;
	if (!autoPull) {
		return { teamName: team.name, autoPull: false, jira: null, prs: null };
	}

	const jira = await fetchTeamJira(config, team, weekStart);
	// PRs are added in the next task.
	const prs: WeeklyTeamActivity['prs'] = { merged: [], opened: [], updated: [] };
	return { teamName: team.name, autoPull: true, jira, prs };
}

// Re-exported here so callers don't need to import directly:
export type { WeeklyTeamActivity, WeeklyJiraTicket, WeeklyPR };
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/managerWeekly.ts
git commit -m "Add per-team Jira weekly fetcher"
```

---

## Task 6: Add GitLab + GitHub PR fetching to managerWeekly

**Files:**
- Modify: `src/lib/api/managerWeekly.ts`

- [ ] **Step 1: Add PR fetcher helpers**

In `src/lib/api/managerWeekly.ts`, insert these helpers above the existing `export async function fetchWeeklyActivityForTeam`:

```ts
interface GitLabMRResponse {
	iid: number;
	title: string;
	state: 'opened' | 'merged' | 'closed';
	web_url: string;
	author: { username: string };
	created_at: string;
	updated_at: string;
	merged_at: string | null;
}

async function fetchTeamGitLabPRs(
	config: DashboardConfig,
	team: TeamConfig,
	weekStart: Date
): Promise<WeeklyPR[]> {
	const usernames = team.members
		.map((m) => m.gitlabAuthorUsername)
		.filter(Boolean) as string[];
	if (usernames.length === 0) return [];

	const headers = { 'PRIVATE-TOKEN': config.gitlab.token };
	const baseUrl = `${config.gitlab.baseUrl}/api/v4/projects/${config.gitlab.projectId}/merge_requests`;
	const isoStart = weekStart.toISOString(); // GitLab accepts ISO 8601

	const perUser = await Promise.all(
		usernames.map(async (u) => {
			const url = `${baseUrl}?author_username=${encodeURIComponent(u)}&updated_after=${encodeURIComponent(isoStart)}&per_page=100`;
			const r = await fetch(url, { headers });
			if (!r.ok) {
				const body = await r.text().catch(() => '');
				throw new Error(`GitLab MR fetch error ${r.status}: ${body}`);
			}
			const mrs: GitLabMRResponse[] = await r.json();
			return mrs;
		})
	);

	const seen = new Set<number>();
	const out: WeeklyPR[] = [];
	for (const mr of perUser.flat()) {
		if (seen.has(mr.iid)) continue;
		seen.add(mr.iid);
		out.push({
			source: 'gitlab',
			id: mr.iid,
			title: mr.title,
			authorUsername: mr.author.username,
			state: bucketForGitLab(mr, weekStart),
			webUrl: mr.web_url,
			repo: config.gitlab.repo,
			mergedAt: mr.merged_at,
			updatedAt: mr.updated_at
		});
	}
	return out;
}

function bucketForGitLab(mr: GitLabMRResponse, weekStart: Date): WeeklyPR['state'] {
	const startMs = weekStart.getTime();
	if (mr.merged_at && new Date(mr.merged_at).getTime() >= startMs) return 'merged';
	if (new Date(mr.created_at).getTime() >= startMs) return 'opened';
	return 'updated';
}

interface GitHubSearchPRResponse {
	number: number;
	title: string;
	html_url: string;
	user: { login: string };
	created_at: string;
	updated_at: string;
	pull_request: { merged_at: string | null };
}

async function fetchTeamGitHubPRs(
	config: DashboardConfig,
	team: TeamConfig,
	weekStart: Date
): Promise<WeeklyPR[]> {
	const usernames = team.members
		.map((m) => m.githubAuthorUsername)
		.filter(Boolean) as string[];
	if (usernames.length === 0 || config.github.length === 0) return [];

	const isoStart = weekStart.toISOString().slice(0, 10);

	// One search per (repo, user) — GitHub search does not reliably OR multiple
	// author: qualifiers, so we fan out and dedupe by PR number per repo.
	const perRepoUser = await Promise.all(
		config.github.flatMap((repo) =>
			usernames.map(async (username) => {
				const headers = {
					Authorization: `Bearer ${repo.token}`,
					Accept: 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28'
				};
				const repoSlug = `${repo.owner}/${repo.repo}`;
				const query = `is:pr repo:${repoSlug} author:${username} updated:>=${isoStart}`;
				const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=100`;

				const r = await fetch(url, { headers });
				if (!r.ok) {
					const body = await r.text().catch(() => '');
					throw new Error(`GitHub PR search error ${r.status}: ${body}`);
				}
				const data: { items: GitHubSearchPRResponse[] } = await r.json();

				return data.items
					.filter((it) => it.pull_request)
					.map((it): WeeklyPR => ({
						source: 'github',
						id: it.number,
						title: it.title,
						authorUsername: it.user.login,
						state: bucketForGitHub(it, weekStart),
						webUrl: it.html_url,
						repo: repoSlug,
						mergedAt: it.pull_request.merged_at,
						updatedAt: it.updated_at
					}));
			})
		)
	);

	// Dedupe by `${source}-${repo}-${id}` (different users can show the same PR if cross-author).
	const seen = new Set<string>();
	const out: WeeklyPR[] = [];
	for (const pr of perRepoUser.flat()) {
		const key = `${pr.source}-${pr.repo}-${pr.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(pr);
	}
	return out;
}

function bucketForGitHub(pr: GitHubSearchPRResponse, weekStart: Date): WeeklyPR['state'] {
	const startMs = weekStart.getTime();
	if (pr.pull_request.merged_at && new Date(pr.pull_request.merged_at).getTime() >= startMs) return 'merged';
	if (new Date(pr.created_at).getTime() >= startMs) return 'opened';
	return 'updated';
}

function bucketPRs(prs: WeeklyPR[]): WeeklyTeamActivity['prs'] {
	const out = { merged: [] as WeeklyPR[], opened: [] as WeeklyPR[], updated: [] as WeeklyPR[] };
	for (const pr of prs) out[pr.state].push(pr);
	return out;
}
```

- [ ] **Step 2: Wire the PR fetchers into `fetchWeeklyActivityForTeam`**

Replace the existing body of `fetchWeeklyActivityForTeam` so it looks like this:

```ts
export async function fetchWeeklyActivityForTeam(
	config: DashboardConfig,
	team: TeamConfig,
	weekStart: Date,
	_weekEnd: Date
): Promise<WeeklyTeamActivity> {
	const autoPull = team.jiraProjectKeys.length > 0 && team.members.length > 0;
	if (!autoPull) {
		return { teamName: team.name, autoPull: false, jira: null, prs: null };
	}

	const [jira, gitlabPRs, githubPRs] = await Promise.all([
		fetchTeamJira(config, team, weekStart),
		fetchTeamGitLabPRs(config, team, weekStart).catch(() => [] as WeeklyPR[]),
		fetchTeamGitHubPRs(config, team, weekStart).catch(() => [] as WeeklyPR[])
	]);

	return {
		teamName: team.name,
		autoPull: true,
		jira,
		prs: bucketPRs([...gitlabPRs, ...githubPRs])
	};
}
```

Note: Jira failures will still surface (no `.catch`); GitLab/GitHub failures degrade to empty arrays so a flaky single source doesn't kill the whole section.

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/managerWeekly.ts
git commit -m "Add GitLab + GitHub PR fetching to per-team weekly activity"
```

---

## Task 7: Wire `streamed.weekly` in the server load

**Files:**
- Modify: `src/routes/+page.server.ts`

- [ ] **Step 1: Add imports**

At the top of `src/routes/+page.server.ts`, alongside the existing imports, add:

```ts
import { fetchWeeklyActivityForTeam } from '$lib/api/managerWeekly';
import { getCurrentIsoWeek } from '$lib/managerWeek';
import type { IsoWeek } from '$lib/managerWeek';
import type { WeeklyTeamActivity } from '$lib/types';
```

- [ ] **Step 2: Add the weekly stream inside `load`**

Inside `export const load` (around line 75 onward), after the `docsReviews` promise (line 169-171) and before the `return {` block, add:

```ts
	const week: IsoWeek = getCurrentIsoWeek();

	type WeeklyTeamResult = { name: string; activity: ApiResult<WeeklyTeamActivity> };
	const weekly: Promise<{ week: IsoWeek; teams: WeeklyTeamResult[] }> = (async () => {
		const teams = await Promise.all(
			config.teams.map(async (team): Promise<WeeklyTeamResult> => {
				const activity = await resilient(
					fetchWeeklyActivityForTeam(config, team, week.start, week.end)
				);
				return { name: team.name, activity };
			})
		);
		return { week, teams };
	})();
```

- [ ] **Step 3: Expose `managerConfigured` and `streamed.weekly`**

In the returned object (line 173-192), add `managerConfigured: config.managerConfigured,` near `confluenceConfigured: ...`, and add `weekly` inside the `streamed:` block:

```ts
		managerConfigured: config.managerConfigured,
		...
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
			jiraStatuses: jiraStatusesPromise
		}
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.server.ts
git commit -m "Stream per-team weekly activity from server load"
```

---

## Task 8: `NotesEditor` component

**Files:**
- Create: `src/lib/components/NotesEditor.svelte`

- [ ] **Step 1: Create the component**

Write `src/lib/components/NotesEditor.svelte`:

```svelte
<script lang="ts">
	interface Props {
		storageKey: string;
		placeholder?: string;
	}

	let { storageKey, placeholder = 'Notes for this week…' }: Props = $props();

	let value = $state('');
	let loaded = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		// Re-load whenever storageKey changes (e.g. ISO week rolls over).
		if (typeof localStorage === 'undefined') return;
		try {
			value = localStorage.getItem(storageKey) ?? '';
		} catch {
			value = '';
		}
		loaded = true;
	});

	function persist() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(storageKey, value);
		} catch {}
	}

	function onInput() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(persist, 500);
	}
</script>

<div class="notes">
	<label class="notes-label" for={storageKey}>Notes</label>
	<textarea
		id={storageKey}
		class="notes-textarea"
		{placeholder}
		bind:value
		oninput={onInput}
		disabled={!loaded}
		rows="6"
	></textarea>
</div>

<style>
	.notes {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 16px;
	}

	.notes-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.notes-textarea {
		width: 100%;
		min-height: 96px;
		resize: vertical;
		padding: 8px 10px;
		font: inherit;
		font-size: 13px;
		color: var(--color-text);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		box-sizing: border-box;
	}

	.notes-textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/NotesEditor.svelte
git commit -m "Add NotesEditor component with debounced localStorage"
```

---

## Task 9: `TeamWeeklySection` component

**Files:**
- Create: `src/lib/components/TeamWeeklySection.svelte`

- [ ] **Step 1: Create the component**

Write `src/lib/components/TeamWeeklySection.svelte`:

```svelte
<script lang="ts">
	import NotesEditor from './NotesEditor.svelte';
	import type { WeeklyTeamActivity, WeeklyJiraTicket, WeeklyPR } from '$lib/types';
	import { notesStorageKey } from '$lib/managerWeek';
	import type { IsoWeek } from '$lib/managerWeek';

	interface Props {
		teamName: string;
		activity: WeeklyTeamActivity | null;   // null if the per-team fetch errored
		error: string | null;
		week: IsoWeek;
	}

	let { teamName, activity, error, week }: Props = $props();

	const storageKey = $derived(notesStorageKey(teamName, week));

	function openLink(url: string) {
		window.open(url, '_blank', 'noopener');
	}

	function isEmptyAuto(a: WeeklyTeamActivity): boolean {
		if (!a.autoPull) return false;
		const j = a.jira;
		const p = a.prs;
		if (!j || !p) return true;
		return (
			j.done.length + j.inFlight.length + j.started.length +
			p.merged.length + p.opened.length + p.updated.length === 0
		);
	}
</script>

<section class="team-section">
	<header class="team-header">
		<h3>{teamName}</h3>
	</header>

	{#if error}
		<div class="team-error">Failed to load activity: {error}</div>
	{:else if activity && activity.autoPull}
		{#if isEmptyAuto(activity)}
			<div class="team-empty">No tracked activity this week.</div>
		{:else}
			{@const jira = activity.jira!}
			{@const prs = activity.prs!}

			{#if jira.done.length > 0}
				<div class="bucket">
					<h4>Done this week</h4>
					<ul>
						{#each jira.done as t (t.key)}
							<li>
								<button class="link" onclick={() => openLink(t.url)}>{t.key}</button>
								— {t.summary}
								{#if t.assigneeName}<span class="who"> · {t.assigneeName}</span>{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if jira.inFlight.length > 0}
				<div class="bucket">
					<h4>In flight</h4>
					<ul>
						{#each jira.inFlight as t (t.key)}
							<li>
								<button class="link" onclick={() => openLink(t.url)}>{t.key}</button>
								— {t.summary}
								<span class="status">[{t.status}]</span>
								{#if t.assigneeName}<span class="who"> · {t.assigneeName}</span>{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if jira.started.length > 0}
				<div class="bucket">
					<h4>Started this week</h4>
					<ul>
						{#each jira.started as t (t.key)}
							<li>
								<button class="link" onclick={() => openLink(t.url)}>{t.key}</button>
								— {t.summary}
								{#if t.assigneeName}<span class="who"> · {t.assigneeName}</span>{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if prs.merged.length > 0}
				<div class="bucket">
					<h4>PRs/MRs merged this week</h4>
					<ul>
						{#each prs.merged as p (`${p.source}-${p.id}`)}
							<li>
								<span class="badge">{p.source === 'gitlab' ? '!' : '#'}{p.id}</span>
								<button class="link" onclick={() => openLink(p.webUrl)}>{p.title}</button>
								<span class="who"> · {p.authorUsername}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if prs.opened.length > 0}
				<div class="bucket">
					<h4>PRs/MRs opened this week</h4>
					<ul>
						{#each prs.opened as p (`${p.source}-${p.id}`)}
							<li>
								<span class="badge">{p.source === 'gitlab' ? '!' : '#'}{p.id}</span>
								<button class="link" onclick={() => openLink(p.webUrl)}>{p.title}</button>
								<span class="who"> · {p.authorUsername}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if prs.updated.length > 0}
				<div class="bucket">
					<h4>PRs/MRs with activity this week</h4>
					<ul>
						{#each prs.updated as p (`${p.source}-${p.id}`)}
							<li>
								<span class="badge">{p.source === 'gitlab' ? '!' : '#'}{p.id}</span>
								<button class="link" onclick={() => openLink(p.webUrl)}>{p.title}</button>
								<span class="who"> · {p.authorUsername}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	{/if}

	<NotesEditor {storageKey} />
</section>

<style>
	.team-section {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		margin-bottom: 16px;
		background: var(--color-surface);
	}

	.team-header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.team-header h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.bucket {
		padding: 8px 16px 12px;
		border-bottom: 1px dashed var(--color-border);
	}

	.bucket h4 {
		margin: 8px 0 6px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.bucket ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bucket li {
		font-size: 13px;
		line-height: 1.4;
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--color-primary);
		cursor: pointer;
		text-align: left;
	}

	.link:hover {
		text-decoration: underline;
	}

	.badge {
		display: inline-block;
		min-width: 36px;
		text-align: right;
		font-size: 11px;
		color: var(--color-text-muted);
		font-family: monospace;
		margin-right: 4px;
	}

	.status {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.who {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.team-empty,
	.team-error {
		padding: 16px;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.team-error {
		color: var(--color-danger);
		font-family: monospace;
	}
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/TeamWeeklySection.svelte
git commit -m "Add TeamWeeklySection component"
```

---

## Task 10: `WeeklyUpdateCard` component

**Files:**
- Create: `src/lib/components/WeeklyUpdateCard.svelte`

- [ ] **Step 1: Create the component**

Write `src/lib/components/WeeklyUpdateCard.svelte`:

```svelte
<script lang="ts">
	import TeamWeeklySection from './TeamWeeklySection.svelte';
	import { formatIsoWeekLabel } from '$lib/managerWeek';
	import type { IsoWeek } from '$lib/managerWeek';
	import type { WeeklyTeamActivity } from '$lib/types';

	interface TeamResult {
		name: string;
		activity: { data: WeeklyTeamActivity; error: null } | { data: null; error: string };
	}

	interface Props {
		week: IsoWeek;
		teams: TeamResult[];
	}

	let { week, teams }: Props = $props();
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

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/WeeklyUpdateCard.svelte
git commit -m "Add WeeklyUpdateCard component"
```

---

## Task 11: Wire the tab in `+page.svelte`

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add the import**

In `src/routes/+page.svelte`, add this near the existing card imports (around line 9):

```ts
	import WeeklyUpdateCard from '$lib/components/WeeklyUpdateCard.svelte';
```

- [ ] **Step 2: Add `manager` to `visibleTabIds`**

Replace the `visibleTabIds` derivation (around lines 35-40) with:

```ts
	const visibleTabIds = $derived.by(() => {
		const ids = ['work', 'reviews'];
		if (data.slackConfigured) ids.push('slack');
		if (data.confluenceConfigured) ids.push('docs');
		if (data.managerConfigured) ids.push('manager');
		return ids;
	});
```

- [ ] **Step 3: Add the tab definition**

Replace the `tabs` derivation (around lines 42-49) with:

```ts
	const tabs = $derived<TabDef[]>(
		visibleTabIds.map((id) => {
			if (id === 'work') return { id, label: 'Work' };
			if (id === 'reviews') return { id, label: 'Reviews', count: reviewsCount };
			if (id === 'slack') return { id, label: 'Slack Todos', count: slackCount };
			if (id === 'docs') return { id, label: 'Doc Reviews', count: docsCount };
			return { id, label: 'My Manager' };
		})
	);
```

- [ ] **Step 4: Add the tab render branch**

In the markup, after the `{:else if active === 'docs'}` block (around line 200-212) and before the closing `{/if}` on line 213, add:

```svelte
		{:else if active === 'manager'}
			{#await data.streamed.weekly}
				<div class="panel-loading">Loading weekly update…</div>
			{:then result}
				<WeeklyUpdateCard week={result.week} teams={result.teams} />
			{/await}
```

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "Add My Manager tab branch to dashboard"
```

---

## Task 12: Smoke test in dev server

**Files:** none modified unless issues are found.

- [ ] **Step 1: Configure a test `teams:` block**

In your local `settings.yml`, add a `teams:` block with at least:
- One team with `jiraProjectKeys` + members (e.g. Design System with `DSTM`/`GDSP` and yourself)
- One team without (e.g. Reporting)

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: Server starts on http://localhost:5173.

- [ ] **Step 3: Manually verify in the browser**

Open http://localhost:5173 and:

1. Confirm a new "My Manager" tab appears at the right end of the tab nav.
2. Click it. Card header shows "Weekly Update — <date range> (W<NN>)".
3. The Design System section renders bucket headers ("Done this week", "In flight", etc.) populated from your Jira / MRs / PRs for the current ISO week, **OR** "No tracked activity this week." if you've been quiet.
4. The Reporting section renders only a "Notes" textarea (no buckets).
5. Type into the Reporting Notes textarea, wait 1 second, refresh the page. Text persists.
6. Switch tabs and back. Notes still there.
7. Open browser DevTools → Application → Local Storage and confirm a key like `weekly-notes-reporting-2026-W22` was written.
8. Throw a fake Jira project key into your test Design System config and reload. Confirm the section shows "Failed to load activity: …" but the Reporting section still renders normally (per-team error isolation).

- [ ] **Step 4: Run final type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: If any UI tweaks were made, commit them**

```bash
git add -A
git commit -m "Polish My Manager tab after smoke test"
```

If nothing changed, skip the commit.

---

## Self-review notes

**Spec coverage check (each spec section → task):**
- Phasing (Phase 1 scope) → Tasks 1–12 collectively
- Config (`teams:` block, no coupling to existing `team:`) → Tasks 2, 3, 4
- Data semantics (Done/In flight/Started buckets, `expand=changelog`) → Tasks 2, 5
- PR buckets (Merged/Opened/Updated for GitLab + GitHub) → Tasks 2, 6
- Notes (per-team, per-ISO-week, localStorage, debounced) → Tasks 1 (storage key util), 8
- Architecture files → Tasks 5–11 (one per file)
- Streamed SSR + per-team resilient fetching → Task 7
- Error isolation (one team fails, others render) → Task 7 + Task 9 (error prop rendering)
- Tab nav addition (last position, conditional on `managerConfigured`) → Task 11
- `settings.yml.example` update → Task 4

**Deliberately not in this plan (deferred per the spec):**
- Jira ↔ PR merging into single lines for "Shipped" — the spec mentions this as a v1 nicety; current plan renders Jira buckets and PR buckets separately to keep components simple. Will revisit after smoke test if it's noisy.
- Meetings (Phase 2), Generate draft / Confluence archive (Phase 3) — separate plans.
