/**
 * Per-app metadata overrides (issue #4).
 *
 * Overrides let edited titles, authors, versions, favourites, and custom
 * icon paths survive an application restart and re-apply on the next
 * regeneration. The record helpers are pure (vitest-covered); persistence
 * lives in `forwarder-state` (state file) and `settings` (export/import).
 */

export interface AppOverride {
	name?: string;
	author?: string;
	version?: string;
	favourite?: boolean;
	/** SD-card path of a user-imported icon, re-resolved at generation. */
	iconPath?: string;
}

/** Overrides keyed by normalised NRO path. */
export type AppOverrides = Record<string, AppOverride>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function cleanString(value: unknown): string | undefined {
	return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Parse stored overrides, dropping malformed entries and unknown fields. */
export function parseAppOverrides(raw: unknown): AppOverrides {
	if (!isRecord(raw)) return {};
	const overrides: AppOverrides = {};
	for (const [path, value] of Object.entries(raw)) {
		if (typeof path !== 'string' || path === '' || !isRecord(value)) {
			continue;
		}
		const override: AppOverride = {};
		const name = cleanString(value.name);
		const author = cleanString(value.author);
		const version = cleanString(value.version);
		const iconPath = cleanString(value.iconPath);
		if (name) override.name = name;
		if (author) override.author = author;
		if (version) override.version = version;
		if (value.favourite === true) override.favourite = true;
		if (iconPath) override.iconPath = iconPath;
		if (Object.keys(override).length > 0) overrides[path] = override;
	}
	return overrides;
}

export function serializeAppOverrides(overrides: AppOverrides): string {
	return JSON.stringify(overrides);
}

export function getAppOverride(
	overrides: AppOverrides,
	path: string,
): AppOverride | undefined {
	return overrides[path];
}

export interface OverridePatch extends AppOverride {
	/**
	 * When true, fields absent from the patch are cleared instead of kept.
	 * Used by import, which replaces whole records.
	 */
	clearMissing?: boolean;
}

/**
 * Merge a patch into the stored overrides, returning a new record. Empty
 * patches remove the entry so the store never accumulates blank records.
 */
export function setAppOverride(
	overrides: AppOverrides,
	path: string,
	patch: OverridePatch,
): AppOverrides {
	const { clearMissing, ...fields } = patch;
	const previous = clearMissing === true ? {} : (overrides[path] ?? {});
	const merged: AppOverride = { ...previous };
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === false || value === '') {
			delete merged[key as keyof AppOverride];
		} else {
			(merged as Record<string, unknown>)[key] = value;
		}
	}
	const next = { ...overrides };
	if (Object.keys(merged).length === 0) {
		delete next[path];
	} else {
		next[path] = merged;
	}
	return next;
}

export interface ResolvedMetadata {
	name: string;
	author: string;
	version: string;
	favourite: boolean;
	iconPath?: string;
}

/**
 * Apply stored overrides to freshly scanned library metadata. Stored
 * values win; everything else falls through to the NRO itself.
 */
export function applyAppOverrides(
	app: { name: string; author: string; version: string },
	override: AppOverride | undefined,
): ResolvedMetadata {
	return {
		name: override?.name ?? app.name,
		author: override?.author ?? app.author,
		version: override?.version ?? app.version,
		favourite: override?.favourite ?? false,
		iconPath: override?.iconPath,
	};
}
