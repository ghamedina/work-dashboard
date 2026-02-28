<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<section>
	{@render children()}
</section>

<style>
	section {
		max-width: 1280px;
		margin: 24px auto;
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-md);
		overflow: visible;
	}
</style>
