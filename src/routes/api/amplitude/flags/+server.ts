import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { fetchAllFlags } from '$lib/api/amplitude';
import type { AmplitudeFlag } from '$lib/types';

let cachedFlags: AmplitudeFlag[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
	const apiKey = env.AMPLITUIDE_MANAGEMENT_KEY;
	if (!apiKey) {
		return json({ error: 'AMPLITUIDE_MANAGEMENT_KEY not configured' }, { status: 500 });
	}

	const now = Date.now();
	if (cachedFlags && now - cacheTime < CACHE_TTL) {
		return json(cachedFlags);
	}

	try {
		cachedFlags = await fetchAllFlags(apiKey);
		cacheTime = now;
		return json(cachedFlags);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch flags';
		return json({ error: message }, { status: 502 });
	}
}
