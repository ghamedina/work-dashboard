import { json } from '@sveltejs/kit';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { getConfig } from '$lib/config';
import type { RequestHandler } from './$types';

function resolveBasePath(basePath: string): string {
	if (basePath.startsWith('~/')) return basePath.replace('~', homedir());
	if (basePath.startsWith('/')) return basePath;
	return resolve(process.cwd(), basePath);
}

export const GET: RequestHandler = () => {
	const { claudePrompt } = getConfig();
	const basePath = resolveBasePath(claudePrompt.basePath);

	const prompts = Object.entries(claudePrompt.prompts).map(([key, entry]) => {
		if (entry.type === 'text') {
			return { key, label: key, isFile: false, filePath: null, text: entry.data };
		}
		const resolved = entry.data.replace('$basePath', basePath);
		if (!existsSync(resolved)) {
			return { key, label: key, isFile: true, filePath: resolved, text: `(file not found: ${resolved})` };
		}
		return { key, label: key, isFile: true, filePath: resolved, text: readFileSync(resolved, 'utf-8').trim() };
	});

	return json({ prompts, default: claudePrompt.default });
};
