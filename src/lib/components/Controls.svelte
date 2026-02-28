<script lang="ts">
	import type { RenderMode } from '$lib/types';
	import Button from './Button.svelte';
	import ButtonGroup from './ButtonGroup.svelte';
	import Tooltip from './Tooltip.svelte';
	import ToggleButton from './ToggleButton.svelte';

	interface Props {
		mode: RenderMode;
		onReload: () => void;
	}

	let { mode = $bindable(), onReload }: Props = $props();

	const modeButtons: Array<{ value: RenderMode; icon: string; label: string }> = [
		{ value: 'summary', icon: '⊟', label: 'Summary view' },
		{ value: 'compact', icon: '≡', label: 'Compact view' },
		{ value: 'relaxed', icon: '⊞', label: 'Relaxed view' }
	];
</script>

<div class="controls">
	<h2 class="controls-title">Current Work</h2>
	<div class="controls-right">
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
</style>
