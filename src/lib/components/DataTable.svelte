<script lang="ts">
	import { untrack } from 'svelte';
	import type { DashboardRow, RenderMode, CIPipelineStatus, UnifiedPR, MRComment, JiraDetail, JiraStatusConfig } from '$lib/types';
	import Table from './Table.svelte';
	import TableHeaderRow from './TableHeaderRow.svelte';
	import TableBodyRow from './TableBodyRow.svelte';
	import Button from './Button.svelte';
	import ModalContainer from './ModalContainer.svelte';
	import DropdownMenu from './DropdownMenu.svelte';
	import ClaudePicker from './ClaudePicker.svelte';

	interface Props {
		rows: DashboardRow[];
		mode: RenderMode;
		gitlabUnavailable?: boolean;
		jiraStatuses?: JiraStatusConfig[];
	}

	let { rows, mode, gitlabUnavailable = false, jiraStatuses = [] }: Props = $props();

	let localRows = $state(untrack(() => [...rows]));

	const statusOptionsCache = new Map<string, string[]>();

	$effect(() => {
		for (const row of localRows) {
			const key = row.jiraItem.key;
			if (statusOptionsCache.has(key)) continue;
			fetch(`/api/jira/issues/${key}/status`)
				.then((res) => res.json())
				.then((data) => {
					if (data.ok) statusOptionsCache.set(key, data.statuses);
				})
				.catch(() => {});
		}
	});

	let activeStatusKey = $state<string | null>(null);
	let statusAnchor = $state<HTMLElement | null>(null);
	let statusError = $state<{ key: string; message: string } | null>(null);
	let statusOptionsLoading = $state(false);
	let activeStatusOptions = $state<{ label: string; value: string; colorToken?: string }[]>([]);

	function buildStatusOptions(statuses: string[]): { label: string; value: string; colorToken?: string }[] {
		const configOrder = jiraStatuses.map((c) => c.label.toLowerCase());
		const sorted = [...statuses].sort((a, b) => {
			const ai = configOrder.indexOf(a.toLowerCase());
			const bi = configOrder.indexOf(b.toLowerCase());
			return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
		});
		return sorted.map((s) => ({
			label: s,
			value: s,
			colorToken: jiraStatuses.find((c) => c.label.toLowerCase() === s.toLowerCase())?.colorToken
		}));
	}

	async function openStatusDropdown(jiraKey: string, anchor: HTMLElement) {
		statusAnchor = anchor;
		activeStatusKey = jiraKey;
		statusError = null;

		if (statusOptionsCache.has(jiraKey)) {
			activeStatusOptions = buildStatusOptions(statusOptionsCache.get(jiraKey)!);
			return;
		}

		statusOptionsLoading = true;
		activeStatusOptions = [];
		try {
			const res = await fetch(`/api/jira/issues/${jiraKey}/status`);
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
			statusOptionsCache.set(jiraKey, data.statuses);
			activeStatusOptions = buildStatusOptions(data.statuses);
		} catch {
			activeStatusOptions = [];
		} finally {
			statusOptionsLoading = false;
		}
	}

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

	function prStatusLabel(pr: UnifiedPR): string {
		if (pr.state === 'draft') return 'Draft';
		if (pr.state === 'open') return 'Open';
		if (pr.state === 'merged') return 'Merged';
		if (pr.state === 'closed') return 'Closed';
		return pr.state;
	}

	function jiraStatusColorToken(status: string): string {
		const s = status.toLowerCase().trim();
		return jiraStatuses.find((c) => c.label.toLowerCase() === s)?.colorToken ?? 'status-gray';
	}

	type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'gray';

	function prStatusVariant(pr: UnifiedPR): BadgeVariant {
		if (pr.state === 'draft') return 'gray';
		if (pr.state === 'open') return 'success';
		if (pr.state === 'merged') return 'purple';
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

	function prLabel(pr: UnifiedPR): string {
		return pr.source === 'gitlab' ? `!${pr.id}` : `#${pr.id}`;
	}

	function openLink(url: string) {
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	type ActionState = 'idle' | 'loading' | 'done';
	let detailCache = $state<Record<string, JiraDetail>>({});
	let copyStates = $state<Record<string, ActionState>>({});
	let claudeStates = $state<Record<string, ActionState>>({});

	async function fetchDetail(key: string): Promise<JiraDetail> {
		if (detailCache[key]) return detailCache[key];
		const res = await fetch(`/api/jira/issues/${key}/detail`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data: JiraDetail = await res.json();
		detailCache[key] = data;
		return data;
	}

	async function handleCopy(key: string) {
		copyStates[key] = 'loading';
		try {
			const detail = await fetchDetail(key);
			await navigator.clipboard.writeText(JSON.stringify(detail, null, 2));
			copyStates[key] = 'done';
			setTimeout(() => { copyStates[key] = 'idle'; }, 3000);
		} catch {
			copyStates[key] = 'idle';
		}
	}

	let selectedBranches = $state<Record<string, string>>({});
	let activeBranchKey = $state<string | null>(null);
	let branchAnchor = $state<HTMLElement | null>(null);

	$effect(() => {
		try {
			const stored = localStorage.getItem('dashboard-selected-branches');
			if (stored) selectedBranches = JSON.parse(stored) as Record<string, string>;
		} catch {}
	});

	function getSelectedBranch(row: DashboardRow): string | null {
		return selectedBranches[row.jiraItem.key] ?? row.branches[0] ?? null;
	}

	function selectBranch(jiraKey: string, branch: string) {
		selectedBranches = { ...selectedBranches, [jiraKey]: branch };
		activeBranchKey = null;
		try {
			localStorage.setItem('dashboard-selected-branches', JSON.stringify(selectedBranches));
		} catch {}
	}

	let claudePickerOpen = $state(false);
	let claudePickerKey = $state('');
	let claudePickerBranch = $state('');
	let claudePickerBranches = $state<string[]>([]);

	function handleOpenClaude(key: string) {
		claudePickerKey = key;
		const row = localRows.find((r) => r.jiraItem.key === key);
		claudePickerBranches = row?.branches ?? [];
		claudePickerBranch = selectedBranches[key] ?? row?.branches[0] ?? '';
		claudePickerOpen = true;
	}

	function handleClaudeDone() {
		claudeStates[claudePickerKey] = 'done';
		claudePickerOpen = false;
		setTimeout(() => {
			claudeStates[claudePickerKey] = 'idle';
		}, 3000);
	}

	let expandedKeys = $state(new Set<string>());

	async function toggleExpand(key: string) {
		const next = new Set(expandedKeys);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
			fetchDetail(key).catch(() => {});
		}
		expandedKeys = next;
	}

	let totalColumns = $derived(mode === 'summary' ? 8 : 10);

	// Comments modal — keyed by "{source}:{id}"
	let modalOpen = $state(false);
	let activeModalPR = $state<UnifiedPR | null>(null);
	let commentsLoading = $state(false);
	let commentsError = $state<string | null>(null);
	let expandedCommentIds = $state(new Set<number>());
	const commentsCache = new Map<string, MRComment[]>();

	function commentsCacheKey(pr: UnifiedPR): string {
		return `${pr.source}:${pr.id}`;
	}

	function activeComments(): MRComment[] | null {
		if (!activeModalPR) return null;
		return commentsCache.get(commentsCacheKey(activeModalPR)) ?? null;
	}

	async function openComments(pr: UnifiedPR) {
		if (pr.source === 'github') {
			openLink(pr.webUrl);
			return;
		}

		activeModalPR = pr;
		expandedCommentIds = new Set();
		commentsError = null;
		modalOpen = true;

		const cacheKey = commentsCacheKey(pr);
		if (commentsCache.has(cacheKey)) return;

		commentsLoading = true;
		try {
			const params = new URLSearchParams({ mrWebUrl: pr.webUrl });
			const res = await fetch(`/api/gitlab/mrs/${pr.id}/comments?${params}`);
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}
			const comments: MRComment[] = await res.json();
			commentsCache.set(cacheKey, comments);
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

{#if gitlabUnavailable}
	<div class="vpn-banner">
		<span class="vpn-banner-icon">⚠</span>
		GitLab unavailable — Twingate VPN may not be active. MR data is hidden.
	</div>
{/if}

<div class={`table-container mode-${mode}`}>
	<Table>
		<TableHeaderRow>
			<th class="col-action"></th>
			<th>Work Item</th>
			<th class="col-summary">Summary</th>
			<th>Status</th>
			<th class="col-source"></th>
			<th>MR / PR</th>
			<th>MR Status</th>
			{#if mode !== 'summary'}
				<th>CI</th>
				<th class="col-comments">Comments</th>
			{/if}
			<th class="col-branch">Branch</th>
		</TableHeaderRow>
		<tbody>
			{#each localRows as row (row.jiraItem.key)}
				{@const copyState = copyStates[row.jiraItem.key] ?? 'idle'}
				{@const claudeState = claudeStates[row.jiraItem.key] ?? 'idle'}
				{@const rowCount = Math.max(row.prs.length, 1)}
				{@const firstPR = row.prs[0] ?? null}
				<TableBodyRow>
					<td rowspan={rowCount} class="cell-action">
						<div class="action-btns">
							<button
								class="action-btn"
								onclick={() => handleCopy(row.jiraItem.key)}
								disabled={copyState === 'loading'}
								title="Copy issue detail to clipboard"
							>
								{#if copyState === 'loading'}
									<span class="spinner-sm"></span>
								{:else if copyState === 'done'}
									<span class="copy-done">✓</span>
								{:else}
									⧉
								{/if}
							</button>
							<button
								class="action-btn"
								onclick={() => handleOpenClaude(row.jiraItem.key)}
								disabled={claudeState === 'loading'}
								title="Open in Claude terminal session"
							>
								{#if claudeState === 'loading'}
									<span class="spinner-sm"></span>
								{:else if claudeState === 'done'}
									<span class="copy-done">✓</span>
								{:else}
									✦
								{/if}
							</button>
						</div>
					</td>
					<td rowspan={rowCount}>
						<Button
							variant="link"
							label={row.jiraItem.key}
							onclick={() => openLink(row.jiraItem.url)}
						/>
					</td>
					<td rowspan={rowCount} class="col-summary">
						<div class="summary-cell">
							<button
								class="expand-btn"
								onclick={() => toggleExpand(row.jiraItem.key)}
								title={expandedKeys.has(row.jiraItem.key) ? 'Collapse' : 'Expand'}
							>
								{expandedKeys.has(row.jiraItem.key) ? '⊟' : '⊞'}
							</button>
							<span class="summary-text">{displaySummary(row.jiraItem.summary)}</span>
						</div>
					</td>
					<td rowspan={rowCount}>
						<div class="status-wrapper">
							<button
								class={`badge badge-status-${jiraStatusColorToken(row.jiraItem.status)} badge-btn`}
								onclick={(e) => {
									if (activeStatusKey === row.jiraItem.key) {
										activeStatusKey = null;
									} else {
										openStatusDropdown(row.jiraItem.key, e.currentTarget as HTMLElement);
									}
								}}
							>
								{row.jiraItem.status}
							</button>
							{#if statusError?.key === row.jiraItem.key}
								<span class="status-error">{statusError.message}</span>
							{/if}
						</div>
						<DropdownMenu
							open={activeStatusKey === row.jiraItem.key}
							anchor={activeStatusKey === row.jiraItem.key ? (statusAnchor ?? undefined) : undefined}
							items={statusOptionsLoading && activeStatusKey === row.jiraItem.key ? [{ label: '…', value: '' }] : activeStatusOptions}
							onSelect={(value) => { if (value) selectStatus(row.jiraItem.key, value); }}
							onClose={() => (activeStatusKey = null)}
						/>
					</td>
					{@render prCells(firstPR)}
					<td rowspan={rowCount} class="col-branch">
						{#if getSelectedBranch(row) !== null}
							{@const selectedBranch = getSelectedBranch(row)!}
							{@const extraCount = row.branches.length - 1}
							<div class="branch-cell">
								{#if row.branches.length > 1}
									<button
										class="badge badge-gray badge-btn branch-badge"
										onclick={(e) => {
											if (activeBranchKey === row.jiraItem.key) {
												activeBranchKey = null;
											} else {
												branchAnchor = e.currentTarget as HTMLElement;
												activeBranchKey = row.jiraItem.key;
											}
										}}
									>{selectedBranch}</button>
									<span class="branch-extra">+{extraCount}</span>
								{:else}
									<span class="badge badge-gray branch-badge">{selectedBranch}</span>
								{/if}
								<DropdownMenu
									open={activeBranchKey === row.jiraItem.key}
									anchor={activeBranchKey === row.jiraItem.key ? (branchAnchor ?? undefined) : undefined}
									items={row.branches.map((b) => ({ label: b, value: b }))}
									onSelect={(value) => { if (value) selectBranch(row.jiraItem.key, value); }}
									onClose={() => (activeBranchKey = null)}
								/>
							</div>
						{:else}
							<span class="empty">—</span>
						{/if}
					</td>
				</TableBodyRow>
				{#each row.prs.slice(1) as pr}
					<tr class="body-row">
						{@render prCells(pr)}
					</tr>
				{/each}
				{#if expandedKeys.has(row.jiraItem.key)}
					{@const detail = detailCache[row.jiraItem.key]}
					<tr class="expand-row">
						<td colspan={totalColumns} class="expand-cell">
							{#if !detail}
								<span class="loading-text">Loading…</span>
							{:else}
								<div class="description-body">
									{@html detail.description}
								</div>
								{#if detail.linkedIssues.length > 0}
									<table class="linked-issues-table">
										<thead>
											<tr><th>Type</th><th>Key</th><th>Summary</th><th>Status</th></tr>
										</thead>
										<tbody>
											{#each detail.linkedIssues as li}
												<tr>
													<td>{li.type}</td>
													<td>
														<button class="link-btn" onclick={() => openLink(li.url)}>{li.key}</button>
													</td>
													<td>{li.summary}</td>
													<td>{li.status}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{/if}
							{/if}
						</td>
					</tr>
				{/if}
			{/each}

			{#if rows.length === 0}
				<TableBodyRow>
					<td colspan={totalColumns} class="empty-state">No active work items found.</td>
				</TableBodyRow>
			{/if}
		</tbody>
	</Table>
</div>

{#snippet prCells(pr: UnifiedPR | null)}
	<td class="col-source">
		{#if pr}
			<span class="pr-source-badge pr-source-{pr.source}">{pr.source === 'gitlab' ? 'GL' : 'GH'}</span>
		{/if}
	</td>
	<td>
		{#if pr}
			<Button
				variant="link"
				label={prLabel(pr)}
				onclick={() => openLink(pr.webUrl)}
			/>
		{:else}
			<span class="empty">—</span>
		{/if}
	</td>
	<td>
		{#if pr}
			<span class={`badge badge-${prStatusVariant(pr)}`}>
				{prStatusLabel(pr)}
			</span>
		{:else}
			<span class="empty">—</span>
		{/if}
	</td>
	{#if mode !== 'summary'}
		<td>
			{#if pr && pr.ciStatus !== 'none'}
				<span class={`badge badge-${ciVariant(pr.ciStatus)}`}>
					{ciLabel(pr.ciStatus)}
				</span>
			{:else}
				<span class="empty">—</span>
			{/if}
		</td>
		<td class="col-comments">
			{#if pr && pr.commentCount > 0}
				<Button
					variant="link"
					label={String(pr.commentCount)}
					onclick={() => openComments(pr)}
				/>
			{:else}
				<span class="empty">—</span>
			{/if}
		</td>
	{/if}
{/snippet}

<ClaudePicker bind:open={claudePickerOpen} jiraKey={claudePickerKey} selectedBranch={claudePickerBranch} branches={claudePickerBranches} onDone={handleClaudeDone} />

<ModalContainer bind:open={modalOpen}>
	{#snippet title()}
		{#if activeModalPR}
			<span class="modal-mr-title">{activeModalPR.title}</span>
			<button
				class="modal-mr-link"
				onclick={() => openLink(activeModalPR!.webUrl)}
				aria-label="Open MR in GitLab"
			>
				{prLabel(activeModalPR)}
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
	.vpn-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: var(--color-warning-muted);
		color: var(--color-warning);
		font-size: 12px;
		border-bottom: 1px solid var(--color-border);
	}

	.vpn-banner-icon {
		font-size: 14px;
		flex-shrink: 0;
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
		padding: 6px 12px;
		vertical-align: middle;
	}

	.mode-compact td {
		padding: 8px 12px;
	}

	.mode-relaxed td {
		padding: 14px 12px;
	}

	.col-action {
		width: 54px;
		padding: 0 4px;
	}

	.cell-action {
		padding: 0 4px;
		text-align: center;
	}

	.action-btns {
		display: flex;
		gap: 2px;
		justify-content: center;
	}

	.action-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 14px;
		color: var(--color-text-muted);
		padding: 2px 4px;
		border-radius: var(--radius);
		font-family: inherit;
		line-height: 1;
		transition: color 0.1s ease;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
	}

	.action-btn:hover:not(:disabled) {
		color: var(--color-primary);
	}

	.action-btn:disabled {
		cursor: default;
	}

	.copy-done {
		color: var(--color-success);
	}

	.spinner-sm {
		display: inline-block;
		width: 10px;
		height: 10px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.col-summary {
		width: 40%;
	}

	.summary-cell {
		display: flex;
		align-items: center;
		gap: 6px;
		overflow: hidden;
	}

	.expand-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 13px;
		color: var(--color-text-muted);
		padding: 0;
		line-height: 1;
		flex-shrink: 0;
		font-family: inherit;
		transition: color 0.1s ease;
	}

	.expand-btn:hover {
		color: var(--color-primary);
	}

	.summary-text {
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.expand-row td {
		border-bottom: 1px solid var(--color-border);
		padding: 0;
	}

	.expand-cell {
		padding: 12px 16px !important;
		background: var(--color-gray-muted);
	}

	.description-body {
		font-size: 13px;
		color: var(--color-text);
		line-height: 1.5;
		max-height: 300px;
		overflow-y: auto;
		margin-bottom: 12px;
	}

	.description-body :global(p) {
		margin: 0 0 8px;
	}

	.description-body :global(ul),
	.description-body :global(ol) {
		margin: 0 0 8px;
		padding-left: 20px;
	}

	.loading-text {
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.linked-issues-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
		margin-top: 4px;
	}

	.linked-issues-table th {
		padding: 4px 8px;
		background: var(--color-border);
		color: var(--color-text-muted);
		font-size: 10px;
		text-align: left;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.linked-issues-table td {
		padding: 4px 8px;
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.col-comments {
		text-align: center;
	}

	.col-branch {
		max-width: 180px;
	}

	.branch-cell {
		display: flex;
		align-items: center;
		gap: 4px;
		position: relative;
	}

	.branch-badge {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		display: inline-block;
		vertical-align: middle;
	}

	.branch-extra {
		font-size: 11px;
		color: var(--color-text-muted);
		white-space: nowrap;
		flex-shrink: 0;
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
		display: inline-flex;
		flex-direction: column;
		gap: 2px;
	}

	.badge-status-gray { background: var(--status-gray-bg); color: var(--status-gray-text); }
	.badge-status-blue { background: var(--status-blue-bg); color: var(--status-blue-text); }
	.badge-status-teal { background: var(--status-teal-bg); color: var(--status-teal-text); }
	.badge-status-teal-green { background: var(--status-teal-green-bg); color: var(--status-teal-green-text); }
	.badge-status-yellow-green { background: var(--status-yellow-green-bg); color: var(--status-yellow-green-text); }
	.badge-status-green { background: var(--status-green-bg); color: var(--status-green-text); }
	.badge-status-red { background: var(--status-red-bg); color: var(--status-red-text); }

	.badge-btn {
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

	.col-source {
		width: 36px;
		text-align: center;
		padding-left: 4px;
		padding-right: 4px;
	}

	.pr-source-badge {
		display: inline-flex;
		align-items: center;
		padding: 1px 5px;
		border-radius: var(--radius);
		font-size: 10px;
		font-weight: 600;
		margin-right: 4px;
		vertical-align: middle;
	}

	.pr-source-gitlab {
		background: var(--color-warning-muted);
		color: var(--color-warning);
	}

	.pr-source-github {
		background: var(--color-primary-muted);
		color: var(--color-primary);
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
