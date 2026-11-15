import { describe, expect, it } from 'vitest';
import {
	SETTINGS_VERSION,
	collectSettings,
	createDefaultSettings,
	describeSettings,
	importSettings,
	loadSettings,
	parseSettings,
	saveSettings,
	serializeSettings,
} from './settings';

function storage(files: Map<string, string> = new Map()) {
	return {
		files,
		readFile: (path: string) =>
			files.has(path)
				? (new TextEncoder().encode(files.get(path)).buffer as ArrayBuffer)
				: null,
		writeFile: (path: string, data: string | BufferSource) => {
			files.set(
				path,
				typeof data === 'string'
					? data
					: new TextDecoder().decode(data as ArrayBuffer),
			);
		},
	};
}

const SAMPLE = collectSettings({
	hiddenPaths: ['sdmc:/switch/b.nro', 'sdmc:/switch/a.nro'],
	overrides: {
		'sdmc:/switch/a.nro': { name: 'Renamed', favourite: true },
	},
	preferences: { largerText: true, highContrast: false, seenWalkthrough: true },
});

describe('collectSettings', () => {
	it('derives favourites from overrides and sorts lists', () => {
		expect(SAMPLE.hiddenPaths).toEqual([
			'sdmc:/switch/a.nro',
			'sdmc:/switch/b.nro',
		]);
		expect(SAMPLE.favourites).toEqual(['sdmc:/switch/a.nro']);
		expect(SAMPLE.version).toBe(SETTINGS_VERSION);
	});
});

describe('settings round-trip', () => {
	it('exports and re-imports without loss', () => {
		const raw = serializeSettings(SAMPLE);
		const parsed = parseSettings(raw);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) expect(parsed.settings).toEqual(SAMPLE);
	});

	it('ignores unknown fields for forward compatibility', () => {
		const raw = JSON.stringify({
			...JSON.parse(serializeSettings(SAMPLE)),
			futureTopLevel: true,
			preferences: { ...SAMPLE.preferences, futureFlag: 1 },
		});
		const parsed = parseSettings(raw);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.settings.preferences).toEqual(SAMPLE.preferences);
			expect(parsed.settings).toEqual(SAMPLE);
		}
	});

	it('rejects corrupt, empty, and version-mismatched documents', () => {
		expect(parseSettings(null).ok).toBe(false);
		expect(parseSettings('').ok).toBe(false);
		expect(parseSettings('not json').ok).toBe(false);
		const mismatched = JSON.stringify({
			...JSON.parse(serializeSettings(SAMPLE)),
			version: 999,
		});
		const result = parseSettings(mismatched);
		expect(result.ok).toBe(false);
	});

	it('never includes secrets in the export', () => {
		const raw = serializeSettings(SAMPLE).toLowerCase();
		expect(raw).not.toContain('prod.keys');
		expect(raw).not.toContain('master_key');
	});
});

describe('importSettings', () => {
	it('fails without corrupting current settings', () => {
		const current = createDefaultSettings();
		const result = importSettings('garbage', current);
		expect(result.ok).toBe(false);
		expect(current).toEqual(createDefaultSettings());
	});

	it('carries a backup of the replaced settings', () => {
		const current = createDefaultSettings();
		const result = importSettings(serializeSettings(SAMPLE), current);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.import.settings).toEqual(SAMPLE);
			const restored = parseSettings(result.import.backup);
			expect(restored.ok).toBe(true);
			if (restored.ok) expect(restored.settings).toEqual(current);
		}
	});
});

describe('settings storage', () => {
	it('loads defaults when nothing is stored', () => {
		expect(loadSettings(storage())).toEqual(createDefaultSettings());
	});

	it('saves and reloads live settings', () => {
		const store = storage();
		saveSettings(store, SAMPLE);
		expect(loadSettings(store)).toEqual(SAMPLE);
	});
});

describe('describeSettings', () => {
	it('summarises counts for the replace warning', () => {
		expect(describeSettings(SAMPLE)).toBe('2 hidden, 1 favourites, 1 overrides');
	});
});
