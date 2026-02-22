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
	class={`email-toggle-btn ${inSegment ? 'in-segment' : 'not-in-segment'}`}
	{onclick}
	disabled={loading}
	aria-label={inSegment ? `Remove ${email} from segment` : `Add ${email} to segment`}
>
	{#if loading}
		…
	{:else}
		{inSegment ? '✓' : '+'} {email}
	{/if}
</button>

<style>
	.email-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border: none;
		border-radius: var(--radius);
		font-size: 12px;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		transition: filter 0.1s ease;
	}

	.email-toggle-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.email-toggle-btn.in-segment {
		background: var(--color-success);
		color: #fff;
	}

	.email-toggle-btn.not-in-segment {
		background: var(--color-danger-muted);
		color: var(--color-danger);
	}

	.email-toggle-btn:not(:disabled):hover {
		filter: brightness(0.92);
	}
</style>
