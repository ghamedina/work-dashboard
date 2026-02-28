<script lang="ts">
	interface Item {
		label: string;
		value: string;
	}

	interface Props {
		open: boolean;
		activeIndex?: number;
		items: Item[];
		onSelect: (value: string) => void;
		maxItems?: number;
		onClose?: () => void;
		anchor?: HTMLElement;
	}

	let { open = $bindable(), activeIndex = $bindable(-1), items, onSelect, maxItems = 10, onClose, anchor }: Props = $props();

	const ITEM_HEIGHT = 34;
	let listEl: HTMLUListElement | undefined = $state();

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

	$effect(() => {
		if (!listEl) return;
		const el = listEl as HTMLElement & { showPopover(): void; hidePopover(): void };
		if (open && items.length > 0) {
			if (anchor) {
				const rect = anchor.getBoundingClientRect();
				listEl.style.top = `${rect.bottom + 2}px`;
				listEl.style.left = `${rect.left}px`;
				listEl.style.minWidth = `${rect.width}px`;
			}
			try {
				el.showPopover();
			} catch {
				// already open
			}
		} else {
			try {
				el.hidePopover();
			} catch {
				// already closed
			}
		}
	});

	function handleToggle(e: Event) {
		const toggleEvent = e as ToggleEvent;
		if (toggleEvent.newState === 'closed' && open) {
			close();
		}
	}

	$effect(() => {
		if (!listEl || activeIndex < 0) return;
		const item = listEl.querySelectorAll('.dropdown-item')[activeIndex] as HTMLElement | undefined;
		item?.scrollIntoView({ block: 'nearest' });
	});
</script>

<!-- svelte-ignore a11y_no_redundant_roles -->
<ul
	bind:this={listEl}
	popover="auto"
	class="dropdown"
	role="listbox"
	style="max-height: {maxItems * ITEM_HEIGHT}px"
	ontoggle={handleToggle}
>
	{#each items as item, i (item.value)}
		<li
			role="option"
			aria-selected={i === activeIndex}
			class="dropdown-item"
			class:active={i === activeIndex}
			onmousedown={(e) => {
				e.preventDefault();
				select(item.value);
			}}
		>
			{item.label}
		</li>
	{/each}
</ul>

<style>
	.dropdown {
		position: fixed;
		margin: 0;
		padding: 4px 0;
		list-style: none;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-md);
		overflow-y: auto;
	}

	.dropdown:popover-open {
		display: block;
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

	.dropdown-item:hover,
	.dropdown-item.active {
		background: var(--color-primary-muted);
		color: var(--color-primary);
	}
</style>
