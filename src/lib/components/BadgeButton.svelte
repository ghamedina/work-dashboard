<script lang="ts">
	interface Props {
		label: string;
		colorToken: string;
		onclick?: () => void;
		onkeydown?: (e: KeyboardEvent) => void;
		badge?: string | null;
		element?: HTMLButtonElement;
	}

	let { label, colorToken, onclick, onkeydown, badge = null, element = $bindable() }: Props = $props();
</script>

<button bind:this={element} class={`badge-btn token-${colorToken}`} {onclick} {onkeydown}>
	{label}
	{#if badge}
		<span class={`dot dot-${badge}`}></span>
	{/if}
</button>

<style>
	button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px;
		border: none;
		border-radius: var(--radius);
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		transition: filter 0.1s ease;
	}

	button:hover {
		filter: brightness(0.88);
	}

	.token-primary { background: var(--color-primary-muted); color: var(--color-primary); }
	.token-success { background: var(--color-success-muted); color: var(--color-success); }
	.token-warning { background: var(--color-warning-muted); color: var(--color-warning); }
	.token-danger { background: var(--color-danger-muted); color: var(--color-danger); }
	.token-purple { background: var(--color-purple-muted); color: var(--color-purple); }
	.token-gray { background: var(--color-gray-muted); color: var(--color-text-muted); }
	.token-status-gray { background: var(--status-gray-bg); color: var(--status-gray-text); }
	.token-status-blue { background: var(--status-blue-bg); color: var(--status-blue-text); }
	.token-status-teal { background: var(--status-teal-bg); color: var(--status-teal-text); }
	.token-status-teal-green { background: var(--status-teal-green-bg); color: var(--status-teal-green-text); }
	.token-status-yellow-green { background: var(--status-yellow-green-bg); color: var(--status-yellow-green-text); }
	.token-status-green { background: var(--status-green-bg); color: var(--status-green-text); }
	.token-status-red { background: var(--status-red-bg); color: var(--status-red-text); }

	.dot {
		display: inline-block;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot-blue { background: var(--color-primary); }
	.dot-red { background: var(--color-danger); }
	.dot-green { background: var(--color-success); }
</style>
