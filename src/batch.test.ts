import { describe, expect, it } from 'vitest';
import type { AppInfo } from './apps';
import {
	buildBatchQueue,
	nextQueuedIndex,
	resetFailedItems,
	selectAllBatchPaths,
	summarizeBatch,
	toggleBatchPath,
	withBatchResult,
	type BatchItem,
} from './batch';

function app(path: string, forwarderId?: string): AppInfo {
	return {
		path,
		id: '0100000000000000',
		name: path,
		author: 'Author',
		version: '1.0.0',
		icon: undefined,
		forwarderId,
	};
}

function item(path: string, status: BatchItem['status'] = 'queued'): BatchItem {
	return { app: app(path, '0100000000001000'), status };
}

describe('buildBatchQueue', () => {
	it('queues fresh apps and skips installed ones by default', () => {
		const { items, duplicates } = buildBatchQueue(
			[app('sdmc:/a.nro', '0100000000001000'), app('sdmc:/b.nro', '0100000000002000')],
			new Set(['0100000000002000']),
		);
		expect(duplicates).toEqual([]);
		expect(items.map((i) => i.status)).toEqual(['queued', 'skipped']);
		expect(items[1].message).toBe('Already installed.');
	});

	it('reinstalls when includeInstalled is set', () => {
		const { items } = buildBatchQueue(
			[app('sdmc:/b.nro', '0100000000002000')],
			new Set(['0100000000002000']),
			{ includeInstalled: true },
		);
		expect(items.map((i) => i.status)).toEqual(['queued']);
	});

	it('skips later claimants of a duplicated title ID', () => {
		const { items, duplicates } = buildBatchQueue(
			[
				app('sdmc:/a.nro', '0100000000001000'),
				app('sdmc:/b.nro', '0100000000001000'),
			],
			new Set(),
		);
		expect(duplicates).toHaveLength(1);
		expect(items.map((i) => i.status)).toEqual(['queued', 'skipped']);
		expect(items[1].message).toBe('Duplicate title ID in batch.');
	});

	it('skips apps whose title ID is not ready yet', () => {
		const { items } = buildBatchQueue([app('sdmc:/a.nro')], new Set());
		expect(items[0].status).toBe('skipped');
	});
});

describe('toggleBatchPath / selectAllBatchPaths', () => {
	it('toggles membership without mutating the input', () => {
		const selected = new Set(['sdmc:/a.nro']);
		const added = toggleBatchPath(selected, 'sdmc:/b.nro');
		expect([...added].sort()).toEqual(['sdmc:/a.nro', 'sdmc:/b.nro']);
		expect(selected.has('sdmc:/b.nro')).toBe(false);
		expect(toggleBatchPath(added, 'sdmc:/a.nro').has('sdmc:/a.nro')).toBe(
			false,
		);
	});

	it('selects every visible path', () => {
		expect([...selectAllBatchPaths(['sdmc:/a.nro'])]).toEqual([
			'sdmc:/a.nro',
		]);
	});
});

describe('summarizeBatch / withBatchResult / nextQueuedIndex', () => {
	it('counts each outcome separately', () => {
		const summary = summarizeBatch([
			item('sdmc:/a.nro', 'succeeded'),
			item('sdmc:/b.nro', 'skipped'),
			item('sdmc:/c.nro', 'failed'),
			item('sdmc:/d.nro'),
		]);
		expect(summary).toEqual({
			total: 4,
			succeeded: 1,
			skipped: 1,
			failed: 1,
			pending: 1,
		});
	});

	it('records results and finds the next queued item', () => {
		const items = [item('sdmc:/a.nro'), item('sdmc:/b.nro')];
		const updated = withBatchResult(items, 0, false, 'boom');
		expect(updated[0].status).toBe('failed');
		expect(updated[0].message).toBe('boom');
		expect(items[0].status).toBe('queued');
		expect(nextQueuedIndex(updated, 0)).toBe(1);
		expect(nextQueuedIndex(updated, 1)).toBe(-1);
	});

	it('re-queues only failed items for retry', () => {
		const reset = resetFailedItems([
			item('sdmc:/a.nro', 'succeeded'),
			{ ...item('sdmc:/b.nro', 'failed'), message: 'boom' },
			item('sdmc:/c.nro', 'skipped'),
		]);
		expect(reset.map((i) => i.status)).toEqual([
			'succeeded',
			'queued',
			'skipped',
		]);
		expect(reset[1].message).toBeUndefined();
	});
});
