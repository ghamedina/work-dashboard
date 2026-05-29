export interface IsoWeek {
	year: number;        // ISO week-numbering year (may differ from calendar year near Jan 1 / Dec 31)
	week: number;        // 1-53
	start: Date;         // Monday 00:00:00.000 local time
	end: Date;           // Sunday 23:59:59.999 local time
}

/**
 * Returns the ISO week that `now` falls within, with Mon..Sun bounds in local time.
 * ISO 8601: weeks start on Monday; week 1 is the week containing the first Thursday of the year.
 */
export function getCurrentIsoWeek(now: Date = new Date()): IsoWeek {
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	const dayOfWeek = (start.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
	start.setDate(start.getDate() - dayOfWeek);

	const end = new Date(start);
	end.setDate(end.getDate() + 6);
	end.setHours(23, 59, 59, 999);

	// ISO week-numbering: copy date, shift to Thursday of the same ISO week, then number from Jan 4.
	const target = new Date(start);
	target.setDate(target.getDate() + 3); // Monday + 3 = Thursday
	const firstThursday = new Date(target.getFullYear(), 0, 4);
	const diffDays = Math.round((target.getTime() - firstThursday.getTime()) / 86400000);
	const week = 1 + Math.floor((diffDays + ((firstThursday.getDay() + 6) % 7)) / 7);
	const year = target.getFullYear();

	return { year, week, start, end };
}

export function formatIsoWeekLabel(w: IsoWeek): string {
	const fmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
	const startStr = w.start.toLocaleDateString(undefined, fmt);
	const endStr = w.end.toLocaleDateString(undefined, fmt);
	return `${startStr} – ${endStr} (W${String(w.week).padStart(2, '0')})`;
}

export function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function notesStorageKey(teamName: string, w: IsoWeek): string {
	return `weekly-notes-${slugify(teamName)}-${w.year}-W${String(w.week).padStart(2, '0')}`;
}
