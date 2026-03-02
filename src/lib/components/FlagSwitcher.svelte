<script lang="ts">
	import { onMount } from 'svelte';
	import type { AmplitudeFlag, FlagSwitcherRowData } from '$lib/types';
	import FlagSwitcherRow from './FlagSwitcherRow.svelte';
	import Button from './Button.svelte';
	import Table from './Table.svelte';
	import TableHeaderRow from './TableHeaderRow.svelte';
  import Container from './Container.svelte';

	interface Props {
		amplitudeOrgSlug: string;
	}

	let { amplitudeOrgSlug }: Props = $props();

	const STORAGE_KEY = 'flagSwitcherRows';

	type PersistedRow = Pick<FlagSwitcherRowData, 'id' | 'flagKey' | 'segmentName' | 'email'>;

	let rows = $state<FlagSwitcherRowData[]>([]);
	let flags = $state<AmplitudeFlag[]>([]);
	let flagsLoading = $state(false);
	let flagsError = $state<string | null>(null);
	let localProEmail = $state<string | null>(null);
	let copied = $state(false);

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
		fetchLocalPro();
	});

	async function fetchLocalPro() {
		try {
			const res = await fetch('/hcp-api/alpha/pro', {
				headers: { Accept: 'application/json' }
			});
			if (!res.ok) return;
			const pro = await res.json();
			localProEmail = pro.email ?? null;
		} catch {
			// local server not running or not logged in
		}
	}

	async function copyEmail() {
		if (!localProEmail) return;
		await navigator.clipboard.writeText(localProEmail);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

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

<Container>
	<div class="flag-switcher-header">
		<h2 class="flag-switcher-title">Feature Flag Switcher</h2>
		<div class="flag-switcher-actions">
			{#if localProEmail}
				<button class="local-pro-btn" onclick={copyEmail} aria-label="Copy email to clipboard">
					<span class="local-pro-email">{localProEmail}</span>
					<span class="local-pro-label">logged in</span>
					<span class="local-pro-copy">{copied ? '✓' : '⧉'}</span>
				</button>
			{:else}
				<span class="no-local">No local</span>
			{/if}
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
						{amplitudeOrgSlug}
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
	</Container>

<style>
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

	.no-local {
		font-size: 12px;
		color: var(--color-text-muted);
		padding: 0 4px;
	}

	.local-pro-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 10px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-family: inherit;
		font-size: 12px;
		cursor: pointer;
		color: var(--color-text);
		transition: filter 0.1s ease, background 0.1s ease;
		line-height: 1;
	}

	.local-pro-btn:hover {
		filter: brightness(0.94);
		background: var(--color-gray-muted);
	}

	.local-pro-email {
		font-weight: 500;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.local-pro-label {
		color: var(--color-text-muted);
	}

	.local-pro-copy {
		font-size: 16px;
		line-height: 1;
		color: var(--color-text-muted);
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
