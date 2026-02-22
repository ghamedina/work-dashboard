<script lang="ts">
	type ApiResult<T> = { data: T; error: null } | { data: null; error: string };

	interface ApiStatus {
		count: number;
	}

	interface Props {
		jiraStatus: Promise<ApiResult<ApiStatus>>;
		gitlabStatus: Promise<ApiResult<ApiStatus>>;
	}

	let { jiraStatus, gitlabStatus }: Props = $props();
</script>

<div class="loader">
	<div class="spinner" aria-label="Loading"></div>

	<div class="status-lines">
		{#await jiraStatus}
			<div class="status-line pending">
				<span class="dot"></span>
				Fetching Jira items...
			</div>
		{:then result}
			{#if result.data !== null}
				<div class="status-line success">
					<span class="icon">✓</span>
					{result.data.count} Jira {result.data.count === 1 ? 'item' : 'items'}
				</div>
			{:else}
				<div class="status-line error">
					<span class="icon">✗</span>
					Failed to fetch Jira items
				</div>
			{/if}
		{/await}

		{#await gitlabStatus}
			<div class="status-line pending">
				<span class="dot"></span>
				Fetching GitLab MRs...
			</div>
		{:then result}
			{#if result.data !== null}
				<div class="status-line success">
					<span class="icon">✓</span>
					{result.data.count} GitLab {result.data.count === 1 ? 'MR' : 'MRs'}
				</div>
			{:else}
				<div class="status-line error">
					<span class="icon">✗</span>
					Failed to fetch GitLab MRs
				</div>
			{/if}
		{/await}
	</div>
</div>

<style>
	.loader {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 64px 24px;
		gap: 24px;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.status-lines {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 200px;
	}

	.status-line {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.status-line.success {
		color: var(--color-success);
	}

	.status-line.error {
		color: var(--color-danger);
	}

	.icon {
		font-size: 12px;
		width: 14px;
		text-align: center;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-border);
		animation: pulse 1.2s ease-in-out infinite;
		flex-shrink: 0;
		margin-left: 4px;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}
</style>
