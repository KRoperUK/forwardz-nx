import { describe, expect, it } from 'vitest';
import {
	checkBatchCollisions,
	describeCollision,
	findDuplicateTitleIds,
	isValidTitleId,
	normalizeTitleId,
	pathChangeCreatesNewId,
} from './collision';

describe('normalizeTitleId / isValidTitleId', () => {
	it('normalizes case and surrounding whitespace', () => {
		expect(normalizeTitleId('  010000ABCDEF0000 ')).toBe('010000abcdef0000');
	});

	it('accepts 16 hex digits in either case', () => {
		expect(isValidTitleId('0100000000001000')).toBe(true);
		expect(isValidTitleId('010000ABCDEF0000')).toBe(true);
	});

	it('rejects short, long, empty, and non-hex IDs', () => {
		expect(isValidTitleId('')).toBe(false);
		expect(isValidTitleId('0100')).toBe(false);
		expect(isValidTitleId('01000000000010000')).toBe(false);
		expect(isValidTitleId('010000000000100g')).toBe(false);
		expect(isValidTitleId('01000000-00001000')).toBe(false);
	});
});

describe('findDuplicateTitleIds', () => {
	it('returns no groups when every ID is unique', () => {
		expect(
			findDuplicateTitleIds([
				{ path: 'sdmc:/a.nro', titleId: '0100000000001000' },
				{ path: 'sdmc:/b.nro', titleId: '0100000000002000' },
			]),
		).toEqual([]);
	});

	it('groups distinct paths sharing one title ID', () => {
		const groups = findDuplicateTitleIds([
			{ path: 'sdmc:/b.nro', titleId: '0100000000001000' },
			{ path: 'sdmc:/a.nro', titleId: '0100000000001000' },
			{ path: 'sdmc:/c.nro', titleId: '0100000000002000' },
		]);
		expect(groups).toEqual([
			{
				titleId: '0100000000001000',
				paths: ['sdmc:/a.nro', 'sdmc:/b.nro'],
			},
		]);
	});

	it('matches IDs case-insensitively and collapses repeat paths', () => {
		const groups = findDuplicateTitleIds([
			{ path: 'sdmc:/a.nro', titleId: '010000ABCDEF0000' },
			{ path: 'sdmc:/a.nro', titleId: '010000abcdef0000' },
			{ path: 'sdmc:/b.nro', titleId: '010000abcdef0000' },
		]);
		expect(groups).toHaveLength(1);
		expect(groups[0].paths).toEqual(['sdmc:/a.nro', 'sdmc:/b.nro']);
	});

	it('skips malformed IDs instead of reporting false collisions', () => {
		expect(
			findDuplicateTitleIds([
				{ path: 'sdmc:/a.nro', titleId: '' },
				{ path: 'sdmc:/b.nro', titleId: 'zzz' },
			]),
		).toEqual([]);
	});
});

describe('checkBatchCollisions', () => {
	const installed = new Set(['0100000000009000']);

	it('detects in-batch duplicates and installed clashes together', () => {
		const report = checkBatchCollisions(
			[
				{ path: 'sdmc:/a.nro', titleId: '0100000000001000' },
				{ path: 'sdmc:/b.nro', titleId: '0100000000001000' },
				{ path: 'sdmc:/c.nro', titleId: '0100000000009000' },
				{ path: 'sdmc:/d.nro', titleId: '0100000000002000' },
			],
			installed,
		);
		expect(report.duplicatesWithinBatch).toHaveLength(1);
		expect(report.alreadyInstalled.map((item) => item.path)).toEqual([
			'sdmc:/c.nro',
		]);
	});

	it('is clean for a fresh batch', () => {
		const report = checkBatchCollisions(
			[{ path: 'sdmc:/a.nro', titleId: '0100000000001000' }],
			installed,
		);
		expect(report.duplicatesWithinBatch).toEqual([]);
		expect(report.alreadyInstalled).toEqual([]);
	});
});

describe('pathChangeCreatesNewId', () => {
	it('warns only when the derived ID actually changes', () => {
		expect(
			pathChangeCreatesNewId('0100000000001000', '0100000000002000'),
		).toBe(true);
		expect(
			pathChangeCreatesNewId('0100000000001000', '0100000000001000'),
		).toBe(false);
		expect(pathChangeCreatesNewId('', '0100000000001000')).toBe(false);
	});
});

describe('describeCollision', () => {
	it('names the ID and every claimant', () => {
		expect(
			describeCollision({
				titleId: '0100000000001000',
				paths: ['sdmc:/a.nro', 'sdmc:/b.nro'],
			}),
		).toContain('0100000000001000');
	});
});
