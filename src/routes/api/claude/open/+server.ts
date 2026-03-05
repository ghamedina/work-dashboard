import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { tmpdir, homedir } from 'os';
import { join, resolve } from 'path';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import type { JiraDetail } from '$lib/types';
import { getConfig, type TerminalChoice } from '$lib/config';

const execAsync = promisify(exec);

function shellQuote(value: string): string {
	return "'" + value.replace(/'/g, "'\\''") + "'";
}

function resolveBasePath(basePath: string): string {
	if (basePath.startsWith('~/')) return basePath.replace('~', homedir());
	if (basePath.startsWith('/')) return basePath;
	return resolve(process.cwd(), basePath);
}

function resolvePromptText(promptKey: string): string {
	const { claudePrompt } = getConfig();
	const entry = claudePrompt.prompts[promptKey];
	if (!entry) return '';
	if (entry.type === 'text') return entry.data;
	const basePath = resolveBasePath(claudePrompt.basePath);
	const resolved = entry.data.replace('$basePath', basePath);
	if (!existsSync(resolved)) throw new Error(`Prompt file not found: ${resolved}`);
	return readFileSync(resolved, 'utf-8').trim();
}

function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/?(p|div|li|h[1-6]|tr|blockquote|pre|ul|ol)[^>]*>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n[ \t]+/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

type CommentsMode = 'override' | 'secondary' | 'exclude';

function buildPrompt(key: string, detail: JiraDetail, preamble: string, commentsMode: CommentsMode): string {
	const description = stripHtml(detail.description);
	const lines: string[] = [
		preamble,
		'',
		`Jira work item ${key}: ${detail.summary}`,
		'',
		`Type: ${detail.issuetype} | Status: ${detail.status} | Priority: ${detail.priority ?? 'None'}`,
		`Assignee: ${detail.assignee ?? 'Unassigned'} | Reporter: ${detail.reporter ?? 'Unknown'}`
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

	if (commentsMode !== 'exclude') {
		const recentComments = detail.comments.slice(-3);
		if (recentComments.length > 0) {
			const commentNote = commentsMode === 'override'
				? 'Note: Comments contain later discussions and decisions. Where a comment contradicts or refines the description, defer to the comment.'
				: 'Note: The description above is the primary specification. Comments below provide additional context but do not override it.';
			lines.push(
				'',
				commentNote,
				'',
				`Recent comments (showing last ${recentComments.length} of ${detail.comments.length}):`
			);
			for (const c of recentComments) {
				const stripped = stripHtml(c.body);
				const body = stripped.length > 300 ? stripped.slice(0, 300) + '…' : stripped;
				lines.push(`  ${c.author} (${c.created.slice(0, 10)}): ${body}`);
			}
		}
	}

	return lines.join('\n');
}

function buildAppleScript(
	terminalChoice: TerminalChoice,
	shell: string,
	profile: string,
	scriptFile: string
): string {
	const command = `${shell} ${scriptFile}`;

	if (terminalChoice === 'iTerm2') {
		return [
			'tell application "iTerm2"',
			`  create window with profile "${profile}" command "${command}"`,
			'end tell'
		].join('\n');
	}

	if (terminalChoice === 'Warp') {
		return [
			'tell application "Warp" to activate',
			'delay 0.5',
			'tell application "System Events"',
			'  tell process "Warp"',
			'    keystroke "t" using command down',
			'    delay 0.5',
			`    keystroke ${JSON.stringify(command)}`,
			'    key code 36',
			'  end tell',
			'end tell'
		].join('\n');
	}

	return [
		'tell application "Terminal" to activate',
		`tell application "Terminal" to do script "${command}"`
	].join('\n');
}

export const POST: RequestHandler = async ({ request, fetch: kitFetch }) => {
	let key: string;
	let repoPath: string;
	let promptKey: string | undefined;
	let promptText: string | undefined;
	let claudeFlags: { chrome?: boolean; resumeSessionId?: string } | undefined;
	let commentsMode: CommentsMode = 'override';
	try {
		({ key, repoPath, promptKey, promptText, claudeFlags, commentsMode = 'override' } = await request.json());
	} catch {
		return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
	}

	let prompt: string;
	if (promptText !== undefined) {
		prompt = promptText;
	} else {
		if (!promptKey) {
			return json({ ok: false, error: 'Missing promptKey' }, { status: 400 });
		}
		const detailRes = await kitFetch(`/api/jira/issues/${key}/detail`);
		if (!detailRes.ok) {
			const errData = await detailRes.json().catch(() => ({}));
			return json(
				{ ok: false, error: errData.error ?? `Failed to fetch detail (${detailRes.status})` },
				{ status: 502 }
			);
		}
		const detail: JiraDetail = await detailRes.json();
		let preamble: string;
		try {
			preamble = resolvePromptText(promptKey);
		} catch (e) {
			return json({ ok: false, error: (e as Error).message }, { status: 422 });
		}
		prompt = buildPrompt(key, detail, preamble, commentsMode);
	}

	const { terminal } = getConfig();
	const { terminalChoice, terminalConfigs } = terminal;
	const termConfig = terminalConfigs[terminalChoice];
	const { shell } = termConfig;
	const profile = 'profile' in termConfig ? termConfig.profile : '';

	const promptFile = join(tmpdir(), `claude-dashboard-${key}.txt`);
	const scriptFile = join(tmpdir(), `claude-dashboard-${key}.sh`);
	const appleScriptFile = join(tmpdir(), `claude-dashboard-${key}.applescript`);

	const appleScript = buildAppleScript(terminalChoice, shell, profile, scriptFile);

	const flagParts: string[] = [];
	if (claudeFlags?.chrome) flagParts.push('--chrome');
	if (claudeFlags?.resumeSessionId) flagParts.push(`--resume ${shellQuote(claudeFlags.resumeSessionId)}`);
	const claudeCmd = `claude${flagParts.length ? ' ' + flagParts.join(' ') : ''} "$(cat ${shellQuote(promptFile)})"`;

	await Promise.all([
		writeFile(promptFile, prompt, 'utf8'),
		writeFile(
			scriptFile,
			`cd ${shellQuote(repoPath)}\nunset CLAUDECODE\n${claudeCmd}\n`,
			'utf8'
		),
		writeFile(appleScriptFile, appleScript, 'utf8')
	]);

	await execAsync(`osascript "${appleScriptFile}"`);

	return json({ ok: true });
};
