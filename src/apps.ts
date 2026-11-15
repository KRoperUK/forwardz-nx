import { isDirectory } from './util';
import {
	diffLibraryCache,
	loadLibraryCache,
	mergeLibraryCache,
	saveLibraryCache,
	type CachedAppEntry,
	type FileFingerprint,
	type LibraryCache,
} from './library-cache';
import { generateDeterministicID } from './title-id';

export interface AppInfo {
	path: string;
	id: string;
	name: string;
	author: string;
	version: string;
	icon: ArrayBuffer | undefined;
	/** Deterministic forwarder title ID, filled in by the library scan. */
	forwarderId?: string;
}

interface NroEntry {
	url: URL;
	mtimeMs: number;
	size: number;
}

function* nroIterator(
	dir: string | URL,
	recursive = true,
): IteratorObject<NroEntry, void> {
	const entries = Switch.readDirSync(dir) ?? [];
	for (const entry of entries) {
		// Skip hidden files
		if (entry.startsWith('.')) continue;

		const path = new URL(entry, dir);

		let stat = null;
		try {
			stat = Switch.statSync(path);
		} catch (err) {
			// I/O error may be thrown for files that are currently
			// open, which happens for the `nxjs-debug.log` file
			console.debug(`Failed to stat ${path}: ${err}`);
		}

		if (!stat) continue;

		if (isDirectory(stat.mode)) {
			if (recursive) {
				// Only traverse one level deep into the "switch" directory
				yield* nroIterator(new URL(`${path}/`), false);
			}
		} else if (entry.endsWith('.nro')) {
			yield { url: path, mtimeMs: stat.mtime, size: stat.size };
		}
	}
}

export function pathToAppInfo(path: URL): AppInfo | undefined {
	try {
		const app = new Switch.Application(path);
		return {
			path: path.href,
			id: app.id.toString(16).padStart(16, '0'),
			name: app.name,
			author: app.author,
			version: app.version,
			icon: app.icon,
		};
	} catch (err) {
		console.debug(`Failed to parse "${path}": ${err}`);
	}
}

function fingerprintForUrl(url: URL): FileFingerprint | null {
	try {
		const stat = Switch.statSync(url);
		if (!stat || isDirectory(stat.mode)) return null;
		return { path: url.href, mtimeMs: stat.mtime, size: stat.size };
	} catch (err) {
		console.debug(`Failed to stat ${url.href}: ${err}`);
		return null;
	}
}

/**
 * Fast fingerprint pass over the library: directory listing plus stat only,
 * no NRO parsing. Cheap enough to run on every view change or refresh.
 */
export function collectNroFingerprints(): FileFingerprint[] {
	const fingerprints: FileFingerprint[] = [];
	const hbmenu = fingerprintForUrl(new URL('sdmc:/hbmenu.nro'));
	if (hbmenu) fingerprints.push(hbmenu);
	for (const entry of nroIterator('sdmc:/switch/')) {
		fingerprints.push({
			path: entry.url.href,
			mtimeMs: entry.mtimeMs,
			size: entry.size,
		});
	}
	return fingerprints;
}

export interface LibraryScanResult {
	apps: AppInfo[];
	cache: LibraryCache;
	scannedAt: Date;
	/** True when no usable cache existed and every entry was re-parsed. */
	fullScan: boolean;
	stats: { unchanged: number; added: number; changed: number; removed: number };
}

function appFromCache(
	previous: Map<string, AppInfo>,
	cached: CachedAppEntry,
): AppInfo {
	// Reuse the in-memory entry (which still carries its icon) when this
	// refresh happens within one session, e.g. after a view change.
	const prev = previous.get(cached.path);
	if (prev) return prev;
	return {
		path: cached.path,
		id: cached.id,
		name: cached.name,
		author: cached.author,
		version: cached.version,
		icon: undefined,
		forwarderId: cached.titleId,
	};
}

async function parseFingerprint(
	fingerprint: FileFingerprint,
): Promise<{ app: AppInfo; entry: CachedAppEntry } | null> {
	let url: URL;
	try {
		url = new URL(fingerprint.path);
	} catch {
		return null;
	}
	const app = pathToAppInfo(url);
	if (!app) return null;
	const decoded = decodeURI(app.path);
	const titleId = await generateDeterministicID(decoded, decoded);
	app.forwarderId = titleId;
	return {
		app,
		entry: {
			path: fingerprint.path,
			mtimeMs: fingerprint.mtimeMs,
			size: fingerprint.size,
			id: app.id,
			name: app.name,
			author: app.author,
			version: app.version,
			titleId,
		},
	};
}

function persistCache(cache: LibraryCache): void {
	try {
		saveLibraryCache((path, data) => Switch.writeFileSync(path, data), cache);
	} catch (err) {
		// The cache is best-effort: a failed write must never break scanning.
		console.debug(`Failed to persist library cache: ${err}`);
	}
}

/**
 * Refresh the library, reusing cached metadata (and in-memory icons) for
 * unchanged files and re-parsing only added or modified NROs. Pass
 * `{ force: true }` for a manual rescan that ignores the cache.
 */
export async function refreshLibraryApps(
	previous: AppInfo[] = [],
	options: { force?: boolean } = {},
): Promise<LibraryScanResult> {
	const fingerprints = collectNroFingerprints();
	const previousByPath = new Map(previous.map((app) => [app.path, app]));
	const persisted = options.force
		? null
		: loadLibraryCache((path) => Switch.readFileSync(path));

	if (!persisted) {
		const apps: AppInfo[] = [];
		const entries: CachedAppEntry[] = [];
		for (const fingerprint of fingerprints) {
			const parsed = await parseFingerprint(fingerprint);
			if (parsed) {
				apps.push(parsed.app);
				entries.push(parsed.entry);
			}
		}
		const cache = mergeLibraryCache(entries);
		persistCache(cache);
		return {
			apps,
			cache,
			scannedAt: new Date(cache.scannedAt),
			fullScan: true,
			stats: {
				unchanged: 0,
				added: entries.length,
				changed: 0,
				removed: 0,
			},
		};
	}

	const diff = diffLibraryCache(persisted, fingerprints);
	const apps: AppInfo[] = [];
	const entries: CachedAppEntry[] = [];
	for (const cached of diff.unchanged) {
		apps.push(appFromCache(previousByPath, cached));
		entries.push(cached);
	}
	const toParse = [
		...diff.added,
		...diff.changed.map((item) => item.fingerprint),
	];
	for (const fingerprint of toParse) {
		const parsed = await parseFingerprint(fingerprint);
		if (parsed) {
			apps.push(parsed.app);
			entries.push(parsed.entry);
		}
	}
	const cache = mergeLibraryCache(entries);
	persistCache(cache);
	return {
		apps,
		cache,
		scannedAt: new Date(cache.scannedAt),
		fullScan: false,
		stats: {
			unchanged: diff.unchanged.length,
			added: diff.added.length,
			changed: diff.changed.length,
			removed: diff.removed.length,
		},
	};
}
