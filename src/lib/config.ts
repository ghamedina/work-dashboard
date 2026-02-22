import {
	JIRA_BASE_URL,
	JIRA_EMAIL,
	JIRA_TOKEN,
	JIRA_PROJECT_KEY,
	GITLAB_BASE_URL,
	GITLAB_TOKEN,
	GITLAB_PROJECT_ID,
	GITLAB_REPO,
	GITLAB_AUTHOR_USERNAME
} from '$env/static/private';

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
}

export function getConfig(): DashboardConfig {
	return {
		jira: {
			baseUrl: JIRA_BASE_URL,
			email: JIRA_EMAIL,
			apiToken: JIRA_TOKEN,
			projectKey: JIRA_PROJECT_KEY
		},
		gitlab: {
			baseUrl: GITLAB_BASE_URL,
			token: GITLAB_TOKEN,
			projectId: Number(GITLAB_PROJECT_ID),
			repo: GITLAB_REPO,
			authorUsername: GITLAB_AUTHOR_USERNAME
		}
	};
}
