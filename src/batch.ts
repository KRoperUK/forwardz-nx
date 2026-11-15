/**
 * Batch selection and batch installation queue (issue #1).
 *
 * Pure state helpers (vitest-covered) plus the handoff types used to drive
 * sequential per-item generation through the existing Generate route. The
 * UI lives in `routes/Batch.tsx`; installation itself still flows through
 * `routes/Generate.tsx` one item at a time so a single failure never
 * silently aborts the remaining batch.
 */

import {
	findDuplicateTitleIds,
	normalizeTitleId,
	type CollisionGroup,
} from './collision';
import type { AppInfo } from './apps';

export type BatchItemStatus = 'queued' | 'succeeded' | 'skipped' | 'failed';

export interface BatchItem {
	app: AppInfo;
	status: BatchItemStatus;
	message?: string;
}

/** In-flight batch carried through Generate route state. */
export interface BatchContext {
	items: BatchItem[];
	index: number;
}

export interface BatchQueue {
	items: BatchItem[];
	duplicates: CollisionGroup[];
}

/**
 * Build the install queue: already-installed forwarders are skipped unless
 * the user explicitly opts into reinstall, and later claimants of a
 * duplicated title ID are skipped until the collision is resolved.
 */
export function buildBatchQueue(
	apps: AppInfo[],
	installedIds: Iterable<string>,
	options: { includeInstalled?: boolean } = {},
): BatchQueue {
	const installed = new Set<string>();
	for (const id of installedIds) {
		installed.add(normalizeTitleId(id));
	}
	const duplicates = findDuplicateTitleIds(
		apps.map((app) => ({ path: app.path, titleId: app.forwarderId ?? '' })),
	);
	const duplicated = new Set<string>();
	for (const group of duplicates) {
		// The first claimant stays queued; the rest need user resolution.
		for (const path of group.paths.slice(1)) {
			duplicated.add(path);
		}
	}
	const items: BatchItem[] = apps.map((app) => {
		if (!app.forwarderId) {
			return {
				app,
				status: 'skipped' as const,
				message: 'Title ID not ready — refresh and retry.',
			};
		}
		if (
			!options.includeInstalled &&
			installed.has(normalizeTitleId(app.forwarderId))
		) {
			return { app, status: 'skipped' as const, message: 'Already installed.' };
		}
		if (duplicated.has(app.path)) {
			return {
				app,
				status: 'skipped' as const,
				message: 'Duplicate title ID in batch.',
			};
		}
		return { app, status: 'queued' as const };
	});
	return { items, duplicates };
}

/** Toggle one path in the batch selection, returning a new set. */
export function toggleBatchPath(
	selected: Set<string>,
	path: string,
): Set<string> {
	const next = new Set(selected);
	if (next.has(path)) {
		next.delete(path);
	} else {
		next.add(path);
	}
	return next;
}

/** Select every visible path (used for select-all in batch mode). */
export function selectAllBatchPaths(paths: Iterable<string>): Set<string> {
	return new Set(paths);
}

export interface BatchSummary {
	total: number;
	succeeded: number;
	skipped: number;
	failed: number;
	pending: number;
}

export function summarizeBatch(items: BatchItem[]): BatchSummary {
	const summary: BatchSummary = {
		total: items.length,
		succeeded: 0,
		skipped: 0,
		failed: 0,
		pending: 0,
	};
	for (const item of items) {
		if (item.status === 'succeeded') summary.succeeded++;
		else if (item.status === 'skipped') summary.skipped++;
		else if (item.status === 'failed') summary.failed++;
		else summary.pending++;
	}
	return summary;
}

/** Record one item's outcome, returning a new array. */
export function withBatchResult(
	items: BatchItem[],
	index: number,
	ok: boolean,
	message?: string,
): BatchItem[] {
	return items.map((item, i) =>
		i === index
			? { ...item, status: ok ? 'succeeded' : 'failed', message }
			: item,
	);
}

/** Index of the next queued item after `fromIndex`, or -1 when done. */
export function nextQueuedIndex(
	items: BatchItem[],
	fromIndex: number,
): number {
	for (let i = fromIndex + 1; i < items.length; i++) {
		if (items[i].status === 'queued') return i;
	}
	return -1;
}

/** Re-queue failed items for a retry pass, keeping other outcomes. */
export function resetFailedItems(items: BatchItem[]): BatchItem[] {
	return items.map((item) =>
		item.status === 'failed'
			? { ...item, status: 'queued' as const, message: undefined }
			: item,
	);
}
