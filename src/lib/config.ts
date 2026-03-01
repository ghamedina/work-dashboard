import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { JIRA_TOKEN, GITLAB_TOKEN } from '$env/static/private';

interface YamlSettings {
	jira?: {
		baseUrl?: string;
		email?: string;
		projectKey?: string;
	};
	gitlab?: {
		baseUrl?: string;
		projectId?: number;
		repo?: string;
		authorUsername?: string;
	};
	amplitude?: {
		baseUrl?: string;
	};
}

function deepMerge(base: YamlSettings, override: YamlSettings): YamlSettings {
	const result = { ...base } as Record<string, unknown>;
	for (const [key, val] of Object.entries(override ?? {})) {
		result[key] =
			val && typeof val === 'object' && !Array.isArray(val)
				? deepMerge((result[key] as YamlSettings) ?? {}, val as YamlSettings)
				: val;
	}
	return result as YamlSettings;
}

function loadSettings(): YamlSettings {
	const defaults = parse(
		readFileSync(join(process.cwd(), 'settings.default.yml'), 'utf-8')
	) as YamlSettings;

	let user: YamlSettings = {};
	try {
		user = parse(
			readFileSync(join(process.cwd(), 'settings.user.yml'), 'utf-8')
		) as YamlSettings;
	} catch {
		throw new Error(
			'settings.user.yml not found — copy settings.user.yml.example and fill in required fields'
		);
	}

	const merged = deepMerge(defaults, user);

	if (!merged.jira?.email) throw new Error('settings.user.yml: jira.email is required');
	if (!merged.gitlab?.authorUsername)
		throw new Error('settings.user.yml: gitlab.authorUsername is required');

	return merged;
}

const settings = loadSettings();

export interface DashboardConfig {
	jira: {
		baseUrl: string;
		email: string;
		apiToken: string;
		projectKey: string;
	};
	gitlab: {
		baseUrl: string;
		token: string;
		projectId: number;
		repo: string;
		authorUsername: string;
	};
	amplitude: {
		baseUrl: string;
	};
}

export function getConfig(): DashboardConfig {
	return {
		jira: {
			baseUrl: settings.jira!.baseUrl!,
			email: settings.jira!.email!,
			apiToken: JIRA_TOKEN,
			projectKey: settings.jira!.projectKey!
		},
		gitlab: {
			baseUrl: settings.gitlab!.baseUrl!,
			token: GITLAB_TOKEN,
			projectId: Number(settings.gitlab!.projectId),
			repo: settings.gitlab!.repo!,
			authorUsername: settings.gitlab!.authorUsername!
		},
		amplitude: {
			baseUrl: settings.amplitude!.baseUrl!
		}
	};
}
