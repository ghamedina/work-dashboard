/**
 * Reusable drag-and-drop reordering state and handlers.
 *
 * Usage:
 *   const drag = createDragReorder({ items, getKey, onReorder });
 */
export function createDragReorder<T>(opts: {
	/** Get the current items array */
	items: () => T[];
	/** Extract a unique string key from an item */
	getKey: (item: T) => string;
	/** Called after a successful reorder with the new array */
	onReorder: (items: T[]) => void;
}) {
	let dragKey = $state<string | null>(null);
	let dragOverKey = $state<string | null>(null);

	function start(key: string) {
		dragKey = key;
	}

	function over(e: DragEvent, key: string) {
		e.preventDefault();
		if (dragKey && dragKey !== key) {
			dragOverKey = key;
		}
	}

	function leave() {
		dragOverKey = null;
	}

	function drop(targetKey: string) {
		if (!dragKey || dragKey === targetKey) {
			dragKey = null;
			dragOverKey = null;
			return;
		}
		const current = opts.items();
		const fromIdx = current.findIndex((r) => opts.getKey(r) === dragKey);
		const toIdx = current.findIndex((r) => opts.getKey(r) === targetKey);
		if (fromIdx === -1 || toIdx === -1) {
			dragKey = null;
			dragOverKey = null;
			return;
		}
		const next = [...current];
		const [moved] = next.splice(fromIdx, 1);
		next.splice(toIdx, 0, moved);
		opts.onReorder(next);
		dragKey = null;
		dragOverKey = null;
	}

	function end() {
		dragKey = null;
		dragOverKey = null;
	}

	return {
		get dragOverKey() {
			return dragOverKey;
		},
		start,
		over,
		leave,
		drop,
		end
	};
}

/**
 * Apply a persisted key order to an array of items.
 * Items not in the saved order are appended at the end.
 */
export function applyPersistedOrder<T>(
	items: T[],
	storageKey: string,
	getKey: (item: T) => string
): T[] {
	try {
		const stored = localStorage.getItem(storageKey);
		if (!stored) return items;
		const order: string[] = JSON.parse(stored);
		const map = new Map(items.map((r) => [getKey(r), r]));
		const ordered: T[] = [];
		for (const key of order) {
			const row = map.get(key);
			if (row) {
				ordered.push(row);
				map.delete(key);
			}
		}
		for (const row of map.values()) {
			ordered.push(row);
		}
		return ordered;
	} catch {
		return items;
	}
}

/**
 * Persist the current order of keys to localStorage.
 */
export function persistOrder<T>(items: T[], storageKey: string, getKey: (item: T) => string) {
	try {
		localStorage.setItem(storageKey, JSON.stringify(items.map(getKey)));
	} catch {}
}
