<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Container from '$lib/components/Container.svelte';
	import Controls from '$lib/components/Controls.svelte';
	import Loader from '$lib/components/Loader.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import Button from '$lib/components/Button.svelte';
	import FlagSwitcher from '$lib/components/FlagSwitcher.svelte';
	import type { RenderMode } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let mode = $state<RenderMode>('compact');

	function handleReload() {
		invalidateAll();
	}
</script>

<svelte:head>
	<title>Dashboard</title>
</svelte:head>

<Container>
	<Controls bind:mode onReload={handleReload} />

	{#await data.streamed.rows}
		<Loader jiraStatus={data.streamed.jiraStatus} gitlabStatus={data.streamed.gitlabStatus} />
	{:then result}
		{#if result.data !== null}
			<DataTable rows={result.data} {mode} />
		{:else}
			<div class="error-state">
				<p>Failed to load dashboard data.</p>
				<p class="error-detail">{result.error}</p>
				<Button variant="primary" label="Try again" onclick={handleReload} />
			</div>
		{/if}
	{/await}
</Container>

<FlagSwitcher />

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
</style>
