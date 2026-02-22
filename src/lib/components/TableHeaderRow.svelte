<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<thead>
	<tr class="header-row">
		{@render children()}
	</tr>
</thead>

<style>
	.header-row {
		background: var(--color-gray-muted);
		border-bottom: 1px solid var(--color-border);
	}
</style>
