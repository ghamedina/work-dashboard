<script lang="ts">
	interface Props {
		active: boolean;
		label: string;
		icon: string;
		onclick: () => void;
		isFirst?: boolean;
		isLast?: boolean;
	}

	let { active, label, icon, onclick, isFirst = false, isLast = false }: Props = $props();

	const classes = $derived(
		['toggle-btn', active ? 'active' : '', isFirst ? 'first' : '', isLast ? 'last' : '']
			.filter(Boolean)
			.join(' ')
	);
</script>

<button class={classes} {onclick} aria-label={label} aria-pressed={active}>
	{icon}
</button>

<style>
	.toggle-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: none;
		border: 1px solid var(--color-border);
		border-left-width: 0;
		border-radius: 0;
		font-size: 14px;
		cursor: pointer;
		color: var(--color-text-muted);
		font-family: inherit;
		transition: filter 0.1s ease, background 0.1s ease, color 0.1s ease;
	}

	.toggle-btn.first {
		border-left-width: 1px;
		border-radius: var(--radius) 0 0 var(--radius);
	}

	.toggle-btn.last {
		border-radius: 0 var(--radius) var(--radius) 0;
	}

	.toggle-btn:hover:not(.active) {
		background: var(--color-gray-muted);
		filter: brightness(0.96);
	}

	.toggle-btn.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: #fff;
	}
</style>
