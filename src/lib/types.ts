export type RenderMode = 'summary' | 'compact' | 'relaxed';

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
}

export type CIPipelineStatus =
	| 'success'
	| 'failed'
	| 'running'
	| 'pending'
	| 'canceled'
	| 'skipped'
	| 'none';

export interface DashboardRow {
	jiraItem: JiraWorkItem;
	mr: GitLabMR | null;
	ciStatus: CIPipelineStatus;
	branches: string[];
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

export interface FlagSwitcherRowData {
	id: string;
	flagKey: string;
	flag: AmplitudeFlag | null;
	segmentName: string;
	email: string;
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
