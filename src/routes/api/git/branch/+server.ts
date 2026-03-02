import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

export const GET: RequestHandler = async ({ url }) => {
	const repoPath = url.searchParams.get('repoPath');
	if (!repoPath) {
		return json({ error: 'Missing repoPath' }, { status: 400 });
	}

	const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
		cwd: repoPath
	});

	return json({ branch: stdout.trim() });
};
