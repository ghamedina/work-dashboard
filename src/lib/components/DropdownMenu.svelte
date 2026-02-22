<script lang="ts">
	interface Item {
		label: string;
		value: string;
	}

	interface Props {
		open: boolean;
		items: Item[];
		onSelect: (value: string) => void;
		maxItems?: number;
		onClose?: () => void;
	}

	let { open = $bindable(), items, onSelect, maxItems = 10, onClose }: Props = $props();

	const ITEM_HEIGHT = 34;

	function close() {
		if (onClose) {
			onClose();
		} else {
			open = false;
		}
	}

	function select(value: string) {
		onSelect(value);
		close();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') {
			close();
		}
	}

	function onWindowClick(e: MouseEvent) {
		if (open && listEl && !listEl.contains(e.target as Node)) {
			close();
		}
	}

	let listEl: HTMLUListElement | undefined = $state();
</script>

<svelte:window onkeydown={onWindowKeydown} onclick={onWindowClick} />

{#if open && items.length > 0}
	<ul
		bind:this={listEl}
		class="dropdown"
		role="listbox"
		style="max-height: {maxItems * ITEM_HEIGHT}px"
	>
		{#each items as item (item.value)}
			<li
				role="option"
				aria-selected="false"
				class="dropdown-item"
				onmousedown={(e) => {
					e.preventDefault();
					select(item.value);
				}}
			>
				{item.label}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 100;
		min-width: 100%;
		margin: 2px 0 0;
		padding: 4px 0;
		list-style: none;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-md);
		overflow-y: auto;
	}

	.dropdown-item {
		padding: 6px 12px;
		font-size: 13px;
		color: var(--color-text);
		cursor: pointer;
		white-space: nowrap;
		height: 34px;
		display: flex;
		align-items: center;
	}

	.dropdown-item:hover {
		background: var(--color-primary-muted);
		color: var(--color-primary);
	}
</style>
