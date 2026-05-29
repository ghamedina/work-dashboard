import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { JIRA_TOKEN, GITLAB_TOKEN, GITHUB_TOKEN } from '$env/static/private';
import { env as privateEnv } from '$env/dynamic/private';
import type { TeamMember, TeamConfig } from '$lib/types';

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
	github?: Array<{
		owner?: string;
		repo?: string;
		authorUsername?: string;
	}>;
	slack?: {
		workspaceSubdomain?: string;
		emojiName?: string;
		since?: string;
	};
	confluence?: {
		baseUrl?: string;
		since?: string;
	};
	notion?: {
		meetingsDbId?: string;
	};
	claudeCli?: {
		binary?: string;
		model?: string;
	};
	team?: TeamMember[];
	teams?: Array<{
		name?: string;
		jiraProjectKeys?: string[];
		members?: TeamMember[];
	}>;
	amplitude?: {
		baseUrl?: string;
		orgSlug?: string;
		projects?: Array<{
			name: string;
			envKey: string;
		}>;
	};
	jiraStatuses?: Array<{ label: string; colorToken: string }>;
	prStatuses?: string[];
	selfRepo?: { owner: string; repo: string };
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
	if (!settings.team && !settings.gitlab?.authorUsername)
		throw new Error('settings.yml: gitlab.authorUsername is required (or define a team)');

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
	github: Array<{
		token: string;
		owner: string;
		repo: string;
		authorUsername: string;
	}>;
	slack: {
		token: string;
		workspaceSubdomain: string;
		emojiName: string;
		since: string;
	} | null;
	confluence: {
		token: string;
		email: string;
		baseUrl: string;
		since: string;
	} | null;
	notion: {
		token: string;
		meetingsDbId: string;
	} | null;
	notionConfigured: boolean;
	claudeCli: {
		binary: string;
		model: string;
	};
	team: TeamMember[];
	teams: TeamConfig[];
	managerConfigured: boolean;
	amplitude: {
		baseUrl: string;
		orgSlug: string;
		projects: Array<{
			name: string;
			envKey: string;
		}>;
	};
	jiraStatuses: Array<{ label: string; colorToken: string }>;
	prStatuses: string[];
	selfRepo: { owner: string; repo: string } | null;
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

function buildTeam(settings: YamlSettings): TeamMember[] {
	if (settings.team && settings.team.length > 0) return settings.team;
	return [
		{
			jiraEmail: settings.jira?.email,
			gitlabAuthorUsername: settings.gitlab?.authorUsername,
			githubAuthorUsername: settings.github?.[0]?.authorUsername
		}
	];
}

function buildTeams(settings: YamlSettings): TeamConfig[] {
	if (!settings.teams || settings.teams.length === 0) return [];
	return settings.teams
		.filter((t) => t.name)
		.map((t) => ({
			name: t.name!,
			jiraProjectKeys: t.jiraProjectKeys ?? [],
			members: t.members ?? []
		}));
}

export function getConfig(): DashboardConfig {
	const settings = loadSettings();
	const teams = buildTeams(settings);
	const notionDbId = settings.notion?.meetingsDbId;
	const notionToken = privateEnv.NOTION_TOKEN ?? '';
	if (notionDbId && !notionToken) {
		throw new Error('settings.yml: notion.meetingsDbId is set but NOTION_TOKEN is missing from .env');
	}
	return {
		team: buildTeam(settings),
		teams,
		managerConfigured: teams.length > 0,
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
		github: (settings.github ?? [])
			.filter((r) => r.owner && r.repo && r.authorUsername)
			.map((r) => ({
				token: GITHUB_TOKEN,
				owner: r.owner!,
				repo: r.repo!,
				authorUsername: r.authorUsername!
			})),
		slack: settings.slack?.workspaceSubdomain && settings.slack?.since
			? {
				token: privateEnv.SLACK_TOKEN ?? '',
				workspaceSubdomain: settings.slack.workspaceSubdomain,
				emojiName: settings.slack.emojiName ?? 'todo',
				since: settings.slack.since
			}
			: null,
		confluence: settings.confluence?.baseUrl && settings.confluence?.since
			? {
				token: JIRA_TOKEN,
				email: settings.jira!.email!,
				baseUrl: settings.confluence.baseUrl.replace(/\/$/, ''),
				since: settings.confluence.since
			}
			: null,
		notion: notionDbId
			? { token: notionToken, meetingsDbId: notionDbId }
			: null,
		notionConfigured: !!notionDbId,
		claudeCli: {
			binary: settings.claudeCli?.binary ?? 'claude',
			model: settings.claudeCli?.model ?? 'claude-haiku-4-5'
		},
		amplitude: {
			baseUrl: settings.amplitude!.baseUrl!,
			orgSlug: settings.amplitude?.orgSlug ?? '',
			projects: settings.amplitude?.projects ?? []
		},
		jiraStatuses: settings.jiraStatuses ?? [],
		prStatuses: settings.prStatuses ?? [],
		selfRepo: settings.selfRepo?.owner && settings.selfRepo?.repo
			? { owner: settings.selfRepo.owner, repo: settings.selfRepo.repo }
			: null,
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
