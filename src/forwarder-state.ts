const STATE_PATH = 'sdmc:/switch/nsp-forwarder/state.json';

interface ForwarderState {
	hiddenPaths?: string[];
}

function normalisePath(path: string) {
	return decodeURI(path);
}

export function loadHiddenPaths(): Set<string> {
	try {
		const data = Switch.readFileSync(STATE_PATH);
		if (!data) return new Set();
		const state = JSON.parse(new TextDecoder().decode(data)) as ForwarderState;
		return new Set((state.hiddenPaths ?? []).map(normalisePath));
	} catch {
		return new Set();
	}
}

export function saveHiddenPaths(hiddenPaths: Set<string>) {
	const state: ForwarderState = {
		hiddenPaths: [...hiddenPaths].map(normalisePath).sort(),
	};
	Switch.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function getInstalledTitleIds(): Set<string> {
	const ids = new Set<string>();
	try {
		for (const app of Switch.Application) {
			ids.add(app.id.toString(16).padStart(16, '0'));
		}
	} catch (err) {
		console.debug(`Failed to enumerate installed titles: ${err}`);
	}
	return ids;
}

export function pathKey(path: string) {
	return normalisePath(path);
}
