<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		text: string;
		delay?: number;
		children: Snippet;
	}

	let { text, delay = 400, children }: Props = $props();

	let visible = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	function handleMouseenter() {
		timer = setTimeout(() => {
			visible = true;
		}, delay);
	}

	function handleMouseleave() {
		if (timer) clearTimeout(timer);
		visible = false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tooltip-wrapper" onmouseenter={handleMouseenter} onmouseleave={handleMouseleave}>
	{@render children()}
	{#if visible}
		<div class="tooltip" role="tooltip">{text}</div>
	{/if}
</div>

<style>
	.tooltip-wrapper {
		position: relative;
	}

	.tooltip {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		background: var(--color-text);
		color: #fff;
		font-size: 11px;
		padding: 4px 8px;
		border-radius: var(--radius);
		white-space: nowrap;
		pointer-events: none;
		z-index: 10;
	}

	.tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: var(--color-text);
	}
</style>
