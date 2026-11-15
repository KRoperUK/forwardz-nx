/**
 * Versioned settings export/import (issue #7).
 *
 * Hidden apps, favourites, metadata overrides, and preferences live in one
 * versioned document so personal library organisation moves to another SD
 * card by copying a single file. Imports validate before touching current
 * settings, ignore unknown fields for forward compatibility, and keep a
 * backup so a bad import rolls back. Console secrets and prod.keys are
 * never part of the document — the type has no field for them.
 *
 * Record parsing is pure (vitest-covered); SD persistence is injected.
 */

import {
	type AppOverrides,
	parseAppOverrides,
	serializeAppOverrides,
} from './overrides';

/** Bump when the on-disk/requested shape changes. */
export const SETTINGS_VERSION = 1;

/** Versioned on-disk location of the live settings. */
export const SETTINGS_PATH = 'sdmc:/switch/forwardz/settings.json';

/** Previous location of a successful import, kept for rollback. */
export const SETTINGS_BACKUP_PATH = 'sdmc:/switch/forwardz/settings-backup.json';

/** File name suggested for SD-card / cross-device copies. */
export const SETTINGS_EXPORT_FILENAME = 'forwardz-settings.json';

export interface SettingsPreferences {
	largerText: boolean;
	highContrast: boolean;
	seenWalkthrough: boolean;
}

export interface Settings {
	version: typeof SETTINGS_VERSION;
	hiddenPaths: string[];
	favourites: string[];
	overrides: AppOverrides;
	preferences: SettingsPreferences;
}

export function defaultPreferences(): SettingsPreferences {
	return { largerText: false, highContrast: false, seenWalkthrough: false };
}

export function createDefaultSettings(): Settings {
	return {
		version: SETTINGS_VERSION,
		hiddenPaths: [],
		favourites: [],
		overrides: {},
		preferences: defaultPreferences(),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	for (const item of value) {
		if (typeof item === 'string' && item !== '' && !seen.has(item)) {
			seen.add(item);
		}
	}
	return [...seen].sort();
}

function parsePreferences(value: unknown): SettingsPreferences {
	const defaults = defaultPreferences();
	if (!isRecord(value)) return defaults;
	return {
		largerText: value.largerText === true ? true : defaults.largerText,
		highContrast:
			value.highContrast === true ? true : defaults.highContrast,
		seenWalkthrough:
			value.seenWalkthrough === true ? true : defaults.seenWalkthrough,
	};
}

/**
 * Build the settings document from live state. Favourites derive from
 * overrides so the two can never disagree.
 */
export function collectSettings(input: {
	hiddenPaths: Iterable<string>;
	overrides: AppOverrides;
	preferences?: SettingsPreferences;
}): Settings {
	const favourites = Object.entries(input.overrides)
		.filter(([, override]) => override.favourite === true)
		.map(([path]) => path)
		.sort();
	return {
		version: SETTINGS_VERSION,
		hiddenPaths: [...new Set(input.hiddenPaths)].sort(),
		favourites,
		overrides: parseAppOverrides(input.overrides),
		preferences: input.preferences ?? defaultPreferences(),
	};
}

export type SettingsParseResult =
	| { ok: true; settings: Settings }
	| { ok: false; error: string };

/**
 * Parse an exported document. Unknown fields are ignored for forward
 * compatibility; a version mismatch or corrupt document fails without
 * touching current settings.
 */
export function parseSettings(raw: string | null | undefined): SettingsParseResult {
	if (!raw) {
		return { ok: false, error: 'That file is empty — pick a settings export.' };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			ok: false,
			error: 'That file is not valid settings JSON — pick an export.',
		};
	}
	if (!isRecord(parsed)) {
		return {
			ok: false,
			error: 'That file is not a settings document — pick an export.',
		};
	}
	if (parsed.version !== SETTINGS_VERSION) {
		return {
			ok: false,
			error: `Settings version ${String(parsed.version)} is not supported by this app version — export again from the other console.`,
		};
	}
	return {
		ok: true,
		settings: {
			version: SETTINGS_VERSION,
			hiddenPaths: stringList(parsed.hiddenPaths),
			favourites: stringList(parsed.favourites),
			overrides: parseAppOverrides(parsed.overrides),
			preferences: parsePreferences(parsed.preferences),
		},
	};
}

/** Serialize for export. The document never contains keys or secrets. */
export function serializeSettings(settings: Settings): string {
	return JSON.stringify(
		{
			version: settings.version,
			hiddenPaths: settings.hiddenPaths,
			favourites: settings.favourites,
			overrides: JSON.parse(serializeAppOverrides(settings.overrides)),
			preferences: settings.preferences,
		},
		null,
		2,
	);
}

export interface SettingsImport {
	settings: Settings;
	/** Previous settings serialized, for the backup/rollback path. */
	backup: string;
}

export type SettingsImportResult =
	| { ok: true; import: SettingsImport }
	| { ok: false; error: string };

/**
 * Import an exported document against current settings. Failures return
 * an error and leave current settings untouched; successes carry a backup
 * of the replaced settings for rollback.
 */
export function importSettings(
	raw: string | null | undefined,
	current: Settings,
): SettingsImportResult {
	const parsed = parseSettings(raw);
	if (!parsed.ok) return parsed;
	return {
		ok: true,
		import: { settings: parsed.settings, backup: serializeSettings(current) },
	};
}

export interface SettingsStorage {
	readFile: (path: string) => ArrayBuffer | null;
	writeFile: (path: string, data: string | BufferSource) => void;
}

function decode(storage: SettingsStorage, path: string): string | null {
	try {
		const data = storage.readFile(path);
		if (!data) return null;
		return new TextDecoder().decode(data);
	} catch {
		return null;
	}
}

/** Load live settings; a missing or corrupt file means defaults. */
export function loadSettings(storage: SettingsStorage): Settings {
	const parsed = parseSettings(decode(storage, SETTINGS_PATH));
	return parsed.ok ? parsed.settings : createDefaultSettings();
}

/** Persist live settings. */
export function saveSettings(
	storage: SettingsStorage,
	settings: Settings,
): void {
	storage.writeFile(SETTINGS_PATH, serializeSettings(settings));
}

/** Persist the pre-import backup for rollback. */
export function saveSettingsBackup(
	storage: SettingsStorage,
	backup: string,
): void {
	storage.writeFile(SETTINGS_BACKUP_PATH, backup);
}

/** Short human-readable summary shown before the replace warning. */
export function describeSettings(settings: Settings): string {
	return (
		`${settings.hiddenPaths.length} hidden, ` +
		`${settings.favourites.length} favourites, ` +
		`${Object.keys(settings.overrides).length} overrides`
	);
}
