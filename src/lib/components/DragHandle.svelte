<script lang="ts">
	interface Props {
		rowspan?: number;
		onDragStart: () => void;
		onDragEnd: () => void;
	}

	let { rowspan, onDragStart, onDragEnd }: Props = $props();

	function handleDragStart(e: DragEvent) {
		const tr = (e.target as HTMLElement).closest('tr');
		if (tr && e.dataTransfer) {
			e.dataTransfer.setDragImage(tr, 0, tr.offsetHeight / 2);
		}
		onDragStart();
	}
</script>

<td
	{rowspan}
	class="cell-drag"
	draggable="true"
	ondragstart={handleDragStart}
	ondragend={onDragEnd}
	role="button"
	tabindex="0"
	aria-label="Drag to reorder"
>
	<span class="drag-handle">⠿</span>
</td>

<style>
	.cell-drag {
		padding: 0 4px;
		text-align: center;
		cursor: grab;
		user-select: none;
	}

	.cell-drag:active {
		cursor: grabbing;
	}

	.drag-handle {
		color: var(--color-text-muted);
		font-size: 14px;
		line-height: 1;
		opacity: 0.4;
		transition: opacity 0.1s ease;
	}

	.cell-drag:hover .drag-handle {
		opacity: 1;
	}
</style>
