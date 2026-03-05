import { json } from '@sveltejs/kit';
import { readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
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

interface WorktreeEntry {
	full: string;
	branch: string;
	display: string;
}

interface WorktreeGroup {
	repoFull: string;
	repoDisplay: string;
	worktrees: WorktreeEntry[];
}

function getWorktrees(repoPath: string, home: string): WorktreeEntry[] {
	try {
		const output = execSync('git worktree list', { cwd: repoPath, encoding: 'utf-8' });
		return output
			.trim()
			.split('\n')
			.slice(1)
			.map((line) => {
				const match = line.match(/^(\S+)\s+\w+\s+\[(.+)\]$/);
				if (!match) return null;
				const [, full, branch] = match;
				return { full, branch, display: full.replace(home, '~') };
			})
			.filter((e): e is WorktreeEntry => e !== null);
	} catch {
		return [];
	}
}

export const GET: RequestHandler = () => {
	const { repoPath } = getConfig();
	const home = homedir();

	const worktreeRepoPaths: string[] = [];
	const plainPaths: string[] = [];

	for (const entry of repoPath.repoPaths) {
		if (typeof entry === 'string') {
			plainPaths.push(entry);
		} else if (entry && typeof entry === 'object' && Array.isArray(entry.worktrees)) {
			for (const wt of entry.worktrees) {
				worktreeRepoPaths.push(wt);
			}
		}
	}

	const absolutePaths = plainPaths.flatMap(expandGlob);
	const defaultPath = resolveHome(repoPath.default);

	const paths = absolutePaths.map((full) => ({
		full,
		display: full.replace(home, '~')
	}));

	const worktreeGroups: WorktreeGroup[] = worktreeRepoPaths.flatMap((rawPath) => {
		const resolved = resolveHome(rawPath);
		const worktrees = getWorktrees(resolved, home);
		if (worktrees.length === 0) return [];
		return [{ repoFull: resolved, repoDisplay: toDisplay(resolved), worktrees }];
	});

	const worktreeBasePaths = worktreeRepoPaths.map((rawPath) => {
		const full = resolveHome(rawPath);
		return { full, display: toDisplay(full) };
	});

	return json({
		paths,
		defaultPath: { full: defaultPath, display: toDisplay(defaultPath) },
		worktreeGroups,
		worktreeBasePaths
	});
};
