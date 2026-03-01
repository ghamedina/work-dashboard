import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { JiraDetail } from '$lib/types';
import { getConfig } from '$lib/config';

function authHeader(): string {
	const { jira } = getConfig();
	return 'Basic ' + btoa(`${jira.email}:${jira.apiToken}`);
}

interface JiraIssueLink {
	type: { name: string; inward: string; outward: string };
	inwardIssue?: { key: string; fields: { summary: string; status: { name: string } } };
	outwardIssue?: { key: string; fields: { summary: string; status: { name: string } } };
}

interface JiraComment {
	author: { displayName: string };
	body: unknown;
	created: string;
}

export const GET: RequestHandler = async ({ params }) => {
	const { key } = params;
	const { jira } = getConfig();
	const headers = { Authorization: authHeader() };

	const fieldsParam = 'summary,description,status,assignee,reporter,priority,issuetype,labels,created,updated,issuelinks';
	const [issueRes, commentsRes] = await Promise.all([
		fetch(`${jira.baseUrl}/rest/api/3/issue/${key}?fields=${fieldsParam}&expand=renderedFields`, { headers }),
		fetch(`${jira.baseUrl}/rest/api/3/issue/${key}/comment`, { headers })
	]);

	if (!issueRes.ok) {
		return json({ ok: false, error: `Jira API error ${issueRes.status}` }, { status: 502 });
	}

	const issueData = await issueRes.json();
	const f = issueData.fields;
	const rf = issueData.renderedFields ?? {};

	const linkedIssues = ((f.issuelinks ?? []) as JiraIssueLink[]).map((link) => {
		const linked = link.outwardIssue ?? link.inwardIssue;
		const linkType = link.outwardIssue ? link.type.outward : link.type.inward;
		if (!linked) return null;
		return {
			type: linkType,
			key: linked.key,
			summary: linked.fields.summary,
			status: linked.fields.status.name,
			url: `${jira.baseUrl}/browse/${linked.key}`
		};
	}).filter(Boolean) as JiraDetail['linkedIssues'];

	let comments: JiraDetail['comments'] = [];
	if (commentsRes.ok) {
		const commentsData = await commentsRes.json();
		comments = ((commentsData.comments ?? []) as JiraComment[]).map((c) => ({
			author: c.author.displayName,
			body: typeof c.body === 'string' ? c.body : JSON.stringify(c.body),
			created: c.created
		}));
	}

	const detail: JiraDetail = {
		summary: f.summary ?? '',
		description: rf.description ?? '',
		status: f.status?.name ?? '',
		assignee: f.assignee?.displayName ?? null,
		reporter: f.reporter?.displayName ?? null,
		priority: f.priority?.name ?? null,
		issuetype: f.issuetype?.name ?? '',
		labels: f.labels ?? [],
		created: f.created ?? '',
		updated: f.updated ?? '',
		linkedIssues,
		comments
	};

	return json(detail);
};
