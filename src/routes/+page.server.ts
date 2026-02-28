import type { PageServerLoad } from './$types';
import { getConfig } from '$lib/config';
import { fetchJiraWorkItems } from '$lib/api/jira';
import { fetchGitLabMRs, fetchCIPipelineStatus } from '$lib/api/gitlab';
import type { DashboardRow, GitLabMR } from '$lib/types';

type ApiResult<T> = { data: T; error: null } | { data: null; error: string };

function resilient<T>(promise: Promise<T>): Promise<ApiResult<T>> {
	return promise
		.then((data) => ({ data, error: null }) satisfies ApiResult<T>)
		.catch((err: unknown) => ({
			data: null,
			error: err instanceof Error ? err.message : String(err)
		}));
}

function isGitLabUnavailable(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	if (err instanceof TypeError) return true;
	const msg = err.message.toLowerCase();
	return (
		msg.includes('fetch failed') ||
		msg.includes('econnrefused') ||
		msg.includes('econnreset') ||
		msg.includes('etimedout') ||
		msg.includes('503')
	);
}

export const load: PageServerLoad = () => {
	const config = getConfig();

	const jiraPromise = fetchJiraWorkItems(config);
	const gitlabPromise = fetchGitLabMRs(config);

	const jiraStatus = resilient(jiraPromise.then((items) => ({ count: items.length })));
	const gitlabStatus = resilient(gitlabPromise.then((mrs) => ({ count: mrs.length })));

	const gitlabVpnError: Promise<boolean> = gitlabPromise
		.then(() => false)
		.catch((err: unknown) => isGitLabUnavailable(err));

	const gitlabSafe: Promise<GitLabMR[]> = gitlabPromise.catch(() => []);

	const rows: Promise<ApiResult<DashboardRow[]>> = resilient(
		Promise.all([jiraPromise, gitlabSafe]).then(async ([jiraItems, allMRs]) => {
			return Promise.all(
				jiraItems.map(async (jiraItem) => {
					const mr = allMRs.find((m) => m.title.includes(jiraItem.key)) ?? null;
					const ciStatus = mr ? await fetchCIPipelineStatus(config, mr.iid) : ('none' as const);
					return { jiraItem, mr, ciStatus };
				})
			);
		})
	);

	return {
		streamed: {
			jiraStatus,
			gitlabStatus,
			gitlabVpnError,
			rows
		}
	};
};
