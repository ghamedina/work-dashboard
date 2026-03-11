<script lang="ts">
	import type { RenderMode } from '$lib/types';
	import Button from './Button.svelte';
	import ButtonGroup from './ButtonGroup.svelte';
	import Tooltip from './Tooltip.svelte';
	import ToggleButton from './ToggleButton.svelte';

	interface Props {
		mode: RenderMode;
		onReload: () => void;
		statuses?: string[];
		enabledStatuses?: Set<string>;
		onToggleStatus?: (status: string) => void;
	}

	let { mode = $bindable(), onReload, statuses = [], enabledStatuses = new Set(), onToggleStatus }: Props = $props();

	let dropdownOpen = $state(false);
	let triggerEl = $state<HTMLButtonElement>();
	let popoverEl = $state<HTMLDivElement>();

	const enabledCount = $derived(statuses.filter((s) => enabledStatuses.has(s)).length);

	const modeButtons: Array<{ value: RenderMode; icon: string; label: string }> = [
		{ value: 'summary', icon: '⊟', label: 'Summary view' },
		{ value: 'compact', icon: '≡', label: 'Compact view' },
		{ value: 'relaxed', icon: '⊞', label: 'Relaxed view' }
	];

	function toggleDropdown() {
		dropdownOpen = !dropdownOpen;
	}

	$effect(() => {
		if (!popoverEl) return;
		const el = popoverEl as HTMLElement & { showPopover(): void; hidePopover(): void };
		if (dropdownOpen && statuses.length > 0) {
			if (triggerEl) {
				const rect = triggerEl.getBoundingClientRect();
				popoverEl.style.top = `${rect.bottom + 2}px`;
				popoverEl.style.right = `${window.innerWidth - rect.right}px`;
				popoverEl.style.left = 'auto';
			}
			try { el.showPopover(); } catch {}
		} else {
			try { el.hidePopover(); } catch {}
		}
	});

	function handlePopoverToggle(e: Event) {
		const toggleEvent = e as ToggleEvent;
		if (toggleEvent.newState === 'closed' && dropdownOpen) {
			dropdownOpen = false;
		}
	}
</script>

<div class="controls">
	<h2 class="controls-title">Current Work</h2>
	<div class="controls-right">
		{#if statuses.length > 0}
			<Tooltip text="Filter by status">
				<button
					bind:this={triggerEl}
					class="status-trigger"
					onclick={toggleDropdown}
					aria-expanded={dropdownOpen}
					aria-label="Filter by status"
				>
					<span class="status-trigger-icon">⏷</span>
					Status
					<span class="status-badge" class:filtered={enabledCount > 0}>{enabledCount}/{statuses.length}</span>
				</button>
			</Tooltip>
		{/if}
		<ButtonGroup>
			{#each modeButtons as btn, i (btn.value)}
				<Tooltip text={btn.label}>
					<ToggleButton
						active={mode === btn.value}
						label={btn.label}
						icon={btn.icon}
						isFirst={i === 0}
						isLast={i === modeButtons.length - 1}
						onclick={() => (mode = btn.value)}
					/>
				</Tooltip>
			{/each}
		</ButtonGroup>
		<Tooltip text="Reload data">
			<Button variant="icon" label="↻" ariaLabel="Reload data" onclick={onReload} />
		</Tooltip>
	</div>
</div>

<div
	bind:this={popoverEl}
	popover="auto"
	class="status-popover"
	ontoggle={handlePopoverToggle}
>
	<div class="status-popover-header">
		<span class="status-popover-title">Filter statuses</span>
	</div>
	<div class="status-popover-list">
		{#each statuses as status (status)}
			<button
				class="status-option"
				class:active={enabledStatuses.has(status)}
				onclick={() => onToggleStatus?.(status)}
				aria-pressed={enabledStatuses.has(status)}
			>
				<span class="status-check">{enabledStatuses.has(status) ? '✓' : ''}</span>
				{status}
			</button>
		{/each}
	</div>
</div>

<style>
	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.controls-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
	}

	.controls-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-trigger {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 32px;
		padding: 0 10px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: filter 0.1s ease, background 0.1s ease;
		white-space: nowrap;
	}

	.status-trigger:hover {
		filter: brightness(0.94);
		background: var(--color-gray-muted);
	}

	.status-trigger-icon {
		font-size: 10px;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 5px;
		height: 16px;
		font-size: 10px;
		font-weight: 600;
		background: var(--color-gray-muted);
		color: var(--color-text-muted);
		border-radius: 8px;
		transition: background 0.1s ease, color 0.1s ease;
	}

	.status-badge.filtered {
		background: var(--color-primary);
		color: #fff;
	}

	.status-popover {
		position: fixed;
		margin: 0;
		padding: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-md);
		min-width: 180px;
		max-height: 400px;
		overflow-y: auto;
	}

	.status-popover:popover-open {
		display: block;
	}

	.status-popover-header {
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-border);
	}

	.status-popover-title {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status-popover-list {
		padding: 4px 0;
	}

	.status-option {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 12px;
		background: none;
		border: none;
		font-size: 13px;
		font-family: inherit;
		color: var(--color-text-muted);
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease;
	}

	.status-option:hover {
		background: var(--color-gray-muted);
	}

	.status-option.active {
		color: var(--color-text);
	}

	.status-check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		font-size: 11px;
		color: var(--color-primary);
		flex-shrink: 0;
	}
</style>
