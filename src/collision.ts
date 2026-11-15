/**
 * Deterministic title-ID collision detection (issue #6).
 *
 * Forwarder title IDs derive from the NRO path, so two different NROs can
 * map to the same ID and a moved/renamed NRO silently becomes a different
 * forwarder. The helpers here are pure (vitest-covered); the UI calls them
 * before any installation begins so the user can cancel safely.
 */

export interface TitleEntry {
	path: string;
	titleId: string;
}

export interface CollisionGroup {
	titleId: string;
	/** Distinct NRO paths that all derive the same title ID. */
	paths: string[];
}

/** Canonical form for comparing title IDs typed or derived anywhere. */
export function normalizeTitleId(id: string): string {
	return id.trim().toLowerCase();
}

/**
 * A title ID override is usable when it is exactly 16 hex digits.
 * Letter case is accepted and normalized before comparison.
 */
export function isValidTitleId(id: string): boolean {
	return /^[0-9a-fA-F]{16}$/.test(id.trim());
}

/**
 * Group entries by normalized title ID, returning only IDs claimed by
 * more than one distinct path, sorted for stable display.
 */
export function findDuplicateTitleIds(
	entries: TitleEntry[],
): CollisionGroup[] {
	const byId = new Map<string, Set<string>>();
	for (const entry of entries) {
		const titleId = normalizeTitleId(entry.titleId);
		if (!isValidTitleId(titleId)) continue;
		let paths = byId.get(titleId);
		if (!paths) {
			paths = new Set();
			byId.set(titleId, paths);
		}
		paths.add(entry.path);
	}
	const groups: CollisionGroup[] = [];
	for (const [titleId, paths] of byId) {
		if (paths.size > 1) {
			groups.push({ titleId, paths: [...paths].sort() });
		}
	}
	groups.sort((a, b) => (a.titleId < b.titleId ? -1 : 1));
	return groups;
}

export interface BatchCollisionReport {
	/** Title IDs claimed by more than one item in the pending batch. */
	duplicatesWithinBatch: CollisionGroup[];
	/** Batch items whose title ID is already installed on the console. */
	alreadyInstalled: TitleEntry[];
}

/**
 * Check a pending batch against itself and against installed titles.
 * Call this before any installation begins: a non-empty report means the
 * user must resolve, remove, or explicitly confirm the affected items.
 */
export function checkBatchCollisions(
	batch: TitleEntry[],
	installedIds: Iterable<string>,
): BatchCollisionReport {
	const installed = new Set<string>();
	for (const id of installedIds) {
		installed.add(normalizeTitleId(id));
	}
	return {
		duplicatesWithinBatch: findDuplicateTitleIds(batch),
		alreadyInstalled: batch.filter((item) =>
			installed.has(normalizeTitleId(item.titleId)),
		),
	};
}

/**
 * True when editing the NRO/ROM path changed the derived title ID, i.e.
 * installing now would create a second forwarder while the old one stays
 * installed separately.
 */
export function pathChangeCreatesNewId(
	previousTitleId: string,
	nextTitleId: string,
): boolean {
	if (!previousTitleId || !nextTitleId) return false;
	return normalizeTitleId(previousTitleId) !== normalizeTitleId(nextTitleId);
}

export function describeCollision(group: CollisionGroup): string {
	return `Title ID ${group.titleId} is claimed by ${group.paths.length} apps: ${group.paths.join(', ')}`;
}
