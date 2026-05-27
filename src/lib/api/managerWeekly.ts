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
	const url = `${config.jira.baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields}&expand=changelog&maxResults=100`;

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

async function fetchMRPage(url: string, headers: Record<string, string>): Promise<GitLabMRResponse[]> {
	const r = await fetch(url, { headers });
	if (!r.ok) {
		const body = await r.text().catch(() => '');
		throw new Error(`GitLab MR fetch error ${r.status}: ${body}`);
	}
	return r.json();
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
			const authorParam = `author_username=${encodeURIComponent(u)}&updated_after=${encodeURIComponent(isoStart)}&per_page=100`;
			const [opened, merged] = await Promise.all([
				fetchMRPage(`${baseUrl}?state=opened&${authorParam}`, headers),
				fetchMRPage(`${baseUrl}?state=merged&${authorParam}`, headers)
			]);
			return [...opened, ...merged];
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
