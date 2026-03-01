import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig } from '$lib/config';

interface JiraTransition {
	id: string;
	name: string;
	to: { name: string };
}

interface JiraTransitionsResponse {
	transitions: JiraTransition[];
}

function authHeader(): string {
	const { jira } = getConfig();
	return 'Basic ' + btoa(`${jira.email}:${jira.apiToken}`);
}

export const GET: RequestHandler = async ({ params }) => {
	const { key } = params;
	const { jira } = getConfig();
	const headers = { Authorization: authHeader() };

	const res = await fetch(`${jira.baseUrl}/rest/api/3/issue/${key}/transitions`, { headers });

	if (!res.ok) {
		return json({ ok: false, error: `Jira API error ${res.status}` }, { status: 502 });
	}

	const { transitions }: JiraTransitionsResponse = await res.json();
	const statuses = transitions.map((t) => t.to.name);

	return json({ ok: true, statuses });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { key } = params;
	const { jira } = getConfig();
	const body = await request.json().catch(() => null);
	const statusName: string | undefined = body?.statusName;

	if (!statusName) {
		return json({ ok: false, error: 'statusName is required' }, { status: 400 });
	}

	const headers = {
		Authorization: authHeader(),
		'Content-Type': 'application/json'
	};

	try {
		const transitionsRes = await fetch(`${jira.baseUrl}/rest/api/3/issue/${key}/transitions`, {
			headers
		});

		if (!transitionsRes.ok) {
			return json({ ok: false, error: `Jira API error ${transitionsRes.status}` }, { status: 502 });
		}

		const { transitions }: JiraTransitionsResponse = await transitionsRes.json();

		const match = transitions.find(
			(t) => t.to.name.toLowerCase() === statusName.toLowerCase()
		);

		if (!match) {
			return json(
				{ ok: false, error: `No transition found to status "${statusName}"` },
				{ status: 404 }
			);
		}

		const updateRes = await fetch(`${jira.baseUrl}/rest/api/3/issue/${key}/transitions`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ transition: { id: match.id } })
		});

		if (!updateRes.ok) {
			return json(
				{ ok: false, error: `Jira transition error ${updateRes.status}` },
				{ status: 502 }
			);
		}

		return json({ ok: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unexpected error';
		return json({ ok: false, error: message }, { status: 500 });
	}
};
