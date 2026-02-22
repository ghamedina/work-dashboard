<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: Snippet;
		children: Snippet;
	}

	let { open = $bindable(), title, children }: Props = $props();

	function close() {
		open = false;
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') {
			close();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if open}
	<div class="backdrop" onclick={close} role="presentation"></div>
	<div class="modal" role="dialog" aria-modal="true">
		<div class="modal-header">
			<div class="modal-title">
				{@render title()}
			</div>
			<button class="close-btn" onclick={close} aria-label="Close">×</button>
		</div>
		<div class="modal-body">
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 201;
		width: 90vw;
		max-width: 700px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-md);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.modal-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text);
		min-width: 0;
	}

	.close-btn {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: none;
		border: none;
		border-radius: var(--radius);
		font-size: 18px;
		line-height: 1;
		color: var(--color-text-muted);
		cursor: pointer;
		font-family: inherit;
		transition: background 0.1s ease;
	}

	.close-btn:hover {
		background: var(--color-gray-muted);
	}

	.modal-body {
		padding: 16px;
		overflow-y: auto;
		flex: 1;
	}
</style>
