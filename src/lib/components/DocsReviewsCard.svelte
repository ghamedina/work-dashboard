<script lang="ts">
	import Table from './Table.svelte';
	import TableHeaderRow from './TableHeaderRow.svelte';
	import TableBodyRow from './TableBodyRow.svelte';
	import type { ConfluenceStarredPage } from '$lib/types';

	interface Props {
		pages: ConfluenceStarredPage[];
	}

	let { pages }: Props = $props();

	const anyApprox = $derived(pages.some((p) => p.starredAtIsApprox));

	function openLink(url: string) {
		window.open(url, '_blank', 'noopener');
	}

	function relativeTime(ms: number): string {
		if (!ms) return '—';
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

<div class="docs-header">
	<h2>Doc Reviews{pages.length > 0 ? ` (${pages.length})` : ''}</h2>
	{#if anyApprox}
		<span class="docs-subtitle">(filtered by page update date — Confluence didn't expose star date)</span>
	{/if}
</div>

<Table>
	<TableHeaderRow>
		<th class="col-space">Space</th>
		<th>Title</th>
		<th class="col-time">Starred</th>
	</TableHeaderRow>
	<tbody>
		{#each pages as p (p.id)}
			<TableBodyRow>
				<td class="col-space" title={p.spaceName}>{p.spaceName || '—'}</td>
				<td class="title-cell">
					<button class="title-link" onclick={() => openLink(p.webUrl)} title={p.title}>
						{p.title}
					</button>
				</td>
				<td class="col-time">{relativeTime(p.starredAt)}</td>
			</TableBodyRow>
		{/each}
		{#if pages.length === 0}
			<TableBodyRow>
				<td colspan="3" class="empty-state">
					No Confluence pages starred in the configured window.
				</td>
			</TableBodyRow>
		{/if}
	</tbody>
</Table>

<style>
	.docs-header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}

	.docs-header h2 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.docs-subtitle {
		font-size: 11px;
		color: var(--color-text-muted);
		font-style: italic;
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

	.col-space {
		width: 180px;
		color: var(--color-text-muted);
		font-size: 12px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 180px;
	}

	.col-time {
		width: 100px;
		color: var(--color-text-muted);
		font-size: 12px;
		white-space: nowrap;
	}

	.title-cell {
		overflow: hidden;
	}

	.title-link {
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

	.title-link:hover {
		color: var(--color-primary);
	}

	.empty-state {
		text-align: center;
		padding: 24px;
		color: var(--color-text-muted);
		font-size: 12px;
	}
</style>
