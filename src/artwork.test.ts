import { describe, expect, it } from 'vitest';
import {
	checkIconFile,
	computeCoverCrop,
	isIconSizeSafe,
	MAX_HOME_MENU_ICON_BYTES,
	validateMetadata,
} from './artwork';
import {
	applyAppOverrides,
	getAppOverride,
	parseAppOverrides,
	serializeAppOverrides,
	setAppOverride,
} from './overrides';

describe('validateMetadata', () => {
	it('accepts ordinary titles', () => {
		expect(
			validateMetadata({ name: 'Game', author: 'Dev', version: '1.0.0' }),
		).toEqual({ errors: [], warnings: [] });
	});

	it('blocks empty titles and authors', () => {
		const result = validateMetadata({ name: '  ', author: '', version: '' });
		expect(result.errors).toHaveLength(2);
	});

	it('warns instead of blocking over-long titles', () => {
		const result = validateMetadata({
			name: 'x'.repeat(100),
			author: 'Dev',
			version: '',
		});
		expect(result.errors).toEqual([]);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('100 characters');
	});

	it('warns on suspicious versions but allows empty ones', () => {
		const empty = validateMetadata({ name: 'G', author: 'D', version: '' });
		expect(empty).toEqual({ errors: [], warnings: [] });
		const bad = validateMetadata({
			name: 'G',
			author: 'D',
			version: 'v1 (beta!)',
		});
		expect(bad.errors).toEqual([]);
		expect(bad.warnings).toHaveLength(1);
	});
});

describe('computeCoverCrop', () => {
	it('returns the full frame for square sources', () => {
		expect(computeCoverCrop(256, 256)).toEqual({
			sx: 0,
			sy: 0,
			sw: 256,
			sh: 256,
		});
	});

	it('center-crops wide and tall sources without stretching', () => {
		expect(computeCoverCrop(800, 600)).toEqual({
			sx: 100,
			sy: 0,
			sw: 600,
			sh: 600,
		});
		expect(computeCoverCrop(600, 800)).toEqual({
			sx: 0,
			sy: 100,
			sw: 600,
			sh: 600,
		});
	});

	it('rejects unusable dimensions', () => {
		expect(computeCoverCrop(0, 600)).toBeNull();
		expect(computeCoverCrop(-4, 600)).toBeNull();
		expect(computeCoverCrop(Number.NaN, 600)).toBeNull();
	});
});

describe('icon size and file checks', () => {
	it('enforces the HOME-menu icon budget', () => {
		expect(isIconSizeSafe(MAX_HOME_MENU_ICON_BYTES - 1)).toBe(true);
		expect(isIconSizeSafe(MAX_HOME_MENU_ICON_BYTES)).toBe(false);
		expect(isIconSizeSafe(0)).toBe(false);
	});

	it('accepts supported image types under the import cap', () => {
		expect(checkIconFile('art.PNG', 1024)).toEqual({ ok: true });
		expect(checkIconFile('art.webp', 1024).ok).toBe(false);
		expect(checkIconFile('art.jpg', 0).ok).toBe(false);
		const huge = checkIconFile('art.jpg', 9 * 1024 * 1024);
		expect(huge.ok).toBe(false);
	});
});

describe('app overrides', () => {
	it('round-trips through serialization', () => {
		const overrides = setAppOverride({}, 'sdmc:/switch/a.nro', {
			name: 'Renamed',
			favourite: true,
		});
		expect(parseAppOverrides(JSON.parse(serializeAppOverrides(overrides)))).toEqual(
			overrides,
		);
	});

	it('drops malformed entries and unknown fields', () => {
		const parsed = parseAppOverrides({
			'sdmc:/switch/a.nro': { name: 'Kept', future: true, favourite: 'yes' },
			'sdmc:/switch/b.nro': { name: '' },
			'': { name: 'No path' },
			'sdmc:/switch/c.nro': 'not an object',
		});
		expect(parsed).toEqual({ 'sdmc:/switch/a.nro': { name: 'Kept' } });
		expect(getAppOverride(parsed, 'sdmc:/switch/a.nro')).toEqual({
			name: 'Kept',
		});
	});

	it('removes entries emptied by a patch', () => {
		const full = setAppOverride({}, 'sdmc:/switch/a.nro', { name: 'X' });
		const emptied = setAppOverride(full, 'sdmc:/switch/a.nro', {
			name: undefined,
		});
		expect(emptied).toEqual({});
	});

	it('applies stored values over scanned metadata', () => {
		const app = { name: 'Old', author: 'Dev', version: '1.0' };
		expect(applyAppOverrides(app, undefined)).toMatchObject({
			name: 'Old',
			favourite: false,
		});
		expect(
			applyAppOverrides(app, { name: 'New', favourite: true }),
		).toMatchObject({ name: 'New', author: 'Dev', favourite: true });
	});
});
