import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { MRComment } from '$lib/types';
import type { RequestHandler } from './$types';

interface GitLabNote {
	id: number;
	body: string;
	system: boolean;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const { iid } = params;
	const mrWebUrl = url.searchParams.get('mrWebUrl');

	if (!mrWebUrl) {
		return json({ error: 'mrWebUrl query param required' }, { status: 400 });
	}

	const token = env.GITLAB_TOKEN;
	const baseUrl = env.GITLAB_BASE_URL;
	const projectId = env.GITLAB_PROJECT_ID;

	if (!token || !baseUrl || !projectId) {
		return json({ error: 'GitLab env vars not configured' }, { status: 500 });
	}

	const notesUrl = `${baseUrl}/api/v4/projects/${projectId}/merge_requests/${iid}/notes?sort=asc&per_page=100`;

	try {
		const res = await fetch(notesUrl, {
			headers: { 'PRIVATE-TOKEN': token }
		});

		if (!res.ok) {
			const body = await res.text().catch(() => '');
			return json({ error: `GitLab API error ${res.status}: ${body}` }, { status: 502 });
		}

		const notes: GitLabNote[] = await res.json();

		const comments: MRComment[] = notes
			.filter((n) => !n.system)
			.map((n) => ({
				id: n.id,
				body: n.body,
				webUrl: `${mrWebUrl}#note_${n.id}`
			}));

		return json(comments);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch comments';
		return json({ error: message }, { status: 502 });
	}
};
