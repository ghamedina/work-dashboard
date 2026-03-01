<script lang="ts">
	import ModalContainer from './ModalContainer.svelte';

	interface RepoPath {
		full: string;
		display: string;
	}

	interface Prompt {
		key: string;
		label: string;
		isFile: boolean;
		filePath: string | null;
		text: string;
	}

	interface Props {
		open: boolean;
		jiraKey: string;
		onDone: () => void;
	}

	let { open = $bindable(), jiraKey, onDone }: Props = $props();

	type Step = 'repo' | 'prompt' | 'preview';

	let step = $state<Step>('repo');
	let repoPaths = $state<RepoPath[]>([]);
	let defaultRepo = $state<RepoPath | null>(null);
	let prompts = $state<Prompt[]>([]);
	let defaultPromptKey = $state('');

	let selectedRepo = $state<RepoPath | null>(null);
	let selectedPromptKey = $state('');
	let previewText = $state('');
	let previewLoading = $state(false);
	let previewError = $state('');

	let loading = $state(false);
	let loadError = $state('');
	let submitting = $state(false);
	let loaded = $state(false);

	$effect(() => {
		if (open && !loaded) {
			loading = true;
			loadError = '';
			Promise.all([
				fetch('/api/repo-paths').then((r) => r.json()),
				fetch('/api/prompts').then((r) => r.json())
			])
				.then(
					([repoData, promptData]: [
						{ paths: RepoPath[]; defaultPath: RepoPath },
						{ prompts: Prompt[]; default: string }
					]) => {
						repoPaths = repoData.paths;
						defaultRepo = repoData.defaultPath;
						selectedRepo = repoData.defaultPath;

						prompts = promptData.prompts;
						defaultPromptKey = promptData.default;
						selectedPromptKey = promptData.default;

						loaded = true;
					}
				)
				.catch(() => {
					loadError = 'Failed to load options.';
				})
				.finally(() => {
					loading = false;
				});
		}
	});

	$effect(() => {
		if (!open) {
			step = 'repo';
			previewText = '';
			previewError = '';
		}
	});

	async function goToPreview() {
		if (!selectedPromptKey) return;
		step = 'preview';
		previewLoading = true;
		previewError = '';
		try {
			const res = await fetch('/api/claude/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: jiraKey, promptKey: selectedPromptKey })
			});
			if (!res.ok) throw new Error();
			const data = await res.json();
			previewText = data.text;
		} catch {
			previewError = 'Failed to load prompt preview.';
		} finally {
			previewLoading = false;
		}
	}

	async function submit() {
		if (!selectedRepo || !previewText || submitting) return;
		submitting = true;
		try {
			const res = await fetch('/api/claude/open', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: jiraKey, repoPath: selectedRepo.full, promptText: previewText })
			});
			if (!res.ok) throw new Error();
			open = false;
			onDone();
		} finally {
			submitting = false;
		}
	}

	function openFile(filePath: string) {
		fetch('/api/open-file', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filePath })
		});
	}

	const activePrompt = $derived(prompts.find((p) => p.key === selectedPromptKey));
	const modalSize = $derived<'default' | 'wide'>(step === 'repo' ? 'default' : 'wide');
</script>

