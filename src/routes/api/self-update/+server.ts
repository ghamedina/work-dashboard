import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getConfig } from '$lib/config';
import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

export const GET: RequestHandler = async () => {
	const config = getConfig();

	if (!config.selfRepo) {
		return json({ error: 'selfRepo not configured' }, { status: 404 });
	}

	const { owner, repo } = config.selfRepo;
	const token = process.env.GITHUB_TOKEN;
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};
	if (token) headers['Authorization'] = `Bearer ${token}`;

	const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd() });
	const localSHA = stdout.trim();

	const commitRes = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/commits/main`,
		{ headers }
	);
	if (!commitRes.ok) {
		return json({ error: `GitHub API error: ${commitRes.status}` }, { status: 503 });
	}
	const commitData = await commitRes.json() as { sha: string };
	const remoteSHA = commitData.sha;

	const compareRes = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/compare/${localSHA}...${remoteSHA}`,
		{ headers }
	);
	if (!compareRes.ok) {
		return json({ error: `GitHub compare error: ${compareRes.status}` }, { status: 503 });
	}
	const compareData = await compareRes.json() as { status: string };

	return json({ status: compareData.status, remoteSHA });
};
