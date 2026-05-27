export type RenderMode = 'summary' | 'compact' | 'relaxed';

export interface TeamMember {
	name?: string;
	jiraEmail?: string;
	gitlabAuthorUsername?: string;
	githubAuthorUsername?: string;
}

export interface JiraStatusConfig {
	label: string;
	colorToken: string;
}

export interface JiraWorkItem {
	key: string;
	summary: string;
	status: string;
	url: string;
}

export interface GitLabMR {
	iid: number;
	title: string;
	state: 'opened' | 'merged' | 'closed';
	draft: boolean;
	webUrl: string;
	userNotesCount: number;
	labels: string[];
	description: string;
}

export type CIPipelineStatus =
	| 'success'
	| 'failed'
	| 'running'
	| 'pending'
	| 'canceled'
	| 'skipped'
	| 'none';

export interface CIPipelineJob {
	id: number;
	name: string;
	status: string;
	webUrl: string;
}

export interface UnifiedPR {
	source: 'gitlab' | 'github';
	id: number;
	title: string;
	state: 'open' | 'draft' | 'merged' | 'closed';
	webUrl: string;
	commentCount: number;
	ciStatus: CIPipelineStatus;
	labels: string[];
	description: string;
	pipelineWebUrl: string | null;
	pipelineJobs: CIPipelineJob[];
}

export interface DashboardRow {
	jiraItem: JiraWorkItem;
	prs: UnifiedPR[];
	branches: string[];
}

export type ReviewState = 'pending' | 'approved' | 'changes_requested' | 'commented';

export interface ReviewItem {
	source: 'gitlab' | 'github';
	id: number;
	title: string;
	webUrl: string;
	author: string;
	repo: string;
	myReviewState: ReviewState;
}

export interface ReviewSourceError {
	source: string;
	message: string;
}

export interface ReviewsData {
	items: ReviewItem[];
	errors: ReviewSourceError[];
}

export interface SlackTodo {
	channelId: string;
	channelName: string;
	authorName: string;
	text: string;
	permalink: string;
	ts: string;
	reactedAt: number;
}

export interface ConfluenceStarredPage {
	id: string;
	title: string;
	spaceName: string;
	webUrl: string;
	starredAt: number;
	starredAtIsApprox: boolean;
}

export interface AmplitudeSegmentCondition {
	prop: string;
	op: string;
	type: string;
	values: string[];
}

export interface AmplitudeTargetSegment {
	name: string;
	conditions: AmplitudeSegmentCondition[];
	percentage: number;
	bucketingKey: string;
	rolloutWeights: Record<string, number>;
}

export interface AmplitudeFlag {
	id: string;
	projectId: string;
	projectName: string;
	key: string;
	name: string;
	enabled: boolean;
	targetSegments: AmplitudeTargetSegment[];
	variants: Array<{ key: string; name: string }>;
}

export interface MRComment {
	id: number;
	body: string;
	webUrl: string;
}

export interface FlagSwitcherProjectData {
	segmentName: string;
	email: string;
}

export interface FlagSwitcherRowData {
	id: string;
	flagKey: string;
	projectId: string;
	flag: AmplitudeFlag | null;
	segmentName: string;
	email: string;
	projectData: Record<string, FlagSwitcherProjectData>;
}

export interface JiraDetail {
	summary: string;
	description: string;
	status: string;
	assignee: string | null;
	reporter: string | null;
	priority: string | null;
	issuetype: string;
	labels: string[];
	created: string;
	updated: string;
	linkedIssues: Array<{ type: string; key: string; summary: string; status: string; url: string }>;
	comments: Array<{ author: string; body: string; created: string }>;
}

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'gray';

export function jiraStatusVariant(status: string): BadgeVariant {
	const s = status.toLowerCase();
	if (s.includes('progress')) return 'primary';
	if (s.includes('review')) return 'purple';
	if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'success';
	if (s.includes('blocked')) return 'danger';
	if (s.includes('open') || s.includes('to do') || s.includes('backlog')) return 'warning';
	return 'gray';
}

export interface TeamConfig {
	name: string;
	jiraProjectKeys: string[];        // empty array → no auto-pull
	members: TeamMember[];            // empty array → no auto-pull
}

export interface WeeklyJiraTicket {
	key: string;
	summary: string;
	status: string;
	statusCategory: 'To Do' | 'In Progress' | 'Done' | 'Other';
	assigneeName: string | null;
	updated: string;                  // ISO timestamp
	url: string;
}

export interface WeeklyPR {
	source: 'gitlab' | 'github';
	id: number;
	title: string;
	authorUsername: string;
	state: 'merged' | 'opened' | 'updated';   // bucket the PR falls in for the week
	webUrl: string;
	repo: string;                              // gitlab.repo or owner/name
	mergedAt: string | null;
	updatedAt: string;
}

export interface WeeklyTeamActivity {
	teamName: string;
	autoPull: boolean;                         // false if jiraProjectKeys empty
	jira: {
		done: WeeklyJiraTicket[];
		inFlight: WeeklyJiraTicket[];
		started: WeeklyJiraTicket[];
	} | null;
	prs: {
		merged: WeeklyPR[];
		opened: WeeklyPR[];
		updated: WeeklyPR[];
	} | null;
}
