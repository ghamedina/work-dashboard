<script lang="ts">
	import type { MeetingsSummary } from '$lib/types';

	interface Props {
		initial: MeetingsSummary | null;
		error: string | null;
	}

	let { initial, error: initialError }: Props = $props();

	let summary = $state<MeetingsSummary | null>(initial);
	let error = $state<string | null>(initialError);
	let regenerating = $state(false);

	async function regenerate() {
		regenerating = true;
		error = null;
		try {
			const r = await fetch('/api/meetings/regenerate', { method: 'POST' });
			if (!r.ok) {
				const text = await r.text().catch(() => '');
				throw new Error(`HTTP ${r.status}: ${text || 'regenerate failed'}`);
			}
			const next: MeetingsSummary = await r.json();
			summary = next;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			regenerating = false;
		}
	}

	function openLink(url: string) {
		window.open(url, '_blank', 'noopener');
	}
</script>

<section class="meetings-block">
	<header class="meetings-header">
		<h3>Meetings this week</h3>
		<button
			class="regen-btn"
			onclick={regenerate}
			disabled={regenerating}
			aria-label="Regenerate meetings summary"
		>
			{regenerating ? 'Regenerating…' : 'Regenerate'}
		</button>
	</header>

	{#if error}
		<div class="meetings-error">Failed to summarize meetings: {error}</div>
		{#if summary && summary.meetings.length > 0}
			<ul class="fallback-titles">
				{#each summary.meetings as m (m.id)}
					<li>
						<button class="link" onclick={() => openLink(m.notionUrl)}>{m.title}</button>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if !summary || summary.meetingsCount === 0}
		<div class="meetings-empty">No meetings recorded this week.</div>
	{:else}
		<ul class="bullets">
			{#each summary.bullets as bullet, i (i)}
				<li>{bullet}</li>
			{/each}
		</ul>
		{#if summary.meetings.length > 0}
			<details class="sources">
				<summary>Source meetings ({summary.meetings.length})</summary>
				<ul>
					{#each summary.meetings as m (m.id)}
						<li>
							<button class="link" onclick={() => openLink(m.notionUrl)}>{m.title}</button>
							{#if m.attendees.length > 0}
								<span class="who"> · {m.attendees.join(', ')}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
</section>

<style>
	.meetings-block {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-surface);
		margin: 0 16px 16px;
	}

	.meetings-header {
		padding: 12px 16px;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid var(--color-border);
	}

	.meetings-header h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.regen-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 4px 10px;
		font: inherit;
		font-size: 11px;
		color: var(--color-text);
		cursor: pointer;
	}

	.regen-btn:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.regen-btn:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.bullets {
		list-style: disc;
		margin: 0;
		padding: 12px 16px 12px 32px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.bullets li {
		font-size: 13px;
		line-height: 1.4;
	}

	.meetings-empty,
	.meetings-error {
		padding: 16px;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.meetings-error {
		color: var(--color-danger);
		font-family: monospace;
	}

	.sources {
		padding: 4px 16px 12px;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.sources summary {
		cursor: pointer;
		padding: 4px 0;
	}

	.sources ul {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--color-primary);
		cursor: pointer;
	}

	.link:hover {
		text-decoration: underline;
	}

	.who {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.fallback-titles {
		list-style: disc;
		margin: 0;
		padding: 8px 16px 12px 32px;
		font-size: 12px;
		color: var(--color-text-muted);
	}
</style>
