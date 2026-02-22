<script lang="ts">
	interface Props {
		variant: 'icon' | 'link' | 'primary';
		label: string;
		onclick: () => void;
		ariaLabel?: string;
		disabled?: boolean;
	}

	let { variant, label, onclick, ariaLabel, disabled = false }: Props = $props();
</script>

<button class={`btn-${variant}`} {onclick} {disabled} aria-label={ariaLabel}>
	{label}
</button>

<style>
	.btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-size: 16px;
		cursor: pointer;
		color: var(--color-text-muted);
		font-family: inherit;
		transition: filter 0.1s ease, background 0.1s ease;
	}

	.btn-icon:hover {
		filter: brightness(0.94);
		background: var(--color-gray-muted);
	}

	.btn-link {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		background: var(--color-primary-muted);
		color: var(--color-primary);
		border: none;
		border-radius: var(--radius);
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		transition: filter 0.1s ease;
	}

	.btn-link:hover {
		filter: brightness(0.92);
	}

	.btn-primary {
		padding: 6px 16px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: var(--radius);
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		transition: filter 0.1s ease;
	}

	.btn-primary:hover {
		filter: brightness(0.92);
	}
</style>
