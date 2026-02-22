<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		label?: string;
	}

	let { children, label = 'View mode' }: Props = $props();
</script>

<div class="toggle-group" role="group" aria-label={label}>
	{@render children()}
</div>

<style>
	.toggle-group {
		display: flex;
	}
</style>
