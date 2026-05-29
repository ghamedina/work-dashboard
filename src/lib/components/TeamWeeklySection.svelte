<script lang="ts">
	import NotesEditor from './NotesEditor.svelte';
	import type { WeeklyTeamActivity, WeeklyJiraTicket, WeeklyPR } from '$lib/types';
	import { notesStorageKey } from '$lib/managerWeek';
	import type { IsoWeek } from '$lib/managerWeek';

	interface Props {
		teamName: string;
		activity: WeeklyTeamActivity | null;   // null if the per-team fetch errored
		error: string | null;
		week: IsoWeek;
	}

	let { teamName, activity, error, week }: Props = $props();

	const storageKey = $derived(notesStorageKey(teamName, week));

	function openLink(url: string) {
		window.open(url, '_blank', 'noopener');
	}

	function isEmptyAuto(a: WeeklyTeamActivity): boolean {
		if (!a.autoPull) return false;
		const j = a.jira;
		const p = a.prs;
		if (!j || !p) return true;
		return (
			j.done.length + j.inFlight.length + j.started.length +
			p.merged.length + p.opened.length + p.updated.length === 0
		);
	}
</script>

<section class="team-section">
	<header class="team-header">
		<h3>{teamName}</h3>
	</header>

	{#if error}
		<div class="team-error">Failed to load activity: {error}</div>
	{:else if activity && activity.autoPull}
		{#if isEmptyAuto(activity)}
			<div class="team-empty">No tracked activity this week.</div>
		{:else}
			{@const jira = activity.jira!}
			{@const prs = activity.prs!}

			{#if jira.done.length > 0}
				<div class="bucket">
					<h4>Done this week</h4>
					<ul>
						{#each jira.done as t (t.key)}
							<li>
								<button class="link" onclick={() => openLink(t.url)}>{t.key}</button>
								— {t.summary}
								{#if t.assigneeName}<span class="who"> · {t.assigneeName}</span>{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if jira.inFlight.length > 0}
				<div class="bucket">
					<h4>In flight</h4>
					<ul>
						{#each jira.inFlight as t (t.key)}
							<li>
								<button class="link" onclick={() => openLink(t.url)}>{t.key}</button>
								— {t.summary}
								<span class="status">[{t.status}]</span>
								{#if t.assigneeName}<span class="who"> · {t.assigneeName}</span>{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if jira.started.length > 0}
				<div class="bucket">
					<h4>Started this week</h4>
					<ul>
						{#each jira.started as t (t.key)}
							<li>
								<button class="link" onclick={() => openLink(t.url)}>{t.key}</button>
								— {t.summary}
								{#if t.assigneeName}<span class="who"> · {t.assigneeName}</span>{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if prs.merged.length > 0}
				<div class="bucket">
					<h4>PRs/MRs merged this week</h4>
					<ul>
						{#each prs.merged as p (`${p.source}-${p.id}`)}
							<li>
								<span class="badge">{p.source === 'gitlab' ? '!' : '#'}{p.id}</span>
								<button class="link" onclick={() => openLink(p.webUrl)}>{p.title}</button>
								<span class="who"> · {p.authorUsername}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if prs.opened.length > 0}
				<div class="bucket">
					<h4>PRs/MRs opened this week</h4>
					<ul>
						{#each prs.opened as p (`${p.source}-${p.id}`)}
							<li>
								<span class="badge">{p.source === 'gitlab' ? '!' : '#'}{p.id}</span>
								<button class="link" onclick={() => openLink(p.webUrl)}>{p.title}</button>
								<span class="who"> · {p.authorUsername}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if prs.updated.length > 0}
				<div class="bucket">
					<h4>PRs/MRs with activity this week</h4>
					<ul>
						{#each prs.updated as p (`${p.source}-${p.id}`)}
							<li>
								<span class="badge">{p.source === 'gitlab' ? '!' : '#'}{p.id}</span>
								<button class="link" onclick={() => openLink(p.webUrl)}>{p.title}</button>
								<span class="who"> · {p.authorUsername}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	{/if}

	<NotesEditor {storageKey} />
</section>

<style>
	.team-section {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		margin-bottom: 16px;
		background: var(--color-surface);
	}

	.team-header {
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.team-header h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.bucket {
		padding: 8px 16px 12px;
		border-bottom: 1px dashed var(--color-border);
	}

	.bucket h4 {
		margin: 8px 0 6px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.bucket ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bucket li {
		font-size: 13px;
		line-height: 1.4;
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--color-primary);
		cursor: pointer;
		text-align: left;
	}

	.link:hover {
		text-decoration: underline;
	}

	.badge {
		display: inline-block;
		min-width: 36px;
		text-align: right;
		font-size: 11px;
		color: var(--color-text-muted);
		font-family: monospace;
		margin-right: 4px;
	}

	.status {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.who {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.team-empty,
	.team-error {
		padding: 16px;
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.team-error {
		color: var(--color-danger);
		font-family: monospace;
	}
</style>
