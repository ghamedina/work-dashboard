<script lang="ts">
	const STORAGE_KEY = 'dashboard-update-dismissed';
	const COMMITS_URL = 'https://github.com/norrichs/work-dashboard/commits/main';

	let remoteSHA = $state<string | null>(null);
	let visible = $state(false);

	$effect(() => {
		fetch('/api/self-update')
			.then((res) => (res.ok ? res.json() : null))
			.then((data: { status: string; remoteSHA: string } | null) => {
				if (!data || data.status !== 'behind') return;
				const dismissed = localStorage.getItem(STORAGE_KEY);
				if (dismissed === data.remoteSHA) return;
				remoteSHA = data.remoteSHA;
				visible = true;
			})
			.catch(() => {});
	});

	function dismiss() {
		if (remoteSHA) localStorage.setItem(STORAGE_KEY, remoteSHA);
		visible = false;
	}
</script>

{#if visible}
	<div class="banner">
		<span class="message">
			New features available —
			<a href={COMMITS_URL} target="_blank" rel="noopener noreferrer" class="link">
				view changelog ↗
			</a>
		</span>
		<button class="dismiss" onclick={dismiss} aria-label="Dismiss">×</button>
	</div>
{/if}

<style>
	.banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 16px;
		background: var(--color-purple-muted);
		border-bottom: 1px solid var(--color-border);
		font-size: 12px;
		color: var(--color-purple);
	}

	.message {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.link {
		color: var(--color-purple);
		font-weight: 600;
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.dismiss {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: var(--color-purple);
		line-height: 1;
		padding: 0 2px;
		font-family: inherit;
		opacity: 0.7;
		transition: opacity 0.1s ease;
	}

	.dismiss:hover {
		opacity: 1;
	}
</style>
