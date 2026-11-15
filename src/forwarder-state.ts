import { type AppOverrides, parseAppOverrides } from './overrides';

const STATE_PATH = 'sdmc:/switch/forwardz/state.json';
const LEGACY_STATE_PATH = 'sdmc:/switch/nsp-forwarder/state.json';

interface ForwarderState {
	hiddenPaths?: string[];
	/** Per-app metadata overrides (issue #4), keyed by normalised path. */
	overrides?: AppOverrides;
}

function normalisePath(path: string) {
	return decodeURI(path);
}

function readState(): ForwarderState {
	try {
		let data = Switch.readFileSync(STATE_PATH);
		if (!data) data = Switch.readFileSync(LEGACY_STATE_PATH);
		if (!data) return {};
		return JSON.parse(new TextDecoder().decode(data)) as ForwarderState;
	} catch {
		return {};
	}
}

function writeState(state: ForwarderState) {
	Switch.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function loadHiddenPaths(): Set<string> {
	const state = readState();
	try {
		return new Set((state.hiddenPaths ?? []).map(normalisePath));
	} catch {
		return new Set();
	}
}

export function saveHiddenPaths(hiddenPaths: Set<string>) {
	const state = readState();
	state.hiddenPaths = [...hiddenPaths].map(normalisePath).sort();
	writeState(state);
}

/** Stored metadata overrides; unknown fields were dropped on load. */
export function loadAppOverrides(): AppOverrides {
	return parseAppOverrides(readState().overrides);
}

export function saveAppOverrides(overrides: AppOverrides) {
	const state = readState();
	state.overrides = overrides;
	writeState(state);
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
