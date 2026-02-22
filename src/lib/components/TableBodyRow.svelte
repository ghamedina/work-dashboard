<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		onclick?: () => void;
	}

	let { children, onclick }: Props = $props();
</script>

<tr class="body-row" {onclick}>
	{@render children()}
</tr>

<style>
	.body-row:hover {
		background: var(--color-gray-muted);
	}
</style>
