import { json } from '@sveltejs/kit';
import { JIRA_BASE_URL, JIRA_EMAIL, JIRA_TOKEN } from '$env/static/private';
import type { RequestHandler } from './$types';

interface JiraTransition {
	id: string;
	name: string;
	to: { name: string };
}

interface JiraTransitionsResponse {
	transitions: JiraTransition[];
}

function authHeader(): string {
	return 'Basic ' + btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`);
}

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { key } = params;
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
		const transitionsRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/transitions`, {
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

		const updateRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/transitions`, {
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
