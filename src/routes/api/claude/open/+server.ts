import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import type { JiraDetail } from '$lib/types';

const execAsync = promisify(exec);

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildPrompt(key: string, detail: JiraDetail): string {
	const description = stripHtml(detail.description);
	const lines: string[] = [
		"Here is context for a Jira ticket I'm working on. Help me think through it.",
		'',
		`Jira work item ${key}: ${detail.summary}`,
		'',
		`Type: ${detail.issuetype} | Status: ${detail.status} | Priority: ${detail.priority ?? 'None'}`,
		`Assignee: ${detail.assignee ?? 'Unassigned'} | Reporter: ${detail.reporter ?? 'Unknown'}`,
	];

	if (detail.labels.length > 0) {
		lines.push(`Labels: ${detail.labels.join(', ')}`);
	}

	lines.push('', 'Description:', description || '(no description)');

	if (detail.linkedIssues.length > 0) {
		lines.push('', 'Linked issues:');
		for (const li of detail.linkedIssues) {
			lines.push(`  ${li.type}: ${li.key} — ${li.summary} (${li.status})`);
		}
	}

	const recentComments = detail.comments.slice(-3);
	if (recentComments.length > 0) {
		lines.push(
			'',
			`Recent comments (showing last ${recentComments.length} of ${detail.comments.length}):`,
		);
		for (const c of recentComments) {
			const body = c.body.length > 300 ? c.body.slice(0, 300) + '…' : c.body;
			lines.push(`  ${c.author} (${c.created.slice(0, 10)}): ${body}`);
		}
	}

	return lines.join('\n');
}

export const POST: RequestHandler = async ({ request, fetch: kitFetch }) => {
	let key: string;
	try {
		({ key } = await request.json());
	} catch {
		return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
	}

	const detailRes = await kitFetch(`/api/jira/issues/${key}/detail`);
	if (!detailRes.ok) {
		const errData = await detailRes.json().catch(() => ({}));
		return json(
			{ ok: false, error: errData.error ?? `Failed to fetch detail (${detailRes.status})` },
			{ status: 502 },
		);
	}

	const detail: JiraDetail = await detailRes.json();
	const prompt = buildPrompt(key, detail);

	const promptFile = join(tmpdir(), `claude-dashboard-${key}.txt`);
	const scriptFile = join(tmpdir(), `claude-dashboard-${key}.sh`);

	await Promise.all([
		writeFile(promptFile, prompt, 'utf8'),
		writeFile(scriptFile, `#!/bin/zsh\nunset CLAUDECODE\nclaude "$(cat '${promptFile}')"\n`, 'utf8'),
	]);

	await execAsync(
		`osascript -e 'tell application "Terminal" to activate' -e 'tell application "Terminal" to do script "zsh ${scriptFile}"'`,
	);

	return json({ ok: true });
};
