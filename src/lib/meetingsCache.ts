import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import type { IsoWeek } from './managerWeek';
import type { MeetingsSummary } from './types';

const CACHE_DIR = join(process.cwd(), 'data', 'meeting-summaries');

function cachePath(week: IsoWeek): string {
	const w = String(week.week).padStart(2, '0');
	return join(CACHE_DIR, `${week.year}-W${w}.json`);
}

export function readCache(week: IsoWeek): MeetingsSummary | null {
	const path = cachePath(week);
	if (!existsSync(path)) return null;
	try {
		const raw = readFileSync(path, 'utf-8');
		return JSON.parse(raw) as MeetingsSummary;
	} catch {
		return null;
	}
}

export function writeCache(week: IsoWeek, summary: MeetingsSummary): void {
	try {
		if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
		writeFileSync(cachePath(week), JSON.stringify(summary, null, 2), 'utf-8');
	} catch {
		// Cache write failures are non-fatal; next load will re-synthesize.
	}
}

export function clearCache(week: IsoWeek): void {
	const path = cachePath(week);
	if (existsSync(path)) {
		try {
			rmSync(path);
		} catch {
			// best-effort
		}
	}
}
