import type { DashboardConfig } from '$lib/config';
import type { JiraWorkItem } from '$lib/types';

interface JiraSearchResponse {
	issues: Array<{
		key: string;
		fields: {
			summary: string;
			status: {
				name: string;
			};
		};
	}>;
}

export async function fetchJiraWorkItems(config: DashboardConfig): Promise<JiraWorkItem[]> {
	const projectList = config.jira.projectKeys.join(', ');
	const jiraEmails = config.team.map((m) => m.jiraEmail).filter(Boolean) as string[];
	const assigneeClause =
		jiraEmails.length > 0
			? `assignee in (${jiraEmails.map((e) => `"${e}"`).join(', ')})`
			: 'assignee = currentUser()';
	const jql = `${assigneeClause} AND project in (${projectList}) AND status not in (Done, Closed, Resolved)`;
	const fields = 'key,summary,status';

	const url = `${config.jira.baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields}`;

	const credentials = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString(
		'base64'
	);

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

	return data.issues.map((issue) => ({
		key: issue.key,
		summary: issue.fields.summary,
		status: issue.fields.status.name,
		url: `${config.jira.baseUrl}/browse/${issue.key}`
	}));
}
