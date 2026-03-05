<script lang="ts">
	import ModalContainer from './ModalContainer.svelte';
	import DropdownMenu from './DropdownMenu.svelte';

	interface RepoPath {
		full: string;
		display: string;
	}

	interface WorktreeEntry {
		full: string;
		branch: string;
		display: string;
	}

	interface WorktreeGroup {
		repoFull: string;
		repoDisplay: string;
		worktrees: WorktreeEntry[];
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
		selectedBranch?: string;
		branches?: string[];
		onDone: () => void;
	}

	let { open = $bindable(), jiraKey, selectedBranch = '', branches = [], onDone }: Props = $props();

	type Step = 'repo' | 'prompt' | 'preview';
	type BranchStrategy = 'current' | 'new-from-current' | 'new-from-master' | 'existing' | 'new-worktree';
	type CommentsMode = 'override' | 'secondary' | 'exclude';

	let step = $state<Step>('repo');
	let repoPaths = $state<RepoPath[]>([]);
	let defaultRepo = $state<RepoPath | null>(null);
	let prompts = $state<Prompt[]>([]);
	let defaultPromptKey = $state('');

	let selectedRepo = $state<RepoPath | null>(null);
	let worktreeGroups = $state<WorktreeGroup[]>([]);
	let worktreeBasePaths = $state<{ full: string; display: string }[]>([]);
	let selectedWorktreeEntry = $state<WorktreeEntry | null>(null);
	let selectedPromptKey = $state('');
	let previewText = $state('');
	let previewLoading = $state(false);
	let previewError = $state('');

	let currentBranch = $state('');
	let branchLoading = $state(false);
	let branchStrategy = $state<BranchStrategy>('current');

	let pickerBranch = $state('');
	let pickerBranchAnchor = $state<HTMLElement | null>(null);
	let pickerBranchDropdownOpen = $state(false);

	const selectedIsWorktreeBase = $derived(
		!selectedWorktreeEntry && worktreeBasePaths.some((p) => p.full === selectedRepo?.full)
	);

	$effect(() => { pickerBranch = selectedBranch; });

	let loading = $state(false);
	let loadError = $state('');
	let submitting = $state(false);
	let loaded = $state(false);

	let commentsMode = $state<CommentsMode>('override');

	let flagChrome = $state(true);
	let flagResume = $state(false);
	let sessions = $state<{ id: string; summary: string; date: string }[]>([]);
	let sessionsLoading = $state(false);
	let selectedSessionId = $state('');

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
						{ paths: RepoPath[]; defaultPath: RepoPath; worktreeGroups: WorktreeGroup[]; worktreeBasePaths: { full: string; display: string }[] },
						{ prompts: Prompt[]; default: string }
					]) => {
						repoPaths = repoData.paths;
						defaultRepo = repoData.defaultPath;
						selectedRepo = repoData.defaultPath;
						worktreeGroups = repoData.worktreeGroups ?? [];
						worktreeBasePaths = repoData.worktreeBasePaths ?? [];

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
			currentBranch = '';
			branchStrategy = 'current';
			pickerBranchDropdownOpen = false;
			flagChrome = true;
			flagResume = false;
			sessions = [];
			selectedSessionId = '';
			commentsMode = 'override';
			selectedWorktreeEntry = null;
		}
	});

	async function loadSessions() {
		if (!selectedRepo || sessionsLoading) return;
		sessionsLoading = true;
		try {
			const res = await fetch(`/api/claude/sessions?repoPath=${encodeURIComponent(selectedRepo.full)}`);
			const data: { sessions: { id: string; summary: string; date: string }[] } = await res.json();
			sessions = data.sessions;
			if (sessions.length > 0) selectedSessionId = sessions[0].id;
		} catch {
			sessions = [];
		} finally {
			sessionsLoading = false;
		}
	}

	async function fetchPreviewText() {
		if (!selectedPromptKey) return;
		previewLoading = true;
		previewError = '';
		try {
			const res = await fetch('/api/claude/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: jiraKey, promptKey: selectedPromptKey, commentsMode })
			});
			if (res.ok) {
				const data: { text: string } = await res.json();
				previewText = data.text;
			} else {
				previewError = 'Failed to load prompt preview.';
			}
		} catch {
			previewError = 'Failed to load prompt preview.';
		} finally {
			previewLoading = false;
		}
	}

	async function goToPreview() {
		if (!selectedPromptKey || !selectedRepo) return;
		step = 'preview';
		previewError = '';
		currentBranch = '';
		branchStrategy = 'current';

		if (selectedWorktreeEntry) {
			currentBranch = selectedWorktreeEntry.branch;
			await fetchPreviewText();
			return;
		}

		branchLoading = true;
		await Promise.allSettled([
			fetchPreviewText(),
			fetch(`/api/git/branch?repoPath=${encodeURIComponent(selectedRepo.full)}`)
				.then((r) => (r.ok ? r.json() : Promise.reject()))
				.then((data: { branch: string }) => {
					currentBranch = data.branch;
				})
				.catch(() => {
					currentBranch = '';
				})
				.finally(() => {
					branchLoading = false;
				})
		]);
	}

	const branchAppendix = $derived.by(() => {
		if (branchStrategy === 'current') return '';
		if (branchStrategy === 'existing') {
			return (
				'\n---\n' +
				`Before doing anything else, check out the existing branch and pull the latest:\n\n` +
				`  git fetch origin\n` +
				`  git checkout ${pickerBranch}\n` +
				`  git pull origin ${pickerBranch}\n\n` +
				`If there are any conflicts or unexpected issues, stop and ask me how to proceed before continuing.\n\n` +
				`Once on the branch, proceed with the work.`
			);
		}
		if (branchStrategy === 'new-from-current') {
			return (
				'\n---\n' +
				`Before doing anything else, create a new branch from the current branch (${currentBranch}):\n\n` +
				`  git checkout -b <branch-name>\n\n` +
				`Pick a short, descriptive branch name based on the Jira ticket key and summary (e.g. ${jiraKey}-short-description).\n\n` +
				`If the branch name already exists, ask me what name to use before proceeding.\n` +
				`If any git command fails or produces unexpected output, stop and ask me how to proceed before continuing.\n\n` +
				`Once the branch is created successfully, proceed with the work.`
			);
		}
			if (branchStrategy === 'new-worktree') {
			const repoName = selectedRepo?.full.split('/').pop() ?? 'repo';
			return (
				'\n---\n' +
				`Before doing anything else, create a new git worktree for this work:\n\n` +
				`1. Pick a short, descriptive branch name based on the Jira ticket key and summary (e.g. ${jiraKey}-short-description)\n` +
				`2. Create the worktree as a sibling directory to this repo:\n\n` +
				`   git worktree add ../${repoName}-<branch-name> -b <branch-name>\n\n` +
				`3. Change your working directory to the new worktree. All subsequent work must happen inside this worktree — do not make changes in the original repo directory.\n` +
				`4. Ask me: "The new worktree is ready. Should I install dependencies before starting work?" and wait for my answer before continuing.\n\n` +
				`If the branch or directory name already exists, ask me what name to use before proceeding.\n` +
				`If any git command fails or produces unexpected output, stop and ask me how to proceed before continuing.`
			);
		}
		return (
			'\n---\n' +
			`Before doing anything else, update master and create a new branch from it:\n\n` +
			`  git fetch origin\n` +
			`  git checkout master\n` +
			`  git pull origin master\n` +
			`  git checkout -b <branch-name>\n\n` +
			`Pick a short, descriptive branch name based on the Jira ticket key and summary (e.g. ${jiraKey}-short-description).\n\n` +
			`If the branch name already exists, ask me what name to use before proceeding.\n` +
			`If any git command fails or produces unexpected output (merge conflicts, diverged history, etc.), stop and ask me how to proceed before continuing.\n\n` +
			`Once the branch is created successfully, proceed with the work.`
		);
	});

	async function submit() {
		if (!selectedRepo || !previewText || submitting) return;
		submitting = true;
		const finalPrompt = previewText + branchAppendix;
		const claudeFlags = {
			chrome: flagChrome,
			resumeSessionId: flagResume && selectedSessionId ? selectedSessionId : undefined
		};
		try {
			const res = await fetch('/api/claude/open', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: jiraKey, repoPath: selectedRepo.full, promptText: finalPrompt, claudeFlags, commentsMode })
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
							class:selected={selectedRepo?.full === path.full && !selectedWorktreeEntry}
							class:is-default={path.full === defaultRepo?.full}
							onclick={() => { selectedRepo = path; selectedWorktreeEntry = null; }}
						>
							<span class="option-text">{path.display}</span>
							{#if path.full === defaultRepo?.full}
								<span class="tag">default</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
			{#if worktreeGroups.length > 0 || worktreeBasePaths.length > 0}
				<p class="worktrees-label">Worktrees</p>
				<ul class="option-list">
					{#each worktreeBasePaths as base (base.full)}
						<li>
							<button
								class="option-btn"
								class:selected={selectedRepo?.full === base.full && !selectedWorktreeEntry}
								onclick={() => { selectedRepo = base; selectedWorktreeEntry = null; }}
							>
								<span class="option-text">{base.display}</span>
								<span class="tag tag-worktree-base">base</span>
							</button>
						</li>
					{/each}
					{#each worktreeGroups as group (group.repoFull)}
						{#each group.worktrees as wt (wt.full)}
							<li>
								<button
									class="option-btn"
									class:selected={selectedWorktreeEntry?.full === wt.full}
									onclick={() => {
										selectedRepo = { full: wt.full, display: wt.display };
										selectedWorktreeEntry = wt;
									}}
								>
									<span class="option-text">{group.repoDisplay}: {wt.branch}</span>
									<span class="tag tag-worktree">worktree</span>
								</button>
							</li>
						{/each}
					{/each}
				</ul>
			{/if}
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
			<div class="branch-section">
				<span class="branch-label">Branch:</span>
				{#if branchLoading}
					<span class="branch-name muted">Checking…</span>
				{:else if currentBranch}
					<span class="branch-name">{currentBranch}</span>
				{:else}
					<span class="branch-name muted">Unknown</span>
				{/if}
				{#if branches.length > 0}
					<span class="branch-label">Existing:</span>
					<div class="picker-branch-wrapper">
						{#if branches.length > 1}
							<button
								class="branch-tag branch-tag-btn"
								onclick={(e) => {
									pickerBranchAnchor = e.currentTarget as HTMLElement;
									pickerBranchDropdownOpen = !pickerBranchDropdownOpen;
								}}
							>{pickerBranch} ▾</button>
						{:else}
							<span class="branch-tag">{pickerBranch}</span>
						{/if}
						<DropdownMenu
							open={pickerBranchDropdownOpen}
							anchor={pickerBranchDropdownOpen ? (pickerBranchAnchor ?? undefined) : undefined}
							items={branches.map((b) => ({ label: b, value: b }))}
							onSelect={(value) => { if (value) { pickerBranch = value; pickerBranchDropdownOpen = false; } }}
							onClose={() => (pickerBranchDropdownOpen = false)}
						/>
					</div>
				{/if}
				<div class="strategy-buttons">
					{#if selectedWorktreeEntry}
						<button class="strategy-btn active">Work in this worktree</button>
					{:else}
						{#if selectedIsWorktreeBase}
							<button
								class="strategy-btn"
								class:active={branchStrategy === 'new-worktree'}
								onclick={() => (branchStrategy = 'new-worktree')}
							>New worktree</button>
						{/if}
						<button
							class="strategy-btn"
							class:active={branchStrategy === 'current'}
							onclick={() => (branchStrategy = 'current')}
						>Work in this branch</button>
						<button
							class="strategy-btn"
							class:active={branchStrategy === 'new-from-current'}
							onclick={() => (branchStrategy = 'new-from-current')}
						>New branch from here</button>
						<button
							class="strategy-btn"
							class:active={branchStrategy === 'new-from-master'}
							onclick={() => (branchStrategy = 'new-from-master')}
						>New branch from master</button>
						{#if branches.length > 0}
							<button
								class="strategy-btn"
								class:active={branchStrategy === 'existing'}
								onclick={() => (branchStrategy = 'existing')}
							>Work in existing branch</button>
						{/if}
					{/if}
				</div>
			</div>
			<div class="comments-section">
				<span class="comments-label">Comments:</span>
				<div class="comments-options">
					<button
						class="strategy-btn"
						class:active={commentsMode === 'override'}
						onclick={() => { commentsMode = 'override'; fetchPreviewText(); }}
					>decisions override description</button>
					<button
						class="strategy-btn"
						class:active={commentsMode === 'secondary'}
						onclick={() => { commentsMode = 'secondary'; fetchPreviewText(); }}
					>description is primary</button>
					<button
						class="strategy-btn"
						class:active={commentsMode === 'exclude'}
						onclick={() => { commentsMode = 'exclude'; fetchPreviewText(); }}
					>exclude</button>
				</div>
			</div>
			<div class="flags-section">
				<span class="flags-label">Claude flags:</span>
				<div class="flags-options">
					<button
						class="flag-btn"
						class:active={flagChrome}
						onclick={() => (flagChrome = !flagChrome)}
					>chrome</button>
					<button
						class="flag-btn"
						class:active={flagResume}
						onclick={() => {
							flagResume = !flagResume;
							if (flagResume && sessions.length === 0) loadSessions();
						}}
					>resume conversation</button>
				</div>
				{#if flagResume}
					<div class="sessions-list">
						{#if sessionsLoading}
							<p class="sessions-status">Loading sessions…</p>
						{:else if sessions.length === 0}
							<p class="sessions-status">No sessions found.</p>
						{:else}
							{#each sessions as session (session.id)}
								<button
									class="session-btn"
									class:selected={selectedSessionId === session.id}
									onclick={() => (selectedSessionId = session.id)}
								>
									<span class="session-date">{session.date}</span>
									<span class="session-summary">{session.summary}</span>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
			{#if previewLoading}
				<p class="status">Building prompt…</p>
			{:else if previewError}
				<p class="error">{previewError}</p>
			{:else}
				<textarea class="prompt-textarea" bind:value={previewText} spellcheck="false"></textarea>
				{#if branchAppendix}
					<pre class="branch-appendix">{branchAppendix}</pre>
				{/if}
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

	.tag-worktree {
		background: color-mix(in srgb, var(--color-success, #16a34a) 12%, transparent);
		color: var(--color-success, #16a34a);
	}

	.tag-worktree-base {
		background: color-mix(in srgb, #2563eb 12%, transparent);
		color: #2563eb;
	}

	.worktrees-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		margin: 10px 0 4px;
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

	.branch-section {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
		flex-wrap: wrap;
	}

	.branch-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.branch-name {
		font-family: monospace;
		font-size: 12px;
		color: var(--color-text);
		flex-shrink: 0;
	}

	.branch-name.muted {
		color: var(--color-text-muted);
		font-style: italic;
	}

	.picker-branch-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.branch-tag {
		font-family: monospace;
		font-size: 11px;
		font-weight: 500;
		padding: 2px 7px;
		border-radius: var(--radius);
		background: var(--color-gray-muted);
		color: var(--color-text-muted);
		white-space: nowrap;
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		display: inline-block;
		vertical-align: middle;
	}

	.branch-tag-btn {
		border: 1px solid var(--color-border);
		cursor: pointer;
		font-family: monospace;
		transition: background 0.1s ease, color 0.1s ease;
	}

	.branch-tag-btn:hover {
		background: var(--color-border);
		color: var(--color-text);
	}

	.strategy-buttons {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}

	.strategy-btn {
		padding: 4px 10px;
		font-family: inherit;
		font-size: 12px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.1s ease, border-color 0.1s ease, color 0.1s ease;
	}

	.strategy-btn:hover {
		background: var(--color-gray-muted);
		color: var(--color-text);
	}

	.strategy-btn.active {
		background: var(--color-primary-muted);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.branch-appendix {
		margin: 4px 0 0;
		padding: 8px 12px;
		font-family: monospace;
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-text-muted);
		background: var(--color-gray-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		white-space: pre-wrap;
		word-break: break-word;
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

	.comments-section,
	.flags-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 10px;
	}

	.comments-label,
	.flags-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}

	.comments-options,
	.flags-options {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.flag-btn {
		padding: 4px 10px;
		font-family: monospace;
		font-size: 12px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.1s ease, border-color 0.1s ease, color 0.1s ease;
	}

	.flag-btn:hover {
		background: var(--color-gray-muted);
		color: var(--color-text);
	}

	.flag-btn.active {
		background: var(--color-primary-muted);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.sessions-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-left: 2px;
	}

	.sessions-status {
		font-size: 12px;
		color: var(--color-text-muted);
		margin: 0;
		font-style: italic;
	}

	.session-btn {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 5px 10px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-family: inherit;
		font-size: 12px;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease, border-color 0.1s ease;
		min-width: 0;
	}

	.session-btn:hover {
		background: var(--color-gray-muted);
	}

	.session-btn.selected {
		background: var(--color-primary-muted);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.session-date {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.session-btn.selected .session-date {
		color: var(--color-primary);
		opacity: 0.8;
	}

	.session-summary {
		font-family: monospace;
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
</style>
