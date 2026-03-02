import type { DashboardConfig } from '$lib/config';
import type { CIPipelineStatus, GitLabMR } from '$lib/types';

interface GitLabBranchResponse {
	name: string;
}

interface GitLabMRResponse {
	iid: number;
	title: string;
	state: 'opened' | 'merged' | 'closed';
	draft: boolean;
	web_url: string;
	user_notes_count: number;
}

interface GitLabPipelineResponse {
	status: string;
}

export async function fetchGitLabMRs(config: DashboardConfig): Promise<GitLabMR[]> {
	const baseUrl = `${config.gitlab.baseUrl}/api/v4/projects/${config.gitlab.projectId}/merge_requests`;
	const headers = { 'PRIVATE-TOKEN': config.gitlab.token };
	const authorParam = `author_username=${encodeURIComponent(config.gitlab.authorUsername)}`;

	const [openMRs, mergedMRs] = await Promise.all([
		fetchMRPage(`${baseUrl}?state=opened&${authorParam}&per_page=100`, headers),
		fetchMRPage(`${baseUrl}?state=merged&${authorParam}&per_page=100`, headers)
	]);

	const all = [...openMRs, ...mergedMRs];

	return all.map((mr) => ({
		iid: mr.iid,
		title: mr.title,
		state: mr.state,
		draft: mr.draft,
		webUrl: mr.web_url,
		userNotesCount: mr.user_notes_count
	}));
}

async function fetchMRPage(url: string, headers: Record<string, string>): Promise<GitLabMRResponse[]> {
	const response = await fetch(url, { headers });

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`GitLab API error ${response.status}: ${body}`);
	}

	return response.json();
}

export async function fetchGitLabBranches(config: DashboardConfig, search: string): Promise<string[]> {
	const url = `${config.gitlab.baseUrl}/api/v4/projects/${config.gitlab.projectId}/repository/branches?search=${encodeURIComponent(search)}&per_page=20`;
	const response = await fetch(url, {
		headers: { 'PRIVATE-TOKEN': config.gitlab.token }
	});

	if (!response.ok) return [];

	const branches: GitLabBranchResponse[] = await response.json();
	return branches.map((b) => b.name);
}

export async function fetchCIPipelineStatus(
	config: DashboardConfig,
	mrIid: number
): Promise<CIPipelineStatus> {
	const url = `${config.gitlab.baseUrl}/api/v4/projects/${config.gitlab.projectId}/merge_requests/${mrIid}/pipelines`;

	const response = await fetch(url, {
		headers: { 'PRIVATE-TOKEN': config.gitlab.token }
	});

	if (!response.ok) {
		return 'none';
	}

	const pipelines: GitLabPipelineResponse[] = await response.json();

	if (pipelines.length === 0) {
		return 'none';
	}

	const status = pipelines[0].status;
	const validStatuses: CIPipelineStatus[] = [
		'success',
		'failed',
		'running',
		'pending',
		'canceled',
		'skipped'
	];

	return validStatuses.includes(status as CIPipelineStatus)
		? (status as CIPipelineStatus)
		: 'none';
}
