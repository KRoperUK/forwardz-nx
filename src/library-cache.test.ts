import { describe, expect, it } from 'vitest';
import {
	LIBRARY_CACHE_PATH,
	LIBRARY_CACHE_VERSION,
	createEmptyCache,
	diffLibraryCache,
	formatLastScanTime,
	getLastScanTime,
	loadLibraryCache,
	mergeLibraryCache,
	parseLibraryCache,
	saveLibraryCache,
	serializeLibraryCache,
	type CachedAppEntry,
} from './library-cache';

function entry(overrides: Partial<CachedAppEntry> = {}): CachedAppEntry {
	return {
		path: 'sdmc:/switch/app.nro',
		mtimeMs: 1000,
		size: 4096,
		id: '0100000000000000',
		name: 'App',
		author: 'Author',
		version: '1.0.0',
		titleId: '0100000000001000',
		...overrides,
	};
}

describe('parseLibraryCache', () => {
	it('accepts a round-tripped cache', () => {
		const cache = mergeLibraryCache([entry()]);
		expect(parseLibraryCache(serializeLibraryCache(cache))).toEqual(cache);
	});

	it('rejects missing, empty, and corrupt documents', () => {
		expect(parseLibraryCache(null)).toBeNull();
		expect(parseLibraryCache(undefined)).toBeNull();
		expect(parseLibraryCache('')).toBeNull();
		expect(parseLibraryCache('not json')).toBeNull();
		expect(parseLibraryCache('[]')).toBeNull();
	});

	it('rejects version mismatches so old caches trigger a full scan', () => {
		const cache = mergeLibraryCache([entry()]);
		const raw = JSON.stringify({ ...cache, version: 999 });
		expect(parseLibraryCache(raw)).toBeNull();
	});

	it('ignores unknown fields and entries keyed under the wrong path', () => {
		const good = entry();
		const raw = JSON.stringify({
			version: LIBRARY_CACHE_VERSION,
			scannedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
			entries: {
				[good.path]: { ...good, futureField: true },
				'sdmc:/switch/other.nro': { ...good },
				'sdmc:/switch/broken.nro': { path: 'sdmc:/switch/broken.nro' },
			},
			futureTopLevel: [],
		});
		const parsed = parseLibraryCache(raw);
		expect(parsed).not.toBeNull();
		expect(Object.keys(parsed?.entries ?? {})).toEqual([good.path]);
	});

	it('rejects an unparseable scannedAt timestamp', () => {
		const raw = JSON.stringify({
			version: LIBRARY_CACHE_VERSION,
			scannedAt: 'not a date',
			entries: {},
		});
		expect(parseLibraryCache(raw)).toBeNull();
	});
});

describe('diffLibraryCache', () => {
	const cached = entry();

	it('treats identical fingerprints as unchanged', () => {
		const diff = diffLibraryCache(mergeLibraryCache([cached]), [
			{ path: cached.path, mtimeMs: 1000, size: 4096 },
		]);
		expect(diff.unchanged).toEqual([cached]);
		expect(diff.added).toEqual([]);
		expect(diff.changed).toEqual([]);
		expect(diff.removed).toEqual([]);
	});

	it('flags added files for parsing', () => {
		const diff = diffLibraryCache(createEmptyCache(), [
			{ path: 'sdmc:/switch/new.nro', mtimeMs: 5, size: 10 },
		]);
		expect(diff.added).toHaveLength(1);
		expect(diff.unchanged).toEqual([]);
	});

	it('flags mtime or size changes for re-parsing', () => {
		const cache = mergeLibraryCache([cached]);
		const byMtime = diffLibraryCache(cache, [
			{ path: cached.path, mtimeMs: 2000, size: 4096 },
		]);
		expect(byMtime.changed).toHaveLength(1);
		expect(byMtime.changed[0].previous).toEqual(cached);
		expect(byMtime.unchanged).toEqual([]);

		const bySize = diffLibraryCache(cache, [
			{ path: cached.path, mtimeMs: 1000, size: 8192 },
		]);
		expect(bySize.changed).toHaveLength(1);
	});

	it('drops cache entries whose files disappeared', () => {
		const cache = mergeLibraryCache([cached, entry({ path: 'sdmc:/gone.nro' })]);
		const diff = diffLibraryCache(cache, [
			{ path: cached.path, mtimeMs: 1000, size: 4096 },
		]);
		expect(diff.removed.map((e) => e.path)).toEqual(['sdmc:/gone.nro']);
	});
});

describe('mergeLibraryCache / getLastScanTime / formatLastScanTime', () => {
	it('keys entries by path and records the scan time', () => {
		const at = new Date('2026-03-01T12:00:00Z');
		const cache = mergeLibraryCache([entry()], at);
		expect(cache.scannedAt).toBe(at.toISOString());
		expect(Object.keys(cache.entries)).toEqual(['sdmc:/switch/app.nro']);
		expect(getLastScanTime(cache)).toEqual(at);
	});

	it('returns null when there is no cache', () => {
		expect(getLastScanTime(null)).toBeNull();
		expect(formatLastScanTime(null)).toBe('NEVER SCANNED');
	});

	it('formats recent scans relatively', () => {
		const now = new Date('2026-03-01T12:00:00Z');
		const justNow = createEmptyCache(new Date(now.getTime() - 10_000));
		expect(formatLastScanTime(justNow, now)).toBe('JUST NOW');
		const minutes = createEmptyCache(new Date(now.getTime() - 5 * 60_000));
		expect(formatLastScanTime(minutes, now)).toBe('5 MIN AGO');
		const hours = createEmptyCache(new Date(now.getTime() - 2 * 3_600_000));
		expect(formatLastScanTime(hours, now)).toBe('2 HOURS AGO');
	});
});

describe('loadLibraryCache / saveLibraryCache', () => {
	it('round-trips through injected storage', () => {
		const store = new Map<string, string>();
		const cache = mergeLibraryCache([entry()]);
		saveLibraryCache(
			(path, data) => {
				store.set(path, String(data));
			},
			cache,
		);
		expect(store.has(LIBRARY_CACHE_PATH)).toBe(true);
		const loaded = loadLibraryCache((path) => {
			const raw = store.get(path);
			return raw ? new TextEncoder().encode(raw).buffer : null;
		});
		expect(loaded).toEqual(cache);
	});

	it('treats missing or unreadable storage as a cache miss', () => {
		expect(loadLibraryCache(() => null)).toBeNull();
		expect(
			loadLibraryCache(() => {
				throw new Error('io');
			}),
		).toBeNull();
		expect(
			loadLibraryCache(
				() => new TextEncoder().encode('corrupt').buffer,
			),
		).toBeNull();
	});
});
