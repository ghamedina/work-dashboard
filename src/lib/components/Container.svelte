<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="dashboard">
	{@render children()}
</div>

<style>
	.dashboard {
		max-width: 1280px;
		margin: 24px auto;
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}
</style>
