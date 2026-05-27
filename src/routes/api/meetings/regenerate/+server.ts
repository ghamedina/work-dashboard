import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig } from '$lib/config';
import { getCurrentIsoWeek } from '$lib/managerWeek';
import { regenerateMeetingsSummary } from '$lib/api/meetingsSummary';

export const POST: RequestHandler = async () => {
	const config = getConfig();
	if (!config.notionConfigured) {
		throw error(400, 'Notion is not configured in settings.yml');
	}

	const week = getCurrentIsoWeek();
	try {
		const summary = await regenerateMeetingsSummary(config, week);
		return json(summary);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, message);
	}
};
