import type { DashboardConfig } from '$lib/config';
import type { CIPipelineStatus, UnifiedPR } from '$lib/types';

interface GitHubPRResponse {
	number: number;
	title: string;
	state: 'open' | 'closed';
	draft: boolean;
	html_url: string;
	comments: number;
	review_comments: number;
	merged_at: string | null;
	head: { sha: string };
	user: { login: string };
}

interface GitHubCombinedStatusResponse {
	state: string;
}

interface GitHubCheckRunsResponse {
	check_runs: Array<{ conclusion: string | null; status: string }>;
}

export async function fetchGitHubPRs(config: DashboardConfig): Promise<UnifiedPR[]> {
	const { owner, repo, authorUsername, token } = config.github!;
	const baseUrl = `https://api.github.com/repos/${owner}/${repo}/pulls`;
	const headers = {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};

	const [openPRs, closedPRs] = await Promise.all([
		fetchPRPage(`${baseUrl}?state=open&per_page=100`, headers),
		fetchPRPage(`${baseUrl}?state=closed&per_page=100`, headers)
	]);

	const mine = [...openPRs, ...closedPRs].filter(
		(pr) => pr.user.login.toLowerCase() === authorUsername.toLowerCase()
	);

	return Promise.all(
		mine.map(async (pr) => {
			const ciStatus = await fetchGitHubCIStatus(config, pr.head.sha).catch(() => 'none' as const);
			return toUnifiedPR(pr, ciStatus);
		})
	);
}

function toUnifiedPR(pr: GitHubPRResponse, ciStatus: CIPipelineStatus): UnifiedPR {
	let state: UnifiedPR['state'];
	if (pr.draft) {
		state = 'draft';
	} else if (pr.merged_at) {
		state = 'merged';
	} else if (pr.state === 'closed') {
		state = 'closed';
	} else {
		state = 'open';
	}

	return {
		source: 'github',
		id: pr.number,
		title: pr.title,
		state,
		webUrl: pr.html_url,
		commentCount: pr.comments + pr.review_comments,
		ciStatus
	};
}

async function fetchPRPage(url: string, headers: Record<string, string>): Promise<GitHubPRResponse[]> {
	const response = await fetch(url, { headers });

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`GitHub API error ${response.status}: ${body}`);
	}

	return response.json();
}

export async function fetchGitHubCIStatus(
	config: DashboardConfig,
	sha: string
): Promise<CIPipelineStatus> {
	const { owner, repo, token } = config.github!;
	const headers = {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};

	const [combinedStatus, checkRuns] = await Promise.all([
		fetchCombinedStatus(owner, repo, sha, headers),
		fetchCheckRuns(owner, repo, sha, headers)
	]);

	return resolvedCIStatus(combinedStatus, checkRuns);
}

async function fetchCombinedStatus(
	owner: string,
	repo: string,
	sha: string,
	headers: Record<string, string>
): Promise<GitHubCombinedStatusResponse | null> {
	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/commits/${sha}/status`,
		{ headers }
	);
	if (!response.ok) return null;
	return response.json();
}

async function fetchCheckRuns(
	owner: string,
	repo: string,
	sha: string,
	headers: Record<string, string>
): Promise<GitHubCheckRunsResponse | null> {
	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`,
		{ headers }
	);
	if (!response.ok) return null;
	return response.json();
}

function resolvedCIStatus(
	combinedStatus: GitHubCombinedStatusResponse | null,
	checkRuns: GitHubCheckRunsResponse | null
): CIPipelineStatus {
	const statuses: CIPipelineStatus[] = [];

	if (combinedStatus?.state) {
		statuses.push(githubStateToCIStatus(combinedStatus.state));
	}

	if (checkRuns?.check_runs?.length) {
		const checkStatus = resolveCheckRuns(checkRuns.check_runs);
		statuses.push(checkStatus);
	}

	if (statuses.length === 0) return 'none';
	if (statuses.includes('failed')) return 'failed';
	if (statuses.includes('running')) return 'running';
	if (statuses.includes('pending')) return 'pending';
	if (statuses.every((s) => s === 'success')) return 'success';
	return 'none';
}

function githubStateToCIStatus(state: string): CIPipelineStatus {
	if (state === 'success') return 'success';
	if (state === 'failure' || state === 'error') return 'failed';
	if (state === 'pending') return 'pending';
	return 'none';
}

function resolveCheckRuns(
	runs: GitHubCheckRunsResponse['check_runs']
): CIPipelineStatus {
	if (runs.some((r) => r.status !== 'completed')) return 'running';
	if (runs.some((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out')) return 'failed';
	if (runs.every((r) => r.conclusion === 'success' || r.conclusion === 'skipped')) return 'success';
	return 'none';
}
