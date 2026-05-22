import type { DashboardConfig } from '$lib/config';
import type { ConfluenceStarredPage } from '$lib/types';

interface CurrentUserResponse {
	accountId: string;
}

interface V2FavoriteResult {
	id?: string;
	title?: string;
	createdAt?: string;
	space?: { name?: string; key?: string };
	_links?: { webui?: string };
}

interface V2FavoritesResponse {
	results?: V2FavoriteResult[];
	_links?: { next?: string };
}

interface CqlSearchResult {
	content?: {
		id?: string;
		title?: string;
		space?: { name?: string };
		history?: { lastUpdated?: { when?: string } };
		_links?: { webui?: string };
	};
	url?: string;
	lastModified?: string;
}

interface CqlSearchResponse {
	results?: CqlSearchResult[];
	_links?: { next?: string };
}

export async function fetchStarredPages(
	config: DashboardConfig
): Promise<ConfluenceStarredPage[]> {
	if (!config.confluence) throw new Error('Confluence is not configured');
	const { token, email, baseUrl, since } = config.confluence;

	const sinceMs = Date.parse(since);
	if (Number.isNaN(sinceMs)) {
		throw new Error(`Invalid confluence.since date: ${since}`);
	}

	const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
	const accountId = await fetchAccountId(baseUrl, authHeader);

	const v2Pages = await tryFetchViaV2Favorites(baseUrl, authHeader, accountId).catch(
		() => null
	);

	if (v2Pages !== null) {
		return v2Pages
			.filter((p) => p.starredAt >= sinceMs)
			.sort((a, b) => b.starredAt - a.starredAt);
	}

	const cqlPages = await fetchViaCqlSearch(baseUrl, authHeader);
	return cqlPages
		.filter((p) => p.starredAt >= sinceMs)
		.sort((a, b) => b.starredAt - a.starredAt);
}

async function fetchAccountId(baseUrl: string, authHeader: string): Promise<string> {
	const response = await fetch(`${baseUrl}/rest/api/user/current`, {
		headers: { Authorization: authHeader, Accept: 'application/json' }
	});
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Confluence /user/current ${response.status}: ${body}`);
	}
	const data = (await response.json()) as CurrentUserResponse;
	if (!data.accountId) throw new Error('Confluence /user/current missing accountId');
	return data.accountId;
}

async function tryFetchViaV2Favorites(
	baseUrl: string,
	authHeader: string,
	accountId: string
): Promise<ConfluenceStarredPage[]> {
	const pages: ConfluenceStarredPage[] = [];
	let url: string | null =
		`${baseUrl}/api/v2/users/${accountId}/relations/favorite?entityType=page&limit=250`;

	while (url) {
		const response = await fetch(url, {
			headers: { Authorization: authHeader, Accept: 'application/json' }
		});
		if (!response.ok) {
			throw new Error(`Confluence v2 favorites ${response.status}`);
		}
		const data = (await response.json()) as V2FavoritesResponse;
		for (const r of data.results ?? []) {
			if (!r.id || !r.createdAt) {
				throw new Error('Confluence v2 favorites response missing createdAt');
			}
			const starredAt = Date.parse(r.createdAt);
			if (Number.isNaN(starredAt)) {
				throw new Error('Confluence v2 favorites createdAt unparseable');
			}
			pages.push({
				id: r.id,
				title: r.title ?? '(untitled)',
				spaceName: r.space?.name ?? r.space?.key ?? '',
				webUrl: r._links?.webui ? `${baseUrl}${r._links.webui}` : baseUrl,
				starredAt,
				starredAtIsApprox: false
			});
		}
		url = data._links?.next ? resolveNext(baseUrl, data._links.next) : null;
	}

	return pages;
}

async function fetchViaCqlSearch(
	baseUrl: string,
	authHeader: string
): Promise<ConfluenceStarredPage[]> {
	const pages: ConfluenceStarredPage[] = [];
	const cql = encodeURIComponent('favourite = currentUser() AND type = page');
	let url: string | null =
		`${baseUrl}/rest/api/search?cql=${cql}&limit=250&expand=content.history,content.space`;

	while (url) {
		const response = await fetch(url, {
			headers: { Authorization: authHeader, Accept: 'application/json' }
		});
		if (!response.ok) {
			const body = await response.text().catch(() => '');
			throw new Error(`Confluence CQL search ${response.status}: ${body}`);
		}
		const data = (await response.json()) as CqlSearchResponse;
		for (const r of data.results ?? []) {
			const content = r.content;
			if (!content?.id) continue;
			const when = content.history?.lastUpdated?.when ?? r.lastModified;
			const lastModifiedMs = when ? Date.parse(when) : NaN;
			pages.push({
				id: content.id,
				title: content.title ?? '(untitled)',
				spaceName: content.space?.name ?? '',
				webUrl: content._links?.webui ? `${baseUrl}${content._links.webui}` : baseUrl,
				starredAt: Number.isFinite(lastModifiedMs) ? lastModifiedMs : 0,
				starredAtIsApprox: true
			});
		}
		url = data._links?.next ? resolveNext(baseUrl, data._links.next) : null;
	}

	return pages;
}

function resolveNext(baseUrl: string, next: string): string {
	if (next.startsWith('http')) return next;
	if (next.startsWith('/wiki/')) {
		const origin = new URL(baseUrl).origin;
		return `${origin}${next}`;
	}
	return `${baseUrl}${next.startsWith('/') ? '' : '/'}${next}`;
}
