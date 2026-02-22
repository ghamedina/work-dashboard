<script lang="ts">
	import { untrack } from 'svelte';
	import type { DashboardRow, RenderMode, CIPipelineStatus, MRComment } from '$lib/types';
	import Table from './Table.svelte';
	import TableHeaderRow from './TableHeaderRow.svelte';
	import TableBodyRow from './TableBodyRow.svelte';
	import Button from './Button.svelte';
	import ModalContainer from './ModalContainer.svelte';
	import DropdownMenu from './DropdownMenu.svelte';

	interface Props {
		rows: DashboardRow[];
		mode: RenderMode;
	}

	let { rows, mode }: Props = $props();

	let localRows = $state(untrack(() => [...rows]));

	let statusOptions = $derived(
		[...new Set(localRows.map((r) => r.jiraItem.status))].sort().map((s) => ({ label: s, value: s }))
	);

	let activeStatusKey = $state<string | null>(null);
	let statusError = $state<{ key: string; message: string } | null>(null);

	async function selectStatus(jiraKey: string, statusName: string) {
		const rowIdx = localRows.findIndex((r) => r.jiraItem.key === jiraKey);
		if (rowIdx === -1) return;

		const previousStatus = localRows[rowIdx].jiraItem.status;
		activeStatusKey = null;

		localRows[rowIdx] = {
			...localRows[rowIdx],
			jiraItem: { ...localRows[rowIdx].jiraItem, status: statusName }
		};
		statusError = null;

		try {
			const res = await fetch(`/api/jira/issues/${jiraKey}/status`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ statusName })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data.ok) {
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}
		} catch (err) {
			localRows[rowIdx] = {
				...localRows[rowIdx],
				jiraItem: { ...localRows[rowIdx].jiraItem, status: previousStatus }
			};
			statusError = {
				key: jiraKey,
				message: err instanceof Error ? err.message : 'Update failed'
			};
		}
	}

	function truncateSummary(summary: string, maxLen: number): string {
		if (summary.length <= maxLen) return summary;
		return summary.slice(0, maxLen - 1) + '…';
	}

	const summaryMaxLength: Record<RenderMode, number> = {
		summary: 40,
		compact: 80,
		relaxed: Infinity
	};

	function displaySummary(summary: string): string {
		const maxLen = summaryMaxLength[mode];
		return truncateSummary(summary, maxLen);
	}

	function mrStatusLabel(row: DashboardRow): string {
		if (!row.mr) return '—';
		if (row.mr.draft) return 'Draft';
		if (row.mr.state === 'opened') return 'Open';
		if (row.mr.state === 'merged') return 'Merged';
		if (row.mr.state === 'closed') return 'Closed';
		return row.mr.state;
	}

	type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'gray';

	function jiraStatusVariant(status: string): BadgeVariant {
		const s = status.toLowerCase();
		if (s.includes('progress')) return 'primary';
		if (s.includes('review')) return 'purple';
		if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'success';
		if (s.includes('blocked')) return 'danger';
		return 'gray';
	}

	function mrStatusVariant(row: DashboardRow): BadgeVariant {
		if (!row.mr) return 'gray';
		if (row.mr.draft) return 'gray';
		if (row.mr.state === 'opened') return 'success';
		if (row.mr.state === 'merged') return 'purple';
		return 'gray';
	}

	function ciVariant(status: CIPipelineStatus): BadgeVariant {
		if (status === 'success') return 'success';
		if (status === 'failed') return 'danger';
		if (status === 'running') return 'primary';
		if (status === 'pending') return 'warning';
		return 'gray';
	}

	function ciLabel(status: CIPipelineStatus): string {
		if (status === 'none') return '—';
		return status.charAt(0).toUpperCase() + status.slice(1);
	}

	function openLink(url: string) {
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	// Comments modal state
	let modalOpen = $state(false);
	let activeModalRow = $state<DashboardRow | null>(null);
	let commentsLoading = $state(false);
	let commentsError = $state<string | null>(null);
	let expandedCommentIds = $state(new Set<number>());
	const commentsCache = new Map<number, MRComment[]>();

	function activeComments(): MRComment[] | null {
		if (!activeModalRow?.mr) return null;
		return commentsCache.get(activeModalRow.mr.iid) ?? null;
	}

	async function openComments(row: DashboardRow) {
		if (!row.mr) return;
		activeModalRow = row;
		expandedCommentIds = new Set();
		commentsError = null;
		modalOpen = true;

		const { iid } = row.mr;
		if (commentsCache.has(iid)) return;

		commentsLoading = true;
		try {
			const params = new URLSearchParams({ mrWebUrl: row.mr.webUrl });
			const res = await fetch(`/api/gitlab/mrs/${iid}/comments?${params}`);
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}
			const comments: MRComment[] = await res.json();
			commentsCache.set(iid, comments);
		} catch (err) {
			commentsError = err instanceof Error ? err.message : 'Failed to load comments';
		} finally {
			commentsLoading = false;
		}
	}

	function toggleCommentExpanded(id: number) {
		const next = new Set(expandedCommentIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedCommentIds = next;
	}
</script>

<div class={`table-container mode-${mode}`}>
	<Table>
		<TableHeaderRow>
			<th>Work Item</th>
			<th class="col-summary">Summary</th>
			<th>Status</th>
			<th>MR</th>
			<th>MR Status</th>
			{#if mode !== 'summary'}
				<th>CI</th>
				<th class="col-comments">Comments</th>
			{/if}
		</TableHeaderRow>
		<tbody>
			{#each localRows as row (row.jiraItem.key)}
				<TableBodyRow>
					<td>
						<Button
							variant="link"
							label={row.jiraItem.key}
							onclick={() => openLink(row.jiraItem.url)}
						/>
					</td>
					<td class="col-summary summary-text">
						{displaySummary(row.jiraItem.summary)}
					</td>
					<td>
						<div class="status-wrapper">
							<button
								class={`badge badge-${jiraStatusVariant(row.jiraItem.status)} badge-btn`}
								onclick={() => {
									activeStatusKey =
										activeStatusKey === row.jiraItem.key ? null : row.jiraItem.key;
									statusError = null;
								}}
							>
								{row.jiraItem.status}
							</button>
							{#if statusError?.key === row.jiraItem.key}
								<span class="status-error">{statusError.message}</span>
							{/if}
							<DropdownMenu
								open={activeStatusKey === row.jiraItem.key}
								items={statusOptions}
								onSelect={(value) => selectStatus(row.jiraItem.key, value)}
								onClose={() => (activeStatusKey = null)}
							/>
						</div>
					</td>
					<td>
						{#if row.mr}
							<Button
								variant="link"
								label={`!${row.mr.iid}`}
								onclick={() => openLink(row.mr!.webUrl)}
							/>
						{:else}
							<span class="empty">—</span>
						{/if}
					</td>
					<td>
						{#if row.mr}
							<span class={`badge badge-${mrStatusVariant(row)}`}>
								{mrStatusLabel(row)}
							</span>
						{:else}
							<span class="empty">—</span>
						{/if}
					</td>
					{#if mode !== 'summary'}
						<td>
							{#if row.ciStatus !== 'none'}
								<span class={`badge badge-${ciVariant(row.ciStatus)}`}>
									{ciLabel(row.ciStatus)}
								</span>
							{:else}
								<span class="empty">—</span>
							{/if}
						</td>
						<td class="col-comments">
							{#if row.mr && row.mr.userNotesCount > 0}
								<Button
									variant="link"
									label={String(row.mr.userNotesCount)}
									onclick={() => openComments(row)}
								/>
							{:else}
								<span class="empty">—</span>
							{/if}
						</td>
					{/if}
				</TableBodyRow>
			{/each}

			{#if rows.length === 0}
				<TableBodyRow>
					<td colspan="7" class="empty-state">No active work items found.</td>
				</TableBodyRow>
			{/if}
		</tbody>
	</Table>
</div>

<ModalContainer bind:open={modalOpen}>
	{#snippet title()}
		{#if activeModalRow?.mr}
			<span class="modal-mr-title">{activeModalRow.mr.title}</span>
			<button
				class="modal-mr-link"
				onclick={() => openLink(activeModalRow!.mr!.webUrl)}
				aria-label="Open MR in GitLab"
			>
				!{activeModalRow.mr.iid}
			</button>
		{/if}
	{/snippet}

	{#snippet children()}
		{#if commentsLoading}
			<p class="modal-status">Loading comments…</p>
		{:else if commentsError}
			<p class="modal-error">{commentsError}</p>
		{:else}
			{@const comments = activeComments()}
			{#if comments && comments.length > 0}
				<table class="comments-table">
					<thead>
						<tr>
							<th class="col-num">#</th>
							<th class="col-body">Comment</th>
							<th class="col-link"></th>
						</tr>
					</thead>
					<tbody>
						{#each comments as comment, i (comment.id)}
							<tr>
								<td class="col-num">{i + 1}</td>
								<td
									class={`col-body comment-text ${expandedCommentIds.has(comment.id) ? 'expanded' : ''}`}
									onclick={() => toggleCommentExpanded(comment.id)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && toggleCommentExpanded(comment.id)}
								>
									{comment.body}
								</td>
								<td class="col-link">
									<button
										class="link-btn"
										onclick={() => openLink(comment.webUrl)}
										aria-label="Open comment in GitLab"
									>
										↗
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else if comments}
				<p class="modal-status">No comments.</p>
			{/if}
		{/if}
	{/snippet}
</ModalContainer>

<style>
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
		padding: 6px 12px;
		vertical-align: middle;
	}

	.mode-compact td {
		padding: 8px 12px;
	}

	.mode-relaxed td {
		padding: 14px 12px;
	}

	.col-summary {
		width: 40%;
	}

	.summary-text {
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 0;
	}

	.col-comments {
		text-align: center;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: var(--radius);
		font-size: 11px;
		font-weight: 500;
		white-space: nowrap;
	}

	.badge-primary {
		background: var(--color-primary-muted);
		color: var(--color-primary);
	}

	.badge-success {
		background: var(--color-success-muted);
		color: var(--color-success);
	}

	.badge-warning {
		background: var(--color-warning-muted);
		color: var(--color-warning);
	}

	.badge-danger {
		background: var(--color-danger-muted);
		color: var(--color-danger);
	}

	.badge-purple {
		background: var(--color-purple-muted);
		color: var(--color-purple);
	}

	.badge-gray {
		background: var(--color-gray-muted);
		color: var(--color-text-muted);
	}

	.status-wrapper {
		position: relative;
		display: inline-flex;
		flex-direction: column;
		gap: 2px;
	}

	.badge-btn {
		background: none;
		border: none;
		font-family: inherit;
		cursor: pointer;
		padding: 2px 8px;
		transition: filter 0.1s ease;
	}

	.badge-btn:hover {
		filter: brightness(0.88);
	}

	.status-error {
		font-size: 10px;
		color: var(--color-danger);
		white-space: nowrap;
	}

	.empty {
		color: var(--color-text-muted);
	}

	.empty-state {
		text-align: center;
		color: var(--color-text-muted);
		padding: 32px;
	}

	/* Modal header */
	.modal-mr-title {
		font-weight: 600;
		color: var(--color-text);
		margin-right: 8px;
	}

	.modal-mr-link {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		background: var(--color-primary-muted);
		color: var(--color-primary);
		border: none;
		border-radius: var(--radius);
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		transition: filter 0.1s ease;
		flex-shrink: 0;
	}

	.modal-mr-link:hover {
		filter: brightness(0.92);
	}

	/* Modal body */
	.modal-status {
		color: var(--color-text-muted);
		font-size: 13px;
		margin: 0;
	}

	.modal-error {
		color: var(--color-danger);
		font-size: 13px;
		margin: 0;
	}

	.comments-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	.comments-table th {
		padding: 6px 10px;
		background: var(--color-gray-muted);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-size: 11px;
	}

	.comments-table td {
		padding: 8px 10px;
		border-bottom: 1px solid var(--color-border);
		vertical-align: top;
	}

	.col-num {
		width: 36px;
		text-align: center;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.col-body {
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 500px;
	}

	.col-body.expanded {
		white-space: normal;
		overflow: visible;
		text-overflow: unset;
	}

	.col-body:hover {
		color: var(--color-primary);
	}

	.col-link {
		width: 36px;
		text-align: center;
		flex-shrink: 0;
	}

	.link-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 14px;
		color: var(--color-text-muted);
		padding: 2px 4px;
		border-radius: var(--radius);
		font-family: inherit;
		transition: color 0.1s ease;
	}

	.link-btn:hover {
		color: var(--color-primary);
	}
</style>
