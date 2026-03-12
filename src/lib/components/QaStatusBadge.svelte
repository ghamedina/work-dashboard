<script lang="ts">
	import type { UnifiedPR } from '$lib/types';
	import { computeQaStatus } from '$lib/qa-status';
	import BadgeButton from './BadgeButton.svelte';

	interface Props {
		pr: UnifiedPR;
	}

	let { pr }: Props = $props();

	const qaResult = $derived(computeQaStatus(pr));

	let dropdownOpen = $state(false);

	const activeJobs = $derived(
		pr.pipelineJobs.filter((j) => j.status === 'failed' || j.status === 'running')
	);

	function badgeVariant(status: string): string {
		if (status === 'qa') return 'primary';
		if (status === 'qa-test') return 'warning';
		if (status === 'qa-ci') return 'warning';
		if (status === 'qa-success') return 'success';
		if (status === 'qa-failed') return 'success';
		if (status === 'qa-deployed') return 'success';
		return 'gray';
	}

	function badgeLabel(status: string): string {
		if (status === 'qa-deployed') return 'qa-deploy';
		return status;
	}

	function handleClick() {
		if (!qaResult) return;
		const { status } = qaResult;

		if (status === 'qa-ci') {
			dropdownOpen = !dropdownOpen;
			return;
		}

		if (status === 'qa' || status === 'qa-failed' || status === 'qa-deployed') {
			if (pr.pipelineWebUrl) window.open(pr.pipelineWebUrl, '_blank', 'noopener,noreferrer');
			return;
		}

		window.open(pr.webUrl, '_blank', 'noopener,noreferrer');
	}

	function openJob(webUrl: string) {
		window.open(webUrl, '_blank', 'noopener,noreferrer');
		dropdownOpen = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') dropdownOpen = false;
	}
</script>

{#if qaResult}
	<div class="qa-wrapper">
		<BadgeButton
			label={badgeLabel(qaResult.status)}
			colorToken={badgeVariant(qaResult.status)}
			onclick={handleClick}
			onkeydown={handleKeydown}
			badge={qaResult.circleBadge}
		/>

		{#if dropdownOpen}
			<div class="job-dropdown" role="menu">
				{#if activeJobs.length === 0}
					<span class="job-empty">No active jobs</span>
				{:else}
					{#each activeJobs as job (job.id)}
						<button
							class="job-item"
							onclick={() => openJob(job.webUrl)}
							role="menuitem"
						>
							<span class={`job-dot job-dot-${job.status}`}></span>
							{job.name}
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.qa-wrapper {
		position: relative;
		display: inline-flex;
	}

	.job-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 100;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
		min-width: 180px;
		max-width: 300px;
		padding: 4px 0;
	}

	.job-empty {
		display: block;
		padding: 6px 12px;
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.job-item {
		display: flex;
		align-items: center;
		gap: 7px;
		width: 100%;
		padding: 5px 12px;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text);
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: background 0.1s ease;
	}

	.job-item:hover {
		background: var(--color-gray-muted);
	}

	.job-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.job-dot-failed {
		background: var(--color-danger);
	}

	.job-dot-running {
		background: var(--color-primary);
	}
</style>
