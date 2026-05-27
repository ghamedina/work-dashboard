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
