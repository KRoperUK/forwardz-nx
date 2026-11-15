/**
 * Persistent cache for library scans (issue #3).
 *
 * A full library scan parses every NRO on the SD card, which is slow for
 * large libraries. This module persists per-file metadata (including the
 * deterministic forwarder title ID) between launches so that:
 *
 * - unchanged files are never re-parsed,
 * - added/removed files and mtime changes invalidate only the affected entry,
 * - the UI can render instantly from the cache while icons load in the
 *   background, and a manual refresh forces a full rescan.
 *
 * Everything in here is pure (no `Switch` access) so it runs under vitest.
 * SD persistence is injected via small read/write callbacks.
 */

export const LIBRARY_CACHE_VERSION = 1;

/** Versioned on-disk location of the library cache. */
export const LIBRARY_CACHE_PATH = 'sdmc:/switch/forwardz/library-cache.json';

/** Lightweight identity of a file used to detect changes. */
export interface FileFingerprint {
	path: string;
	mtimeMs: number;
	size: number;
}

/** Cached metadata for one NRO discovered during a library scan. */
export interface CachedAppEntry extends FileFingerprint {
	id: string;
	name: string;
	author: string;
	version: string;
	/** Deterministic forwarder title ID for this NRO path. */
	titleId: string;
}

export interface LibraryCache {
	version: typeof LIBRARY_CACHE_VERSION;
	/** ISO-8601 timestamp of the last completed scan. */
	scannedAt: string;
	entries: Record<string, CachedAppEntry>;
}

export interface LibraryDiff {
	/** Fingerprints matching a cache entry byte-for-byte (metadata reused). */
	unchanged: CachedAppEntry[];
	/** Fingerprints with no cache entry (must be parsed). */
	added: FileFingerprint[];
	/** Fingerprints whose size/mtime changed since the cached entry. */
	changed: { fingerprint: FileFingerprint; previous: CachedAppEntry }[];
	/** Cache entries with no matching file on disk (stale, dropped). */
	removed: CachedAppEntry[];
}

export function createEmptyCache(scannedAt: Date = new Date()): LibraryCache {
	return {
		version: LIBRARY_CACHE_VERSION,
		scannedAt: scannedAt.toISOString(),
		entries: {},
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isCachedAppEntry(value: unknown): value is CachedAppEntry {
	if (!isRecord(value)) return false;
	return (
		typeof value.path === 'string' &&
		typeof value.mtimeMs === 'number' &&
		Number.isFinite(value.mtimeMs) &&
		typeof value.size === 'number' &&
		Number.isFinite(value.size) &&
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		typeof value.author === 'string' &&
		typeof value.version === 'string' &&
		typeof value.titleId === 'string'
	);
}

/**
 * Parse and validate a cache document. Unknown fields are ignored for
 * forward compatibility. Returns `null` for missing, corrupt, or
 * version-mismatched documents so callers fall back to a full scan.
 */
export function parseLibraryCache(
	raw: string | null | undefined,
): LibraryCache | null {
	if (!raw) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(parsed)) return null;
	if (parsed.version !== LIBRARY_CACHE_VERSION) return null;
	if (typeof parsed.scannedAt !== 'string') return null;
	if (Number.isNaN(Date.parse(parsed.scannedAt))) return null;
	if (!isRecord(parsed.entries)) return null;
	const entries: Record<string, CachedAppEntry> = {};
	for (const [key, value] of Object.entries(parsed.entries)) {
		// Key entries by their own path so a renamed key cannot resurrect
		// metadata for a different file.
		if (isCachedAppEntry(value) && value.path === key) {
			entries[key] = value;
		}
	}
	return {
		version: LIBRARY_CACHE_VERSION,
		scannedAt: parsed.scannedAt,
		entries,
	};
}

export function serializeLibraryCache(cache: LibraryCache): string {
	return JSON.stringify(cache);
}

/**
 * Diff fresh fingerprints against the cache. A file counts as unchanged
 * only when path, mtime, and size all match, so newly copied or modified
 * NRO files are always re-parsed.
 */
export function diffLibraryCache(
	cache: LibraryCache,
	fresh: FileFingerprint[],
): LibraryDiff {
	const seen = new Set<string>();
	const unchanged: CachedAppEntry[] = [];
	const added: FileFingerprint[] = [];
	const changed: { fingerprint: FileFingerprint; previous: CachedAppEntry }[] =
		[];
	for (const fingerprint of fresh) {
		seen.add(fingerprint.path);
		const previous = cache.entries[fingerprint.path];
		if (!previous) {
			added.push(fingerprint);
		} else if (
			previous.mtimeMs !== fingerprint.mtimeMs ||
			previous.size !== fingerprint.size
		) {
			changed.push({ fingerprint, previous });
		} else {
			unchanged.push(previous);
		}
	}
	const removed = Object.values(cache.entries).filter(
		(entry) => !seen.has(entry.path),
	);
	return { unchanged, added, changed, removed };
}

/** Build the replacement cache after added/changed entries were parsed. */
export function mergeLibraryCache(
	entries: CachedAppEntry[],
	scannedAt: Date = new Date(),
): LibraryCache {
	const cache = createEmptyCache(scannedAt);
	for (const entry of entries) {
		cache.entries[entry.path] = entry;
	}
	return cache;
}

export function getLastScanTime(
	cache: LibraryCache | null | undefined,
): Date | null {
	if (!cache) return null;
	const time = Date.parse(cache.scannedAt);
	return Number.isNaN(time) ? null : new Date(time);
}

/** Short human-readable label for the last-scan indicator. */
export function formatLastScanTime(
	cache: LibraryCache | null | undefined,
	now: Date = new Date(),
): string {
	const last = getLastScanTime(cache);
	if (!last) return 'NEVER SCANNED';
	const elapsedMs = now.getTime() - last.getTime();
	if (elapsedMs < 0) return last.toLocaleString();
	const minutes = Math.floor(elapsedMs / 60000);
	if (minutes < 1) return 'JUST NOW';
	if (minutes < 60) return `${minutes} MIN AGO`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} HOUR${hours === 1 ? '' : 'S'} AGO`;
	return last.toLocaleDateString();
}

/**
 * Load the cache through an injected reader (mirrors
 * `Switch.readFileSync`, which returns `ArrayBuffer | null`). Corrupt
 * documents are treated as a cache miss, never as a fatal error.
 */
export function loadLibraryCache(
	readFile: (path: string) => ArrayBuffer | null,
): LibraryCache | null {
	let data: ArrayBuffer | null = null;
	try {
		data = readFile(LIBRARY_CACHE_PATH);
	} catch {
		return null;
	}
	if (!data) return null;
	try {
		return parseLibraryCache(new TextDecoder().decode(data));
	} catch {
		return null;
	}
}

/** Persist the cache through an injected writer (mirrors `Switch.writeFileSync`). */
export function saveLibraryCache(
	writeFile: (path: string, data: string | BufferSource) => void,
	cache: LibraryCache,
): void {
	writeFile(LIBRARY_CACHE_PATH, serializeLibraryCache(cache));
}
