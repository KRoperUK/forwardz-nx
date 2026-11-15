/**
 * prod.keys discovery, validation, and recovery guidance (issue #5).
 *
 * The app checks the documented common SD-card locations and reports which
 * path was selected. Missing, unreadable, and malformed files produce
 * distinct messages, and a rescan lets the user recover after copying keys
 * without restarting the app. Discovery/validation are pure and
 * injected-reader based (vitest-covered, no real console keys anywhere);
 * only the module-level initial scan touches `Switch`.
 *
 * Key material is never printed: messages carry paths, counts, and guidance
 * only.
 */

export const PROD_KEYS_PATHS = [
	'sdmc:/switch/prod.keys',
	'sdmc:/prod.keys',
	'sdmc:/switch/keys/prod.keys',
	'sdmc:/switch/DBI/prod.keys',
] as const;

export type ProdKeysState = 'missing' | 'unreadable' | 'malformed' | 'valid';

export interface ProdKeysDiscovery {
	/** First readable candidate, or null when nothing was found. */
	data: ArrayBuffer | null;
	/** Location the candidate came from. */
	path: string | null;
	/** Every location that was checked, in order. */
	checkedPaths: string[];
	/** Locations that errored instead of answering. */
	unreadablePaths: string[];
}

export interface ProdKeysValidation {
	state: ProdKeysState;
	/** Selected location, or null when nothing was found. */
	path: string | null;
	/** Number of `name = hex` entries parsed (0 unless valid). */
	keyCount: number;
	/** User-facing guidance; never contains key material. */
	message: string;
}

const KEY_LINE = /^\s*([a-z0-9_]+)\s*=\s*([0-9a-fA-F]+)\s*$/;

/**
 * Check each documented location in order and return the first readable
 * candidate. A throwing reader marks that path unreadable and moves on.
 */
export function discoverProdKeys(
	readFile: (path: string) => ArrayBuffer | null,
): ProdKeysDiscovery {
	const checkedPaths = [...PROD_KEYS_PATHS];
	const unreadablePaths: string[] = [];
	for (const path of PROD_KEYS_PATHS) {
		try {
			const candidate = readFile(path);
			if (candidate) {
				return { data: candidate, path, checkedPaths, unreadablePaths };
			}
		} catch {
			unreadablePaths.push(path);
		}
	}
	return { data: null, path: null, checkedPaths, unreadablePaths };
}

function countKeyEntries(text: string): number {
	let count = 0;
	for (const line of text.split('\n')) {
		if (KEY_LINE.test(line)) count += 1;
	}
	return count;
}

/** Classify a discovery result and build recovery guidance for it. */
export function validateProdKeys(
	discovery: ProdKeysDiscovery,
): ProdKeysValidation {
	if (!discovery.data) {
		if (discovery.unreadablePaths.length > 0) {
			return {
				state: 'unreadable',
				path: discovery.unreadablePaths[0],
				keyCount: 0,
				message: `Found a keys file at ${discovery.unreadablePaths[0]} but could not read it. Check the file permissions, re-copy prod.keys to the SD card, then retry.`,
			};
		}
		return {
			state: 'missing',
			path: null,
			keyCount: 0,
			message:
				'No prod.keys found in the usual SD-card locations. ' +
				'Dump your console keys, copy prod.keys to the SD card, then retry.',
		};
	}
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(discovery.data);
	} catch {
		return {
			state: 'malformed',
			path: discovery.path,
			keyCount: 0,
			message: `The keys file at ${discovery.path} is not readable text. Re-dump your keys and copy the fresh prod.keys over, then retry.`,
		};
	}
	const keyCount = countKeyEntries(text);
	if (keyCount === 0) {
		return {
			state: 'malformed',
			path: discovery.path,
			keyCount: 0,
			message: `The keys file at ${discovery.path} has no key entries — it may be truncated or the wrong file. Re-dump your keys and copy the fresh prod.keys over, then retry.`,
		};
	}
	return {
		state: 'valid',
		path: discovery.path,
		keyCount,
		message: `Using ${discovery.path} (${keyCount} key entries).`,
	};
}

/**
 * Re-run discovery and validation through an injected reader. The error
 * screen calls this for its Refresh action so recovery never needs a
 * restart.
 */
export function rescanProdKeys(
	readFile: (path: string) => ArrayBuffer | null,
): ProdKeysValidation {
	return validateProdKeys(discoverProdKeys(readFile));
}

function readFromSwitch(path: string): ArrayBuffer | null {
	return Switch.readFileSync(path);
}

const initial = discoverProdKeys(readFromSwitch);

export const prodKeys: ArrayBuffer | null = initial.data;
export const prodKeysPath: string | null = initial.path;

if (prodKeys && prodKeysPath) {
	console.debug(`Found prod.keys at ${prodKeysPath}`);
} else {
	console.debug('No prod.keys found in the common SD-card locations.');
}
