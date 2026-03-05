import { json } from '@sveltejs/kit';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import type { RequestHandler } from './$types';

function repoPathToProjectDir(repoPath: string): string {
	const expanded = repoPath.startsWith('~/') ? repoPath.replace('~', homedir()) : repoPath;
	const withoutLeadingSlash = expanded.startsWith('/') ? expanded.slice(1) : expanded;
	const encoded = '-' + withoutLeadingSlash.replace(/[/.]/g, '-');
	return join(homedir(), '.claude', 'projects', encoded);
}

function extractFirstUserMessage(filePath: string): string {
	try {
		const content = readFileSync(filePath, 'utf-8');
		for (const line of content.split('\n')) {
			if (!line.trim()) continue;
			try {
				const obj = JSON.parse(line);
				if (obj.type !== 'user') continue;
				const msgContent = obj.message?.content;
				if (!msgContent) continue;
				if (typeof msgContent === 'string') return msgContent.slice(0, 100);
				if (Array.isArray(msgContent)) {
					for (const part of msgContent) {
						if (part?.type === 'text' && part.text) return part.text.slice(0, 100);
					}
				}
			} catch {
				// skip malformed lines
			}
		}
	} catch {
		// unreadable
	}
	return '';
}

export const GET: RequestHandler = ({ url }) => {
	const repoPath = url.searchParams.get('repoPath');
	if (!repoPath) return json({ sessions: [] });

	const projectDir = repoPathToProjectDir(repoPath);

	let files: { id: string; mtime: number }[] = [];
	try {
		files = readdirSync(projectDir)
			.filter((f) => f.endsWith('.jsonl'))
			.map((f) => ({
				id: basename(f, '.jsonl'),
				mtime: statSync(join(projectDir, f)).mtimeMs
			}));
	} catch {
		return json({ sessions: [] });
	}

	const recent = files.sort((a, b) => b.mtime - a.mtime).slice(0, 5);

	const sessions = recent.map(({ id, mtime }) => {
		const summary = extractFirstUserMessage(join(projectDir, `${id}.jsonl`));
		return {
			id,
			summary: summary || '(no content)',
			date: new Date(mtime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
		};
	});

	return json({ sessions });
};
