<script lang="ts">
	interface Props {
		email: string;
		inSegment: boolean;
		onclick: () => void;
		loading?: boolean;
	}

	let { email, inSegment, onclick, loading = false }: Props = $props();
</script>

<button
	class="toggle-switch"
	class:active={inSegment}
	class:loading
	{onclick}
	disabled={loading}
	aria-label={inSegment ? `Remove ${email} from segment` : `Add ${email} to segment`}
	role="switch"
	aria-checked={inSegment}
>
	<span class="track">
		<span class="thumb">
			{#if loading}
				<span class="spinner"></span>
			{/if}
		</span>
	</span>
</button>

<style>
	.toggle-switch {
		display: inline-flex;
		align-items: center;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		outline: none;
	}

	.toggle-switch:disabled {
		cursor: wait;
	}

	.track {
		position: relative;
		width: 36px;
		height: 20px;
		border-radius: 10px;
		background: var(--color-danger-muted);
		transition: background 0.2s ease;
	}

	.active .track {
		background: var(--color-success);
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		transition: transform 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.active .thumb {
		transform: translateX(16px);
	}

	.spinner {
		width: 10px;
		height: 10px;
		border: 1.5px solid var(--color-text-muted);
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.toggle-switch:not(:disabled):hover .track {
		filter: brightness(0.92);
	}

	.toggle-switch:focus-visible .track {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
