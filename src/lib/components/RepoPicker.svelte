<script lang="ts">
	import ModalContainer from './ModalContainer.svelte';

	interface RepoPath {
		full: string;
		display: string;
	}

	interface Props {
		open: boolean;
		jiraKey: string;
		onDone: () => void;
	}

	let { open = $bindable(), jiraKey, onDone }: Props = $props();

	type LoadState = 'idle' | 'loading' | 'error';

	let paths = $state<RepoPath[]>([]);
	let defaultPath = $state<RepoPath | null>(null);
	let loadState = $state<LoadState>('idle');
	let submitting = $state(false);
	let loaded = $state(false);

	$effect(() => {
		if (open && !loaded) {
			loadState = 'loading';
			fetch('/api/repo-paths')
				.then((r) => r.json())
				.then((data: { paths: RepoPath[]; defaultPath: RepoPath }) => {
					paths = data.paths;
					defaultPath = data.defaultPath;
					loadState = 'idle';
					loaded = true;
				})
				.catch(() => {
					loadState = 'error';
				});
		}
	});

	async function selectPath(path: RepoPath) {
		if (submitting) return;
		submitting = true;
		try {
			const res = await fetch('/api/claude/open', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: jiraKey, repoPath: path.full })
			});
			if (!res.ok) throw new Error();
			open = false;
			onDone();
		} finally {
			submitting = false;
		}
	}

	function isDefault(path: RepoPath): boolean {
		return path.full === defaultPath?.full;
	}
</script>

<ModalContainer bind:open>
	{#snippet title()}
		Open in Claude — {jiraKey}
	{/snippet}

	{#snippet children()}
		{#if loadState === 'loading'}
			<p class="status">Loading paths…</p>
		{:else if loadState === 'error'}
			<p class="error">Failed to load repo paths.</p>
		{:else}
			<ul class="path-list">
				{#each paths as path (path.full)}
					<li>
						<button
							class="path-btn"
							class:is-default={isDefault(path)}
							disabled={submitting}
							onclick={() => selectPath(path)}
						>
							<span class="path-display">{path.display}</span>
							{#if isDefault(path)}
								<span class="default-tag">default</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/snippet}
</ModalContainer>

<style>
	.status {
		color: var(--color-text-muted);
		font-size: 13px;
		margin: 0;
	}

	.error {
		color: var(--color-danger);
		font-size: 13px;
		margin: 0;
	}

	.path-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.path-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 12px;
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius);
		font-family: inherit;
		font-size: 13px;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease, border-color 0.1s ease;
	}

	.path-btn:hover:not(:disabled) {
		background: var(--color-gray-muted);
		border-color: var(--color-border);
	}

	.path-btn.is-default {
		background: var(--color-primary-muted);
		border-color: var(--color-primary-muted);
	}

	.path-btn.is-default:hover:not(:disabled) {
		filter: brightness(0.95);
	}

	.path-btn:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.path-display {
		font-family: monospace;
		font-size: 12px;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.default-tag {
		flex-shrink: 0;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-primary);
		padding: 1px 6px;
		background: var(--color-primary-muted);
		border-radius: var(--radius);
	}
</style>
