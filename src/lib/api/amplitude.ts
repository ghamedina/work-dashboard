import type { AmplitudeFlag, AmplitudeTargetSegment } from '$lib/types';

export async function fetchAllFlags(apiKey: string, baseUrl: string): Promise<AmplitudeFlag[]> {
	const allFlags: AmplitudeFlag[] = [];
	let cursor: string | null = null;

	do {
		const url =
			`${baseUrl}/flags?limit=1000` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
		const res = await fetch(url, {
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${apiKey}`
			}
		});

		if (!res.ok) throw new Error(`Amplitude API error: ${res.status}`);

		const data = (await res.json()) as { flags: AmplitudeFlag[]; nextCursor?: string };
		allFlags.push(...data.flags);
		cursor = data.nextCursor || null;
	} while (cursor);

	return allFlags;
}

export async function fetchFlagByKey(
	key: string,
	apiKey: string,
	baseUrl: string
): Promise<AmplitudeFlag | null> {
	const url = `${baseUrl}/flags?key=${encodeURIComponent(key)}`;
	const res = await fetch(url, {
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${apiKey}`
		}
	});

	if (!res.ok) throw new Error(`Amplitude API error: ${res.status}`);

	const data = (await res.json()) as { flags: AmplitudeFlag[] };
	return data.flags[0] ?? null;
}

export async function patchFlagSegments(
	flagId: string,
	targetSegments: AmplitudeTargetSegment[],
	apiKey: string,
	baseUrl: string
): Promise<void> {
	const url = `${baseUrl}/flags/${flagId}`;
	const res = await fetch(url, {
		method: 'PATCH',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({ targetSegments })
	});

	if (!res.ok) throw new Error(`Amplitude PATCH error: ${res.status}`);
}
