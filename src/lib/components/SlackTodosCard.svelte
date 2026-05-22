<script lang="ts">
	import Table from './Table.svelte';
	import TableHeaderRow from './TableHeaderRow.svelte';
	import TableBodyRow from './TableBodyRow.svelte';
	import type { SlackTodo } from '$lib/types';

	interface Props {
		todos: SlackTodo[];
		emojiName: string;
	}

	let { todos, emojiName }: Props = $props();

	function openLink(url: string) {
		window.open(url, '_blank', 'noopener');
	}

	function relativeTime(ms: number): string {
		const diff = Date.now() - ms;
		const sec = Math.floor(diff / 1000);
		if (sec < 60) return 'just now';
		const min = Math.floor(sec / 60);
		if (min < 60) return `${min}m ago`;
		const hr = Math.floor(min / 60);
		if (hr < 24) return `${hr}h ago`;
		const day = Math.floor(hr / 24);
		if (day < 30) return `${day}d ago`;
		return new Date(ms).toLocaleDateString();
	}
</script>

<div class="slack-header">
	<h2>Slack Todos{todos.length > 0 ? ` (${todos.length})` : ''}</h2>
	<span class="slack-subtitle">Messages you reacted to with :{emojiName}:</span>
</div>

<Table>
	<TableHeaderRow>
		<th class="col-channel">Channel</th>
		<th>Message</th>
		<th class="col-author">Author</th>
		<th class="col-time">Reacted</th>
	</TableHeaderRow>
	<tbody>
		{#each todos as t (t.permalink)}
			<TableBodyRow>
				<td class="col-channel" title={t.channelName}>{t.channelName}</td>
				<td class="message-cell">
					<button class="message-link" onclick={() => openLink(t.permalink)} title={t.text}>
						{t.text || '(no text)'}
					</button>
				</td>
				<td class="col-author">{t.authorName}</td>
				<td class="col-time">{relativeTime(t.reactedAt)}</td>
			</TableBodyRow>
		{/each}
		{#if todos.length === 0}
			<TableBodyRow>
				<td colspan="4" class="empty-state">
					No Slack messages with the :{emojiName}: reaction.
				</td>
			</TableBodyRow>
		{/if}
	</tbody>
</Table>

<style>
	.slack-header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}

	.slack-header h2 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.slack-subtitle {
		font-size: 12px;
		color: var(--color-text-muted);
	}

	th {
		text-align: left;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		white-space: nowrap;
		padding: 8px 12px;
	}

	td {
		border-bottom: 1px solid var(--color-border);
		padding: 8px 12px;
		vertical-align: middle;
	}

	.col-channel {
		width: 200px;
		color: var(--color-text-muted);
		font-size: 12px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 200px;
	}

	.col-author {
		width: 140px;
		color: var(--color-text-muted);
		font-size: 12px;
	}

	.col-time {
		width: 100px;
		color: var(--color-text-muted);
		font-size: 12px;
		white-space: nowrap;
	}

	.message-cell {
		overflow: hidden;
	}

	.message-link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		display: inline-block;
	}

	.message-link:hover {
		color: var(--color-primary);
	}

	.empty-state {
		text-align: center;
		padding: 24px;
		color: var(--color-text-muted);
		font-size: 12px;
	}
</style>
