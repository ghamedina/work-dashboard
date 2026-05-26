import type { DashboardConfig } from '$lib/config';
import type { SlackTodo } from '$lib/types';

const SLACK_API = 'https://slack.com/api';

interface SlackReaction {
	name: string;
	users: string[];
	count: number;
}

interface SlackMessage {
	type: string;
	user?: string;
	text?: string;
	ts: string;
	reactions?: SlackReaction[];
}

interface SlackReactionsListItem {
	type: 'message' | 'file' | 'file_comment';
	channel?: string;
	message?: SlackMessage;
}

interface SlackReactionsListResponse {
	ok: boolean;
	error?: string;
	items?: SlackReactionsListItem[];
	response_metadata?: { next_cursor?: string };
}

interface SlackAuthTestResponse {
	ok: boolean;
	error?: string;
	user_id?: string;
}

interface SlackConversation {
	id: string;
	name?: string;
	is_im?: boolean;
	is_mpim?: boolean;
	is_private?: boolean;
	user?: string;
}

interface SlackConversationsInfoResponse {
	ok: boolean;
	error?: string;
	channel?: SlackConversation;
}

interface SlackUser {
	id: string;
	name?: string;
	real_name?: string;
	profile?: { display_name?: string; real_name?: string };
}

interface SlackUsersInfoResponse {
	ok: boolean;
	error?: string;
	user?: SlackUser;
}

export async function fetchSlackTodos(config: DashboardConfig): Promise<SlackTodo[]> {
	if (!config.slack) throw new Error('Slack is not configured');
	const { token, emojiName, since, workspaceSubdomain } = config.slack;

	const sinceMs = Date.parse(since);
	if (Number.isNaN(sinceMs)) {
		throw new Error(`Invalid slack.since date: ${since}`);
	}

	const myUserId = await fetchMyUserId(token);
	const items = await fetchAllReactionItems(token);

	const matching = items.filter((item) => {
		if (item.type !== 'message' || !item.message) return false;
		const hit = item.message.reactions?.find(
			(r) => r.name === emojiName && r.users.includes(myUserId)
		);
		if (!hit) return false;
		const messageMs = Number(item.message.ts) * 1000;
		return Number.isFinite(messageMs) && messageMs >= sinceMs;
	});

	if (matching.length === 0) return [];

	const channelIds = new Set<string>();
	const userIds = new Set<string>();
	for (const item of matching) {
		if (item.channel) channelIds.add(item.channel);
		if (item.message?.user) userIds.add(item.message.user);
	}

	const channelsById = await resolveChannels(token, [...channelIds]);
	for (const ch of channelsById.values()) {
		if (ch.is_im && ch.user) userIds.add(ch.user);
	}

	const usersById = await resolveUsers(token, [...userIds]);

	const todos: SlackTodo[] = matching.map((item) => {
		const message = item.message!;
		const channelId = item.channel ?? '';
		const channel = channelsById.get(channelId);
		const authorId = message.user ?? '';
		const author = usersById.get(authorId);

		return {
			channelId,
			channelName: formatChannelName(channel, usersById),
			authorName: formatUserName(author) || authorId || 'Unknown',
			text: message.text ?? '',
			permalink: buildPermalink(workspaceSubdomain, channelId, message.ts),
			ts: message.ts,
			reactedAt: Number(message.ts) * 1000
		};
	});

	return todos.sort((a, b) => b.reactedAt - a.reactedAt);
}

async function slackGet<T>(token: string, method: string, params: Record<string, string>): Promise<T> {
	const url = new URL(`${SLACK_API}/${method}`);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!response.ok) {
		throw new Error(`Slack ${method} HTTP ${response.status}`);
	}

	const data = (await response.json()) as T & { ok: boolean; error?: string };
	if (!data.ok) {
		throw new Error(`Slack ${method} error: ${data.error ?? 'unknown'}`);
	}
	return data;
}

async function fetchMyUserId(token: string): Promise<string> {
	const data = await slackGet<SlackAuthTestResponse>(token, 'auth.test', {});
	if (!data.user_id) throw new Error('Slack auth.test returned no user_id');
	return data.user_id;
}

async function fetchAllReactionItems(token: string): Promise<SlackReactionsListItem[]> {
	const items: SlackReactionsListItem[] = [];
	let cursor: string | undefined;
	do {
		const params: Record<string, string> = { limit: '200' };
		if (cursor) params.cursor = cursor;
		try {
			const data = await slackGet<SlackReactionsListResponse>(token, 'reactions.list', params);
			if (data.items) items.push(...data.items);
			cursor = data.response_metadata?.next_cursor || undefined;
		} catch (err) {
			// reactions.list is known-flaky deep into pagination (`internal_error` on
			// older pages). Items are returned newest-first, so anything within the
			// `since` window will be in the early pages — stop paginating instead of
			// failing the whole fetch.
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('internal_error')) {
				console.warn(`Slack reactions.list paginated to a flaky page (${msg}); returning ${items.length} items collected so far`);
				break;
			}
			throw err;
		}
	} while (cursor);
	return items;
}

async function resolveChannels(
	token: string,
	ids: string[]
): Promise<Map<string, SlackConversation>> {
	const results = await Promise.allSettled(
		ids.map((id) =>
			slackGet<SlackConversationsInfoResponse>(token, 'conversations.info', { channel: id })
		)
	);
	const map = new Map<string, SlackConversation>();
	results.forEach((r, i) => {
		if (r.status === 'fulfilled' && r.value.channel) {
			map.set(ids[i], r.value.channel);
		}
	});
	return map;
}

async function resolveUsers(token: string, ids: string[]): Promise<Map<string, SlackUser>> {
	const results = await Promise.allSettled(
		ids.map((id) => slackGet<SlackUsersInfoResponse>(token, 'users.info', { user: id }))
	);
	const map = new Map<string, SlackUser>();
	results.forEach((r, i) => {
		if (r.status === 'fulfilled' && r.value.user) {
			map.set(ids[i], r.value.user);
		}
	});
	return map;
}

function formatChannelName(
	channel: SlackConversation | undefined,
	usersById: Map<string, SlackUser>
): string {
	if (!channel) return 'unknown';
	if (channel.is_im) {
		const other = channel.user ? usersById.get(channel.user) : undefined;
		return `DM with ${formatUserName(other) || channel.user || 'unknown'}`;
	}
	if (channel.is_mpim) return channel.name ? `Group DM: ${channel.name}` : 'Group DM';
	const prefix = channel.is_private ? '🔒' : '#';
	return `${prefix}${channel.name ?? 'unknown'}`;
}

function formatUserName(user: SlackUser | undefined): string {
	if (!user) return '';
	return (
		user.profile?.display_name ||
		user.profile?.real_name ||
		user.real_name ||
		user.name ||
		''
	);
}

function buildPermalink(subdomain: string, channelId: string, ts: string): string {
	return `https://${subdomain}.slack.com/archives/${channelId}/p${ts.replace('.', '')}`;
}
