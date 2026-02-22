<script lang="ts">
	import { onMount } from 'svelte';
	import type { AmplitudeFlag, FlagSwitcherRowData } from '$lib/types';
	import FlagSwitcherRow from './FlagSwitcherRow.svelte';
	import Button from './Button.svelte';
	import Table from './Table.svelte';
	import TableHeaderRow from './TableHeaderRow.svelte';

	const STORAGE_KEY = 'flagSwitcherRows';

	type PersistedRow = Pick<FlagSwitcherRowData, 'id' | 'flagKey' | 'segmentName' | 'email'>;

	let rows = $state<FlagSwitcherRowData[]>([]);
	let flags = $state<AmplitudeFlag[]>([]);
	let flagsLoading = $state(false);
	let flagsError = $state<string | null>(null);

	onMount(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored) as PersistedRow[];
				rows = parsed.map((r) => ({ ...r, flag: null }));
			} catch {
				// ignore malformed storage
			}
		}
		fetchFlags();
	});

	async function fetchFlags() {
		flagsLoading = true;
		flagsError = null;
		try {
			const res = await fetch('/api/amplitude/flags');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			flags = (await res.json()) as AmplitudeFlag[];
		} catch (err) {
			flagsError = err instanceof Error ? err.message : 'Failed to load flags';
		} finally {
			flagsLoading = false;
		}
	}

	function persistRows() {
		const toStore: PersistedRow[] = rows.map(({ id, flagKey, segmentName, email }) => ({
			id,
			flagKey,
			segmentName,
			email
		}));
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
	}

	function addRow() {
		rows = [
			...rows,
			{
				id: crypto.randomUUID(),
				flagKey: '',
				flag: null,
				segmentName: '',
				email: ''
			}
		];
		persistRows();
	}

	function updateRow(updated: FlagSwitcherRowData) {
		rows = rows.map((r) => (r.id === updated.id ? updated : r));
		persistRows();
	}

	function removeRow(id: string) {
		rows = rows.filter((r) => r.id !== id);
		persistRows();
	}

	function cloneRow(source: FlagSwitcherRowData) {
		const clone: FlagSwitcherRowData = {
			id: crypto.randomUUID(),
			flagKey: source.flagKey,
			segmentName: source.segmentName,
			email: source.email,
			flag: null
		};
		const idx = rows.findIndex((r) => r.id === source.id);
		rows = [...rows.slice(0, idx + 1), clone, ...rows.slice(idx + 1)];
		persistRows();
		fetchFlags();
	}

	function clearAll() {
		rows = [];
		localStorage.removeItem(STORAGE_KEY);
	}
</script>

<div class="flag-switcher">
	<div class="flag-switcher-header">
		<h2 class="flag-switcher-title">Feature Flag Switcher</h2>
		<div class="flag-switcher-actions">
			<Button
				variant="icon"
				label={flagsLoading ? '…' : '↻'}
				ariaLabel="Refresh flags"
				onclick={fetchFlags}
				disabled={flagsLoading}
			/>
			<Button variant="icon" label="+" ariaLabel="Add row" onclick={addRow} />
			{#if rows.length > 0}
				<Button variant="primary" label="Clear all" onclick={clearAll} />
			{/if}
		</div>
	</div>

	{#if flagsError}
		<div class="flags-error">
			<span>Failed to load flags: {flagsError}</span>
			<Button variant="link" label="Retry" onclick={fetchFlags} />
		</div>
	{/if}

	{#if rows.length > 0}
		<Table>
			<TableHeaderRow>
				<th>Flag Key</th>
				<th>Segment</th>
				<th>Email</th>
				<th>Status</th>
				<th>Link</th>
				<th></th>
			</TableHeaderRow>
			<tbody>
				{#each rows as row (row.id)}
					<FlagSwitcherRow
						{row}
						{flags}
						onUpdate={updateRow}
						onRemove={() => removeRow(row.id)}
						onClone={cloneRow}
					/>
				{/each}
			</tbody>
		</Table>
	{:else if !flagsLoading}
		<div class="empty-state">
			<p>No rows yet — click <strong>+</strong> to add one.</p>
		</div>
	{/if}
</div>

<style>
	.flag-switcher {
		max-width: 1280px;
		margin: 16px auto;
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.flag-switcher-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.flag-switcher-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
	}

	.flag-switcher-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

.flags-error {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: var(--color-danger-muted);
		color: var(--color-danger);
		font-size: 12px;
	}

	.empty-state {
		padding: 24px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: 13px;
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
</style>
