<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		onclick?: () => void;
		isDragOver?: boolean;
		onDragOver?: (e: DragEvent) => void;
		onDragLeave?: () => void;
		onDrop?: () => void;
	}

	let { children, onclick, isDragOver = false, onDragOver, onDragLeave, onDrop }: Props = $props();
</script>

<tr
	class="body-row"
	class:drag-over={isDragOver}
	{onclick}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	{@render children()}
</tr>

<style>
	.body-row:hover {
		background: var(--color-gray-muted);
	}

	.drag-over {
		background: var(--color-primary-muted);
		box-shadow: inset 0 -2px 0 var(--color-primary);
	}
</style>
