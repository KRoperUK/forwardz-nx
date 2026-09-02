export const PROD_KEYS_PATHS = [
	'sdmc:/switch/prod.keys',
	'sdmc:/prod.keys',
	'sdmc:/switch/keys/prod.keys',
	'sdmc:/switch/DBI/prod.keys',
] as const;

export let prodKeys: ArrayBuffer | null = null;
export let prodKeysPath: string | null = null;

for (const path of PROD_KEYS_PATHS) {
	try {
		const candidate = Switch.readFileSync(path);
		if (candidate) {
			prodKeys = candidate;
			prodKeysPath = path;
			console.debug(`Found prod.keys at ${path}`);
			break;
		}
	} catch (err) {
		console.debug(`Could not check ${path}: ${err}`);
	}
}

if (!prodKeys) {
	console.debug('No prod.keys found in the common SD-card locations.');
}
