import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { JIRA_TOKEN, GITLAB_TOKEN, GITHUB_TOKEN } from '$env/static/private';

export type TerminalChoice = 'Terminal' | 'iTerm2' | 'Warp';

interface YamlSettings {
	jira?: {
		baseUrl?: string;
		email?: string;
		projectKeys?: string[];
	};
	gitlab?: {
		baseUrl?: string;
		projectId?: number;
		repo?: string;
		authorUsername?: string;
	};
	github?: {
		owner?: string;
		repo?: string;
		authorUsername?: string;
	};
	amplitude?: {
		baseUrl?: string;
		orgSlug?: string;
		projects?: Array<{
			name: string;
			envKey: string;
		}>;
	};
	claudePrompt?: {
		default?: string;
		basePath?: string;
		prompts?: Record<string, { type: 'path' | 'text'; data: string }>;
	};
	repoPath?: {
		default?: string;
		repoPaths?: (string | { worktrees: string[] })[];
	};
	terminal?: {
		terminalChoice?: TerminalChoice;
		terminalConfigs?: {
			Terminal?: { shell: string };
			iTerm2?: { shell: string; profile: string };
			Warp?: { shell: string };
		};
	};
}

function loadSettings(): YamlSettings {
	let settings: YamlSettings;
	try {
		settings = parse(
			readFileSync(join(process.cwd(), 'settings.yml'), 'utf-8')
		) as YamlSettings;
	} catch {
		throw new Error('settings.yml not found — copy settings.yml.example and fill in required fields');
	}

	if (!settings.jira?.email) throw new Error('settings.yml: jira.email is required');
	if (!settings.gitlab?.authorUsername)
		throw new Error('settings.yml: gitlab.authorUsername is required');

	return settings;
}

export interface DashboardConfig {
	jira: {
		baseUrl: string;
		email: string;
		apiToken: string;
		projectKeys: string[];
	};
	gitlab: {
		baseUrl: string;
		token: string;
		projectId: number;
		repo: string;
		authorUsername: string;
	};
	github: {
		token: string;
		owner: string;
		repo: string;
		authorUsername: string;
	} | null;
	amplitude: {
		baseUrl: string;
		orgSlug: string;
		projects: Array<{
			name: string;
			envKey: string;
		}>;
	};
	claudePrompt: {
		default: string;
		basePath: string;
		prompts: Record<string, { type: 'path' | 'text'; data: string }>;
	};
	repoPath: {
		default: string;
		repoPaths: (string | { worktrees: string[] })[];
	};
	terminal: {
		terminalChoice: TerminalChoice;
		terminalConfigs: {
			Terminal: { shell: string };
			iTerm2: { shell: string; profile: string };
			Warp: { shell: string };
		};
	};
}

export function getConfig(): DashboardConfig {
	const settings = loadSettings();
	return {
		jira: {
			baseUrl: settings.jira!.baseUrl!,
			email: settings.jira!.email!,
			apiToken: JIRA_TOKEN,
			projectKeys: settings.jira!.projectKeys!
		},
		gitlab: {
			baseUrl: settings.gitlab!.baseUrl!,
			token: GITLAB_TOKEN,
			projectId: Number(settings.gitlab!.projectId),
			repo: settings.gitlab!.repo!,
			authorUsername: settings.gitlab!.authorUsername!
		},
		github: settings.github?.owner && settings.github?.repo && settings.github?.authorUsername
			? {
					token: GITHUB_TOKEN,
					owner: settings.github.owner,
					repo: settings.github.repo,
					authorUsername: settings.github.authorUsername
				}
			: null,
		amplitude: {
			baseUrl: settings.amplitude!.baseUrl!,
			orgSlug: settings.amplitude?.orgSlug ?? '',
			projects: settings.amplitude?.projects ?? []
		},
		claudePrompt: {
			default: settings.claudePrompt!.default!,
			basePath: settings.claudePrompt!.basePath!,
			prompts: settings.claudePrompt!.prompts!
		},
		repoPath: {
			default: settings.repoPath!.default!,
			repoPaths: settings.repoPath!.repoPaths!
		},
		terminal: {
			terminalChoice: settings.terminal!.terminalChoice!,
			terminalConfigs: {
				Terminal: settings.terminal!.terminalConfigs!.Terminal!,
				iTerm2: settings.terminal!.terminalConfigs!.iTerm2!,
				Warp: settings.terminal!.terminalConfigs!.Warp ?? { shell: 'zsh' }
			}
		}
	};
}
