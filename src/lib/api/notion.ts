import type { DashboardConfig } from '$lib/config';
import type { MeetingNote } from '$lib/types';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionTitleProp {
	type: 'title';
	title: Array<{ plain_text: string }>;
}

interface NotionDateProp {
	type: 'date';
	date: { start: string } | null;
}

interface NotionRichTextProp {
	type: 'rich_text';
	rich_text: Array<{ plain_text: string }>;
}

interface NotionMultiSelectProp {
	type: 'multi_select';
	multi_select: Array<{ name: string }>;
}

interface NotionPeopleProp {
	type: 'people';
	people: Array<{ name?: string }>;
}

type NotionProperty =
	| NotionTitleProp
	| NotionDateProp
	| NotionRichTextProp
	| NotionMultiSelectProp
	| NotionPeopleProp
	| { type: string };                            // catch-all for unhandled types

interface NotionPage {
	id: string;
	created_time: string;
	url: string;
	properties: Record<string, NotionProperty>;
}

interface NotionQueryResponse {
	results: NotionPage[];
}

interface NotionBlock {
	type: string;
	paragraph?: { rich_text: Array<{ plain_text: string }> };
	heading_1?: { rich_text: Array<{ plain_text: string }> };
	heading_2?: { rich_text: Array<{ plain_text: string }> };
	heading_3?: { rich_text: Array<{ plain_text: string }> };
	bulleted_list_item?: { rich_text: Array<{ plain_text: string }> };
	numbered_list_item?: { rich_text: Array<{ plain_text: string }> };
}

interface NotionBlocksResponse {
	results: NotionBlock[];
}

function authHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		'Notion-Version': NOTION_VERSION,
		'Content-Type': 'application/json'
	};
}

export async function fetchMeetingsForWeek(
	config: DashboardConfig,
	weekStart: Date
): Promise<MeetingNote[]> {
	if (!config.notion) return [];

	const queryUrl = `${NOTION_API}/databases/${config.notion.meetingsDbId}/query`;
	const queryBody = {
		filter: {
			timestamp: 'created_time',
			created_time: { on_or_after: weekStart.toISOString() }
		},
		sorts: [{ timestamp: 'created_time', direction: 'ascending' }]
	};

	const response = await fetch(queryUrl, {
		method: 'POST',
		headers: authHeaders(config.notion.token),
		body: JSON.stringify(queryBody)
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Notion query error ${response.status}: ${body}`);
	}

	const data: NotionQueryResponse = await response.json();

	// Fetch body blocks in parallel for each page; cap concurrency by relying on Promise.all (small N).
	return Promise.all(
		data.results.map((page) => buildMeetingNote(page, config.notion!.token))
	);
}

async function buildMeetingNote(page: NotionPage, token: string): Promise<MeetingNote> {
	const title = extractTitle(page) || '(untitled meeting)';
	const date = extractDate(page) ?? page.created_time;
	const attendees = extractAttendees(page);
	const notesPreview = await fetchPageNotesPreview(page.id, token);

	return {
		id: page.id,
		title,
		date,
		attendees,
		notesPreview,
		notionUrl: page.url
	};
}

function extractTitle(page: NotionPage): string {
	for (const prop of Object.values(page.properties)) {
		if (prop.type === 'title') {
			const titleProp = prop as NotionTitleProp;
			return titleProp.title.map((t) => t.plain_text).join('').trim();
		}
	}
	return '';
}

function extractDate(page: NotionPage): string | null {
	for (const [name, prop] of Object.entries(page.properties)) {
		if (prop.type === 'date' && name.toLowerCase() === 'date') {
			const dateProp = prop as NotionDateProp;
			return dateProp.date?.start ?? null;
		}
	}
	return null;
}

function extractAttendees(page: NotionPage): string[] {
	for (const [name, prop] of Object.entries(page.properties)) {
		if (name.toLowerCase() !== 'attendees') continue;
		if (prop.type === 'multi_select') {
			return (prop as NotionMultiSelectProp).multi_select.map((o) => o.name);
		}
		if (prop.type === 'people') {
			return (prop as NotionPeopleProp).people
				.map((p) => p.name)
				.filter((n): n is string => Boolean(n));
		}
		if (prop.type === 'rich_text') {
			const text = (prop as NotionRichTextProp).rich_text
				.map((t) => t.plain_text)
				.join('');
			return text
				.split(/[,;]+/)
				.map((s) => s.trim())
				.filter(Boolean);
		}
	}
	return [];
}

async function fetchPageNotesPreview(pageId: string, token: string): Promise<string> {
	const url = `${NOTION_API}/blocks/${pageId}/children?page_size=100`;
	const response = await fetch(url, { headers: authHeaders(token) });
	if (!response.ok) return '';

	const data: NotionBlocksResponse = await response.json();
	const text = data.results
		.map(blockToText)
		.filter(Boolean)
		.join('\n');

	return text.slice(0, 1500);
}

function blockToText(block: NotionBlock): string {
	const richText =
		block.paragraph?.rich_text ??
		block.heading_1?.rich_text ??
		block.heading_2?.rich_text ??
		block.heading_3?.rich_text ??
		block.bulleted_list_item?.rich_text ??
		block.numbered_list_item?.rich_text ??
		[];
	return richText.map((t) => t.plain_text).join('');
}
