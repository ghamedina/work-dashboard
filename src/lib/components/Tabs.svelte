<script lang="ts">
	import Button from './Button.svelte';
	import Tooltip from './Tooltip.svelte';

	export interface TabDef {
		id: string;
		label: string;
		count?: number;
	}

	interface Props {
		tabs: TabDef[];
		active: string;
		onReload: () => void;
	}

	let { tabs, active = $bindable(), onReload }: Props = $props();
</script>

<div class="tabs-bar">
	<div class="tabs-list" role="tablist">
		{#each tabs as tab (tab.id)}
			<button
				role="tab"
				aria-selected={active === tab.id}
				class="tab"
				class:active={active === tab.id}
				onclick={() => (active = tab.id)}
			>
				<span class="tab-label">{tab.label}</span>
				{#if tab.count !== undefined}
					<span class="tab-count">{tab.count}</span>
				{/if}
			</button>
		{/each}
	</div>
	<div class="tabs-actions">
		<Tooltip text="Reload data">
			<Button variant="icon" label="↻" ariaLabel="Reload data" onclick={onReload} />
		</Tooltip>
	</div>
</div>

<style>
	.tabs-bar {
		max-width: 1280px;
		margin: 24px auto 0;
		padding: 0 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.tabs-list {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		font-size: 13px;
		font-family: inherit;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: color 0.1s ease, border-color 0.1s ease;
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab.active {
		color: var(--color-text);
		border-bottom-color: var(--color-primary);
	}

	.tab-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 6px;
		font-size: 10px;
		font-weight: 600;
		background: var(--color-gray-muted);
		color: var(--color-text-muted);
		border-radius: 9px;
	}

	.tab.active .tab-count {
		background: var(--color-primary-muted);
		color: var(--color-primary);
	}

	.tabs-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-bottom: 6px;
	}
</style>
