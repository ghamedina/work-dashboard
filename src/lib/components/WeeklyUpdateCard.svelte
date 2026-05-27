<script lang="ts">
	import TeamWeeklySection from './TeamWeeklySection.svelte';
	import { formatIsoWeekLabel } from '$lib/managerWeek';
	import type { IsoWeek } from '$lib/managerWeek';
	import type { WeeklyTeamResult } from '$lib/types';

	interface Props {
		week: IsoWeek;
		teams: WeeklyTeamResult[];
	}

	let { week, teams }: Props = $props();
</script>

<div class="card">
	<header class="card-header">
		<h2>Weekly Update</h2>
		<span class="card-subtitle">{formatIsoWeekLabel(week)}</span>
	</header>

	{#if teams.length === 0}
		<div class="empty">No teams configured. Add a `teams:` block to settings.yml.</div>
	{:else}
		<div class="teams">
			{#each teams as t (t.name)}
				<TeamWeeklySection
					teamName={t.name}
					activity={t.activity.data}
					error={t.activity.error}
					{week}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.card-header {
		padding: 12px 16px;
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}

	.card-header h2 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.card-subtitle {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.teams {
		display: flex;
		flex-direction: column;
		padding: 0 16px 16px;
	}

	.empty {
		padding: 24px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: 12px;
	}
</style>
