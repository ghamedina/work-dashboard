import { json } from '@sveltejs/kit';
import { readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { getConfig } from '$lib/config';
import type { RequestHandler } from './$types';

function resolveHome(p: string): string {
	return p.replace(/^~/, homedir());
}

function expandGlob(p: string): string[] {
	const resolved = resolveHome(p);
	if (!resolved.endsWith('/*')) return [resolved];

	const dir = resolved.slice(0, -2);
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => join(dir, e.name));
	} catch {
		return [];
	}
}

function toDisplay(absolute: string): string {
	return absolute.replace(homedir(), '~');
}

export const GET: RequestHandler = () => {
	const { repoPath } = getConfig();
	const home = homedir();
	const absolutePaths = repoPath.repoPaths.flatMap(expandGlob);
	const defaultPath = resolveHome(repoPath.default);

	const paths = absolutePaths.map((full) => ({
		full,
		display: full.replace(home, '~')
	}));

	return json({ paths, defaultPath: { full: defaultPath, display: toDisplay(defaultPath) } });
};
