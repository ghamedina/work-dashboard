import type { DashboardConfig } from '$lib/config';
import type { IsoWeek } from '$lib/managerWeek';
import { formatIsoWeekLabel } from '$lib/managerWeek';
import type { MeetingNote, MeetingsSummary } from '$lib/types';
import { fetchMeetingsForWeek } from './notion';
import { runClaudePrompt } from './claudeCli';
import { readCache, writeCache, clearCache } from '$lib/meetingsCache';

const SYSTEM_PROMPT = `You are summarizing a user's meetings this week for their manager.
Output one bullet per meeting in the order given. Choose the most natural
phrasing per bullet — past tense, third person. Each bullet should convey:
who was met with and what was discussed.
Keep bullets concise (one line each, ~15 words max).
Output only the bullets, one per line, each starting with "- ".
No preamble, no commentary, no summary line.`;

function buildUserPrompt(week: IsoWeek, meetings: MeetingNote[]): string {
	const lines: string[] = [];
	lines.push(`Week of ${formatIsoWeekLabel(week)}.`);
	lines.push('');
	meetings.forEach((m, i) => {
		const attendees = m.attendees.length > 0 ? m.attendees.join(', ') : '(unknown)';
		const notes = m.notesPreview.slice(0, 500);
		lines.push(`[Meeting ${i + 1}]`);
		lines.push(`Title: ${m.title}`);
		lines.push(`Date: ${m.date}`);
		lines.push(`Attendees: ${attendees}`);
		lines.push(`Notes: ${notes}`);
		lines.push('');
	});
	return lines.join('\n');
}

function parseBullets(output: string): string[] {
	return output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.startsWith('- '))
		.map((line) => line.slice(2).trim())
		.filter(Boolean);
}

async function buildSummary(
	config: DashboardConfig,
	week: IsoWeek
): Promise<MeetingsSummary> {
	const meetings = await fetchMeetingsForWeek(config, week.start);

	if (meetings.length === 0) {
		return {
			generatedAt: new Date().toISOString(),
			isoWeekYear: week.year,
			isoWeekNumber: week.week,
			bullets: [],
			meetingsCount: 0,
			meetings: []
		};
	}

	const userPrompt = buildUserPrompt(week, meetings);
	const output = await runClaudePrompt(config.claudeCli, SYSTEM_PROMPT, userPrompt);
	const bullets = parseBullets(output);

	return {
		generatedAt: new Date().toISOString(),
		isoWeekYear: week.year,
		isoWeekNumber: week.week,
		bullets,
		meetingsCount: meetings.length,
		meetings
	};
}

export async function getMeetingsSummary(
	config: DashboardConfig,
	week: IsoWeek
): Promise<MeetingsSummary> {
	const cached = readCache(week);
	if (cached) return cached;

	const summary = await buildSummary(config, week);
	writeCache(week, summary);
	return summary;
}

export async function regenerateMeetingsSummary(
	config: DashboardConfig,
	week: IsoWeek
): Promise<MeetingsSummary> {
	clearCache(week);
	const summary = await buildSummary(config, week);
	writeCache(week, summary);
	return summary;
}
