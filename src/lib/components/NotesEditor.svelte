<script lang="ts">
	interface Props {
		storageKey: string;
		placeholder?: string;
	}

	let { storageKey, placeholder = 'Notes for this week…' }: Props = $props();

	let value = $state('');
	let loaded = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		// Re-load whenever storageKey changes (e.g. ISO week rolls over).
		if (typeof localStorage === 'undefined') return;
		try {
			value = localStorage.getItem(storageKey) ?? '';
		} catch {
			value = '';
		}
		loaded = true;
	});

	function persist() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(storageKey, value);
		} catch {}
	}

	function onInput() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(persist, 500);
	}
</script>

<div class="notes">
	<label class="notes-label" for={storageKey}>Notes</label>
	<textarea
		id={storageKey}
		class="notes-textarea"
		{placeholder}
		bind:value
		oninput={onInput}
		disabled={!loaded}
		rows="6"
	></textarea>
</div>

<style>
	.notes {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 16px;
	}

	.notes-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.notes-textarea {
		width: 100%;
		min-height: 96px;
		resize: vertical;
		padding: 8px 10px;
		font: inherit;
		font-size: 13px;
		color: var(--color-text);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		box-sizing: border-box;
	}

	.notes-textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}
</style>
