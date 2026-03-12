<script lang="ts">
	import { onMount } from 'svelte';
	import type { AmplitudeFlag, FlagSwitcherRowData } from '$lib/types';
	import FlagSwitcherRow from './FlagSwitcherRow.svelte';
	import Button from './Button.svelte';
	import Table from './Table.svelte';
	import TableHeaderRow from './TableHeaderRow.svelte';
	import Container from './Container.svelte';
	import { createDragReorder } from '$lib/drag-reorder.svelte';

	interface Props {
		amplitudeOrgSlug: string;
	}

	let { amplitudeOrgSlug }: Props = $props();

	const STORAGE_KEY = 'flagSwitcherRows';
	const DEFAULT_PROJECT = 'housecall.io_development';

	type PersistedRow = Pick<FlagSwitcherRowData, 'id' | 'flagKey' | 'projectId' | 'segmentName' | 'email'> & {
		projectData?: Record<string, { segmentName: string; email: string }>;
	};

	let rows = $state<FlagSwitcherRowData[]>([]);
	let flags = $state<AmplitudeFlag[]>([]);
	let flagsLoading = $state(false);
	let flagsError = $state<string | null>(null);
	let localProEmail = $state<string | null>(null);
	let copied = $state(false);

	// Unique projects derived from flags (server tags each flag with projectName)
	let allProjects = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const f of flags) {
			if (!seen.has(f.projectName)) seen.set(f.projectName, f.projectId);
		}
		return [...seen.entries()]
			.map(([name, id]) => ({ name, id }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	// Migrate old numeric project IDs to project names
	function migrateProjectId(projectId: string | undefined): string {
		if (!projectId) return DEFAULT_PROJECT;
		// Old data stored numeric IDs like "217854"; new data stores names like "housecall.io_development"
		if (/^\d+$/.test(projectId)) return DEFAULT_PROJECT;
		return projectId;
	}

	onMount(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored) as PersistedRow[];
				rows = parsed.map((r) => {
					const pid = migrateProjectId(r.projectId);
					// Migrate: seed projectData from existing segment/email if not present
					const projectData = r.projectData ?? {};
					if (r.segmentName || r.email) {
						projectData[pid] = projectData[pid] ?? { segmentName: r.segmentName ?? '', email: r.email ?? '' };
					}
					return { ...r, projectId: pid, projectData, flag: null };
				});
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
		const toStore = rows.map(({ id, flagKey, projectId, segmentName, email, projectData }) => ({
			id,
			flagKey,
			projectId,
			segmentName,
			email,
			projectData
		}));
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
	}

	function addRow() {
		rows = [
			...rows,
			{
				id: crypto.randomUUID(),
				flagKey: '',
				projectId: DEFAULT_PROJECT,
				flag: null,
				segmentName: '',
				email: '',
				projectData: {}
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
			projectId: source.projectId,
			segmentName: source.segmentName,
			email: source.email,
			projectData: { ...source.projectData },
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

	// --- Drag & Drop reordering ---
	const drag = createDragReorder({
		items: () => rows,
		getKey: (r) => r.id,
		onReorder(next) {
			rows = next;
			persistRows();
		}
	});
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
				<th class="col-drag"></th>
				<th class="col-flag-key">Flag Key</th>
				<th>Project</th>
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
						{allProjects}
						{amplitudeOrgSlug}
						onUpdate={updateRow}
						onRemove={() => removeRow(row.id)}
						onClone={cloneRow}
						isDragOver={drag.dragOverKey === row.id}
						onDragStart={() => drag.start(row.id)}
						onDragOver={(e) => drag.over(e, row.id)}
						onDragLeave={drag.leave}
						onDrop={() => drag.drop(row.id)}
						onDragEnd={drag.end}
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
		border-radius: var(--radius) var(--radius) 0 0;
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

	.col-drag {
		width: 28px;
		padding: 0;
	}

	.col-flag-key {
		min-width: 280px;
	}
</style>