<ModalContainer bind:open size={modalSize}>
	{#snippet title()}
		Open in Claude — {jiraKey}
	{/snippet}

	{#snippet children()}
		{#if loading}
			<p class="status">Loading…</p>
		{:else if loadError}
			<p class="error">{loadError}</p>
		{:else if step === 'repo'}
			<p class="step-label">Step 1 of 3 — Choose folder</p>
			<ul class="option-list">
				{#each repoPaths as path (path.full)}
					<li>
						<button
							class="option-btn"
							class:selected={selectedRepo?.full === path.full}
							class:is-default={path.full === defaultRepo?.full}
							onclick={() => (selectedRepo = path)}
						>
							<span class="option-text">{path.display}</span>
							{#if path.full === defaultRepo?.full}
								<span class="tag">default</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
			<div class="footer">
				<button class="primary-btn" disabled={!selectedRepo} onclick={() => (step = 'prompt')}>
					Next →
				</button>
			</div>
		{:else if step === 'prompt'}
			<p class="step-label">Step 2 of 3 — Choose prompt</p>
			<div class="prompt-layout">
				<ul class="option-list prompt-list">
					{#each prompts as prompt (prompt.key)}
						<li class="prompt-item">
							<button
								class="option-btn"
								class:selected={selectedPromptKey === prompt.key}
								class:is-default={prompt.key === defaultPromptKey}
								onclick={() => (selectedPromptKey = prompt.key)}
							>
								<span class="option-text">{prompt.label}</span>
								{#if prompt.key === defaultPromptKey}
									<span class="tag">default</span>
								{/if}
							</button>
							{#if prompt.isFile && prompt.filePath}
								<button
									class="tag tag-file tag-file-btn"
									onclick={() => openFile(prompt.filePath!)}
									title="Open in VS Code"
								>file ↗</button>
							{/if}
						</li>
					{/each}
				</ul>
				<div class="prompt-preview">
					{#if activePrompt}
						<pre class="preview-text">{activePrompt.text || '(empty)'}</pre>
					{:else}
						<p class="preview-empty">Select a prompt to preview</p>
					{/if}
				</div>
			</div>
			<div class="footer">
				<button class="ghost-btn" onclick={() => (step = 'repo')}>← Back</button>
				<button class="primary-btn" disabled={!selectedPromptKey} onclick={goToPreview}>
					Next →
				</button>
			</div>
		{:else if step === 'preview'}
			<p class="step-label">Step 3 of 3 — Review &amp; submit</p>
			{#if previewLoading}
				<p class="status">Building prompt…</p>
			{:else if previewError}
				<p class="error">{previewError}</p>
			{:else}
				<textarea class="prompt-textarea" bind:value={previewText} spellcheck="false"></textarea>
				{/if}
			<div class="footer">
				<button class="ghost-btn" onclick={() => (step = 'prompt')}>← Back</button>
				<button
					class="primary-btn"
					disabled={!previewText || previewLoading || submitting}
					onclick={submit}
				>
					{#if submitting}
						Starting…
					{:else}
						Submit to Claude →
					{/if}
				</button>
			</div>
		{/if}
	{/snippet}
</ModalContainer>

<style>
	.status,
	.error {
		font-size: 13px;
		margin: 0 0 12px;
	}

	.status {
		color: var(--color-text-muted);
	}

	.error {
		color: var(--color-danger);
	}

	.step-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		margin: 0 0 10px;
	}

	.option-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.prompt-item {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.prompt-item .option-btn {
		flex: 1;
		min-width: 0;
	}

	.option-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 7px 10px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-family: inherit;
		font-size: 13px;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease, border-color 0.1s ease;
	}

	.option-btn:hover {
		background: var(--color-gray-muted);
	}

	.option-btn.selected {
		background: var(--color-primary-muted);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.option-text {
		font-family: monospace;
		font-size: 12px;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 1px 5px;
		border-radius: var(--radius);
		background: var(--color-gray-muted);
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.option-btn.selected .tag {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
		color: var(--color-primary);
	}

	.tag-file {
		background: var(--color-purple-muted);
		color: var(--color-purple);
	}

	.tag-file-btn {
		border: none;
		font-family: inherit;
		cursor: pointer;
	}

	.tag-file-btn:hover {
		filter: brightness(0.85);
	}

	.prompt-layout {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 12px;
		min-height: 240px;
	}

	.prompt-list {
		overflow-y: auto;
	}

	.prompt-preview {
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 10px 12px;
		overflow-y: auto;
		background: var(--color-gray-muted);
	}

	.preview-text {
		font-family: monospace;
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-text);
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.preview-empty {
		font-size: 12px;
		color: var(--color-text-muted);
		margin: 0;
		font-style: italic;
	}

	.prompt-textarea {
		width: 100%;
		min-height: 320px;
		padding: 10px 12px;
		font-family: monospace;
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-text);
		background: var(--color-gray-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		resize: vertical;
		box-sizing: border-box;
	}

	.prompt-textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.footer {
		margin-top: 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.primary-btn {
		padding: 7px 18px;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius);
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: filter 0.1s ease;
	}

	.primary-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.primary-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.ghost-btn {
		padding: 7px 14px;
		background: none;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-family: inherit;
		font-size: 13px;
		cursor: pointer;
		transition: background 0.1s ease, color 0.1s ease;
	}

	.ghost-btn:hover {
		background: var(--color-gray-muted);
		color: var(--color-text);
	}
</style>
