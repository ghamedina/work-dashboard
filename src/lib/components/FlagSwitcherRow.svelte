<script lang="ts">
	import { untrack } from 'svelte';
	import type { AmplitudeFlag, AmplitudeTargetSegment, FlagSwitcherRowData } from '$lib/types';
	import TableBodyRow from './TableBodyRow.svelte';
	import EmailToggleButton from './EmailToggleButton.svelte';
	import Button from './Button.svelte';
	import DropdownMenu from './DropdownMenu.svelte';
	import DragHandle from './DragHandle.svelte';

	interface Props {
		row: FlagSwitcherRowData;
		flags: AmplitudeFlag[];
		allProjects: Array<{ name: string; id: string }>;
		amplitudeOrgSlug: string;
		onUpdate: (updated: FlagSwitcherRowData) => void;
		onRemove: () => void;
		onClone: (row: FlagSwitcherRowData) => void;
		isDragOver?: boolean;
		onDragStart?: () => void;
		onDragOver?: (e: DragEvent) => void;
		onDragLeave?: () => void;
		onDrop?: () => void;
		onDragEnd?: () => void;
	}

	let { row, flags, allProjects, amplitudeOrgSlug, onUpdate, onRemove, onClone, isDragOver = false, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd }: Props = $props();

	const DEFAULT_PROJECT = 'housecall.io_development';

	let flagKey = $state(untrack(() => row.flagKey));
	let selectedProject = $state(untrack(() => row.projectId || DEFAULT_PROJECT));
	let segmentName = $state(untrack(() => row.segmentName));
	let email = $state(untrack(() => row.email));
	let projectData = $state<Record<string, { segmentName: string; email: string }>>(untrack(() => row.projectData ?? {}));
	let localFlag = $state<AmplitudeFlag | null>(untrack(() => row.flag));
	let toggleLoading = $state(false);
	let toggleError = $state<string | null>(null);
	let dropdownOpen = $state(false);
	let dropdownActiveIndex = $state(-1);
	let inputEl = $state<HTMLInputElement | undefined>();

	let filteredFlagItems = $derived.by(() => {
		const terms = flagKey.toLowerCase().split(' ').filter((t) => t.length > 0);
		if (terms.length === 0) return [];
		const seen = new Set<string>();
		return flags
			.filter((f) => terms.every((t) => f.key.toLowerCase().includes(t)))
			.filter((f) => {
				if (seen.has(f.key)) return false;
				seen.add(f.key);
				return true;
			})
			.map((f) => ({ label: f.key, value: f.key }));
	});

	$effect(() => {
		filteredFlagItems;
		dropdownActiveIndex = -1;
	});

	let matchedFlag = $derived(
		localFlag ??
		(flagKey && selectedProject
			? flags.find((f) => f.key === flagKey && f.projectName === selectedProject)
			: null) ??
		null
	);
	let selectedSegment = $derived(
		matchedFlag?.targetSegments.find((s) => s.name === segmentName) ?? null
	);
	let emailInSegment = $derived(
		email.length > 0 &&
			(selectedSegment?.conditions.some((c) => c.values.includes(email)) ?? false)
	);

	function applyFlagKey(newKey: string) {
		flagKey = newKey;
		selectedProject = DEFAULT_PROJECT;
		segmentName = '';
		email = '';
		projectData = {};
		localFlag = null;
		toggleError = null;
		onUpdate({ ...row, flagKey: newKey, projectId: DEFAULT_PROJECT, segmentName: '', email: '', projectData: {}, flag: null });
	}

	function handleFlagKeyInput(e: Event) {
		const newKey = (e.target as HTMLInputElement).value;
		dropdownOpen = newKey.length > 0;
		applyFlagKey(newKey);
	}

	function handleFlagKeyFocus() {
		if (flagKey.length > 0) dropdownOpen = true;
	}

	function handleFlagKeyBlur() {
		dropdownOpen = false;
	}

	function selectFlagKey(value: string) {
		dropdownOpen = false;
		dropdownActiveIndex = -1;
		applyFlagKey(value);
	}

	function handleFlagKeyKeydown(e: KeyboardEvent) {
		if (!dropdownOpen || filteredFlagItems.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			dropdownActiveIndex = Math.min(dropdownActiveIndex + 1, filteredFlagItems.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			dropdownActiveIndex = Math.max(dropdownActiveIndex - 1, 0);
		} else if (e.key === 'Enter' && dropdownActiveIndex >= 0) {
			e.preventDefault();
			selectFlagKey(filteredFlagItems[dropdownActiveIndex].value);
		} else if (e.key === 'Escape') {
			dropdownOpen = false;
			dropdownActiveIndex = -1;
		}
	}

	async function handleProjectChange(e: Event) {
		// Save current project's data before switching
		if (selectedProject) {
			projectData = { ...projectData, [selectedProject]: { segmentName, email } };
		}

		const newProject = (e.target as HTMLSelectElement).value;
		selectedProject = newProject;

		// Restore saved data for the new project, or start fresh
		const saved = projectData[newProject];
		segmentName = saved?.segmentName ?? '';
		email = saved?.email ?? '';
		localFlag = null;
		toggleError = null;
		onUpdate({ ...row, flagKey, projectId: newProject, segmentName, email, projectData, flag: null });

		// Refetch the flag for the new project to get current segment state
		if (flagKey && newProject) {
			try {
				const res = await fetch(`/api/amplitude/flags/${encodeURIComponent(flagKey)}?projectName=${encodeURIComponent(newProject)}`);
				if (res.ok) {
					const freshFlag = (await res.json()) as AmplitudeFlag;
					if (selectedProject === newProject) {
						localFlag = freshFlag;
						onUpdate({ ...row, flagKey, projectId: newProject, segmentName, email, projectData, flag: freshFlag });
					}
				}
			} catch {
				// Non-critical — falls back to cached flags data
			}
		}
	}

	function syncProjectData() {
		if (selectedProject) {
			projectData = { ...projectData, [selectedProject]: { segmentName, email } };
		}
	}

	function handleSegmentChange(e: Event) {
		segmentName = (e.target as HTMLSelectElement).value;
		email = '';
		toggleError = null;
		syncProjectData();
		onUpdate({ ...row, flagKey, projectId: selectedProject, segmentName, email: '', projectData, flag: localFlag });
	}

	function handleEmailInput(e: Event) {
		email = (e.target as HTMLInputElement).value;
		toggleError = null;
		syncProjectData();
		onUpdate({ ...row, flagKey, projectId: selectedProject, segmentName, email, projectData, flag: localFlag });
	}

	async function handleToggle() {
		if (!matchedFlag || !selectedSegment) return;

		const updatedSegments: AmplitudeTargetSegment[] = matchedFlag.targetSegments.map((seg) => {
			if (seg.name !== segmentName) return seg;
			return {
				...seg,
				conditions: seg.conditions.map((c) => ({
					...c,
					values: emailInSegment
						? c.values.filter((v) => v !== email)
						: [...c.values, email]
				}))
			};
		});

		toggleLoading = true;
		toggleError = null;

		try {
			const res = await fetch(`/api/amplitude/flags/${matchedFlag.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetSegments: updatedSegments, flagKey, projectName: selectedProject })
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			const updatedFlag = (await res.json()) as AmplitudeFlag;
			localFlag = updatedFlag;
			syncProjectData();
			onUpdate({ ...row, flagKey, projectId: selectedProject, segmentName, email, projectData, flag: updatedFlag });
		} catch (err) {
			toggleError = err instanceof Error ? err.message : 'Toggle failed';
		} finally {
			toggleLoading = false;
		}
	}
</script>

<TableBodyRow
	{isDragOver}
	onDragOver={onDragOver}
	onDragLeave={onDragLeave}
	onDrop={onDrop}
>
	<DragHandle
		onDragStart={onDragStart ?? (() => {})}
		onDragEnd={onDragEnd ?? (() => {})}
	/>
	<td class="cell-flag-key">
		<div class="flag-key-input">
			<input
				bind:this={inputEl}
				type="text"
				class="text-input"
				value={flagKey}
				oninput={handleFlagKeyInput}
				onfocus={handleFlagKeyFocus}
				onblur={handleFlagKeyBlur}
				onkeydown={handleFlagKeyKeydown}
				placeholder="flag-key"
				spellcheck="false"
				autocomplete="off"
			/>
			{#if matchedFlag}
				<span class="match-indicator" title={matchedFlag.name}>●</span>
			{/if}
		</div>
		<DropdownMenu
			bind:open={dropdownOpen}
			bind:activeIndex={dropdownActiveIndex}
			anchor={inputEl}
			items={filteredFlagItems}
			onSelect={selectFlagKey}
		/>
	</td>
	<td class="cell-project">
		{#if allProjects.length > 0}
			<select class="select-input" onchange={handleProjectChange} value={selectedProject}>
				<option value="">Select project…</option>
				{#each allProjects as project (project.name)}
					<option value={project.name}>{project.name}</option>
				{/each}
			</select>
		{/if}
	</td>
	<td class="cell-segment">
		{#if matchedFlag && selectedProject}
			<select class="select-input" onchange={handleSegmentChange} value={segmentName}>
				<option value="">Select segment…</option>
				{#each matchedFlag.targetSegments as seg (seg.name)}
					<option value={seg.name}>{seg.name}</option>
				{/each}
			</select>
		{/if}
	</td>
	<td class="cell-email">
		{#if matchedFlag && segmentName}
			<input
				type="email"
				class="text-input"
				value={email}
				oninput={handleEmailInput}
				placeholder="user@example.com"
			/>
		{/if}
	</td>
	<td class="cell-toggle">
		{#if matchedFlag && segmentName && email}
			<EmailToggleButton
				{email}
				inSegment={emailInSegment}
				onclick={handleToggle}
				loading={toggleLoading}
			/>
			{#if toggleError}
				<span class="toggle-error">{toggleError}</span>
			{/if}
		{/if}
	</td>
	<td class="cell-link">
		{#if matchedFlag}
			<Button
				variant="link"
				label="↗ Amplitude"
				ariaLabel="Open flag in Amplitude dashboard"
				onclick={() =>
					window.open(
						`https://app.amplitude.com/experiment/${amplitudeOrgSlug}/${matchedFlag.projectId}/config/${matchedFlag.id}/configure`,
						'_blank',
						'noopener,noreferrer'
					)}
			/>
		{/if}
	</td>
	<td class="cell-remove">
		<Button variant="icon" label="⧉" ariaLabel="Clone row" onclick={() => onClone(row)} />
		<Button variant="icon" label="×" ariaLabel="Remove row" onclick={onRemove} />
	</td>
</TableBodyRow>

<style>
	td {
		padding: 6px 12px;
		border-bottom: 1px solid var(--color-border);
		vertical-align: middle;
	}


	.cell-flag-key {
		white-space: nowrap;
	}

	.flag-key-input {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.cell-flag-key .text-input {
		flex: 1;
		min-width: 0;
	}

.text-input {
		padding: 4px 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text);
		background: var(--color-surface);
		outline: none;
		transition: border-color 0.1s ease;
	}

	.text-input:focus {
		border-color: var(--color-primary);
	}

	.match-indicator {
		color: var(--color-success);
		font-size: 10px;
		flex-shrink: 0;
	}

	.select-input {
		padding: 4px 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text);
		background: var(--color-surface);
		cursor: pointer;
		outline: none;
	}

	.select-input:focus {
		border-color: var(--color-primary);
	}

	.cell-email .text-input {
		width: 220px;
	}

	.cell-project {
		white-space: nowrap;
	}

	.cell-toggle {
		white-space: nowrap;
	}

	.toggle-error {
		display: block;
		font-size: 11px;
		color: var(--color-danger);
		margin-top: 2px;
	}

	.cell-remove {
		text-align: right;
		white-space: nowrap;
		display: flex;
		gap: 4px;
		align-items: center;
		justify-content: flex-end;
	}
</style>
