<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Container from '$lib/components/Container.svelte';
	import Controls from '$lib/components/Controls.svelte';
	import Loader from '$lib/components/Loader.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import ReviewsTable from '$lib/components/ReviewsTable.svelte';
	import SlackTodosCard from '$lib/components/SlackTodosCard.svelte';
	import DocsReviewsCard from '$lib/components/DocsReviewsCard.svelte';
	import WeeklyUpdateCard from '$lib/components/WeeklyUpdateCard.svelte';
	import Tabs, { type TabDef } from '$lib/components/Tabs.svelte';
	import Button from '$lib/components/Button.svelte';
	import FlagSwitcher from '$lib/components/FlagSwitcher.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';
	import type { RenderMode } from '$lib/types';
	import type { PageData } from './$types';

	const DONE_STATUSES = ['Done', 'Closed', 'Resolved'];
	const STORAGE_KEY = 'dashboard-status-filters';
	const ACTIVE_TAB_KEY = 'dashboard-active-tab';

	let { data }: { data: PageData } = $props();
	let mode = $state<RenderMode>('compact');
	let gitlabVpnError = $state(false);
	let allStatuses = $state<string[]>([]);
	let enabledStatuses = $state<Set<string>>(new Set());
	let initialized = $state(false);

	let reviewsCount = $state<number | undefined>(undefined);
	let slackCount = $state<number | undefined>(undefined);
	let docsCount = $state<number | undefined>(undefined);

	let active = $state('work');
	let tabRestored = $state(false);

	const visibleTabIds = $derived.by(() => {
		const ids = ['work', 'reviews'];
		if (data.slackConfigured) ids.push('slack');
		if (data.confluenceConfigured) ids.push('docs');
		if (data.managerConfigured) ids.push('manager');
		return ids;
	});

	const tabs = $derived<TabDef[]>(
		visibleTabIds.map((id) => {
			if (id === 'work') return { id, label: 'Work' };
			if (id === 'reviews') return { id, label: 'Reviews', count: reviewsCount };
			if (id === 'slack') return { id, label: 'Slack Todos', count: slackCount };
			if (id === 'docs') return { id, label: 'Doc Reviews', count: docsCount };
			return { id, label: 'My Manager' };
		})
	);

	$effect(() => {
		data.streamed.gitlabVpnError.then((v) => { gitlabVpnError = v; });
	});

	$effect(() => {
		data.streamed.jiraStatuses.then((statuses: string[]) => {
			if (statuses.length > 0) {
				allStatuses = statuses;
				if (!initialized) {
					initializeEnabledStatuses(statuses);
				}
			}
		});
	});

	$effect(() => {
		data.streamed.reviews.then((r) => {
			if (r.data) reviewsCount = r.data.items.length;
		});
	});

	$effect(() => {
		data.streamed.slackTodos.then((r) => {
			if (r.data) slackCount = r.data.length;
		});
	});

	$effect(() => {
		data.streamed.docsReviews.then((r) => {
			if (r.data) docsCount = r.data.length;
		});
	});

	$effect(() => {
		if (tabRestored) return;
		if (typeof localStorage === 'undefined') return;
		const stored = localStorage.getItem(ACTIVE_TAB_KEY);
		if (stored && visibleTabIds.includes(stored)) {
			active = stored;
		} else if (!visibleTabIds.includes(active)) {
			active = visibleTabIds[0] ?? 'work';
		}
		tabRestored = true;
	});

	$effect(() => {
		if (!tabRestored) return;
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(ACTIVE_TAB_KEY, active);
	});

	function initializeEnabledStatuses(statuses: string[]) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed: string[] = JSON.parse(stored);
				enabledStatuses = new Set(parsed.filter((s) => statuses.includes(s)));
				initialized = true;
				return;
			}
		} catch {}
		enabledStatuses = new Set(statuses.filter((s) => !DONE_STATUSES.includes(s)));
		initialized = true;
	}

	function persistStatuses() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabledStatuses]));
		} catch {}
	}

	function handleReload() {
		invalidateAll();
	}

	function handleToggleStatus(status: string) {
		const next = new Set(enabledStatuses);
		if (next.has(status)) {
			next.delete(status);
		} else {
			next.add(status);
		}
		enabledStatuses = next;
		persistStatuses();
	}
</script>

<svelte:head>
	<title>Dashboard</title>
</svelte:head>

<UpdateBanner />

<Tabs {tabs} bind:active onReload={handleReload} />

<Container>
	{#if active === 'work'}
		<Controls
			bind:mode
			statuses={allStatuses}
			{enabledStatuses}
			onToggleStatus={handleToggleStatus}
			onSelectAll={() => { enabledStatuses = new Set(allStatuses); persistStatuses(); }}
			onDeselectAll={() => { enabledStatuses = new Set(); persistStatuses(); }}
		/>

		{#await data.streamed.rows}
			<Loader
				jiraStatus={data.streamed.jiraStatus}
				gitlabStatus={data.streamed.gitlabStatus}
				githubStatus={data.githubConfigured ? data.streamed.githubStatus : undefined}
			/>
		{:then result}
			{#if result.data !== null}
				<DataTable rows={result.data.filter((r) => enabledStatuses.has(r.jiraItem.status))} {mode} gitlabUnavailable={gitlabVpnError} jiraStatuses={data.jiraStatuses} prStatuses={data.prStatuses} />
			{:else}
				<div class="error-state">
					<p>Failed to load dashboard data.</p>
					<p class="error-detail">{result.error}</p>
					<Button variant="primary" label="Try again" onclick={handleReload} />
				</div>
			{/if}
		{/await}
	{:else if active === 'reviews'}
		{#await data.streamed.reviews}
			<div class="panel-loading">Loading reviews…</div>
		{:then result}
			{#if result.data !== null}
				<ReviewsTable reviews={result.data.items} errors={result.data.errors} />
			{:else}
				<div class="error-state">
					<p>Failed to load reviews.</p>
					<p class="error-detail">{result.error}</p>
				</div>
			{/if}
		{/await}
	{:else if active === 'slack'}
		{#await data.streamed.slackTodos}
			<div class="panel-loading">Loading Slack todos…</div>
		{:then result}
			{#if result.data !== null}
				<SlackTodosCard todos={result.data} emojiName={data.slackEmojiName} />
			{:else if result.error}
				<div class="error-state">
					<p>Failed to load Slack todos.</p>
					<p class="error-detail">{result.error}</p>
				</div>
			{/if}
		{/await}
	{:else if active === 'docs'}
		{#await data.streamed.docsReviews}
			<div class="panel-loading">Loading starred docs…</div>
		{:then result}
			{#if result.data !== null}
				<DocsReviewsCard pages={result.data} />
			{:else if result.error}
				<div class="error-state">
					<p>Failed to load starred docs.</p>
					<p class="error-detail">{result.error}</p>
				</div>
			{/if}
		{/await}
	{:else if active === 'manager'}
		{#await data.streamed.weekly}
			<div class="panel-loading">Loading weekly update…</div>
		{:then result}
			<WeeklyUpdateCard week={result.week} teams={result.teams} />
		{/await}
	{/if}
</Container>

<FlagSwitcher amplitudeOrgSlug={data.amplitudeOrgSlug} />

<style>
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 24px;
		gap: 8px;
		color: var(--color-text-muted);
	}

	.error-detail {
		font-size: 12px;
		color: var(--color-danger);
		font-family: monospace;
	}

	.panel-loading {
		padding: 24px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: 12px;
	}
</style>
