/**
 * Forwarder lifecycle management (issue #2).
 *
 * The Installed view derives entirely from a fresh enumeration of installed
 * titles on every refresh, so a forwarder removed outside the app (System
 * Settings, another installer) simply stops matching — no stale badge, no
 * leftover state. The helpers here are pure (vitest-covered); enumeration
 * and any device mutation are injected so tests never touch `Switch`.
 */

export type ForwarderStatus = 'installed' | 'missing';

export interface LifecycleApp {
	path: string;
	forwarderId?: string;
}

/** Per-app install state plus installed titles with no source NRO. */
export interface LibraryLifecycle {
	/** Install state keyed by library path. */
	statuses: Map<string, ForwarderStatus>;
	/**
	 * Installed title IDs claimed by no library app: the source NRO was
	 * deleted/renamed outside the app, or the forwarder came from elsewhere.
	 * Shown as a stale count, never as a phantom library entry.
	 */
	staleInstalledIds: string[];
}

function normalizeId(id: string): string {
	return id.trim().toLowerCase();
}

/**
 * Classify every library app against a fresh enumeration of installed
 * titles. Recompute from a new enumeration after each operation — never
 * reuse a previous result — so outside changes cannot leave stale state.
 */
export function classifyLibraryLifecycle(
	apps: LifecycleApp[],
	installedIds: Iterable<string>,
): LibraryLifecycle {
	const installed = new Set<string>();
	for (const id of installedIds) {
		const normalized = normalizeId(id);
		if (/^[0-9a-f]{16}$/.test(normalized)) installed.add(normalized);
	}
	const statuses = new Map<string, ForwarderStatus>();
	const claimed = new Set<string>();
	for (const app of apps) {
		const id = app.forwarderId ? normalizeId(app.forwarderId) : '';
		const isInstalled = id !== '' && installed.has(id);
		statuses.set(app.path, isInstalled ? 'installed' : 'missing');
		if (id !== '') claimed.add(id);
	}
	const staleInstalledIds = [...installed].filter((id) => !claimed.has(id));
	staleInstalledIds.sort();
	return { statuses, staleInstalledIds };
}

export type DestructiveAction = 'uninstall' | 'replace';

/**
 * Installing over an already-installed title ID or uninstalling a
 * forwarder always requires an explicit confirmation step. Browsing and
 * configuring never trigger these actions.
 */
export function requiresConfirmation(action: DestructiveAction): boolean {
	return action === 'uninstall' || action === 'replace';
}

export type ConfirmationResult =
	| { ok: true }
	| { ok: false; error: string };

/**
 * Gate a destructive action behind an explicit confirmation. The error
 * names the affected title and tells the user how to proceed or back out.
 */
export function guardDestructiveAction(
	action: DestructiveAction,
	titleName: string,
	titleId: string,
	confirmed: boolean,
): ConfirmationResult {
	if (confirmed) return { ok: true };
	const verb = action === 'uninstall' ? 'Uninstall' : 'Replace';
	return {
		ok: false,
		error: `${verb} of "${titleName}" [${titleId}] needs confirmation — activate the action a second time to confirm, or go back to cancel. The installed forwarder is left untouched until you confirm.`,
	};
}

/**
 * Describe an install/operation failure with the affected title and a
 * recovery suggestion. Never include key material or raw device errors
 * verbatim — callers pass a short `cause` they have already sanitised.
 */
export function lifecycleError(
	action: string,
	titleName: string,
	titleId: string,
	cause: string,
): string {
	return `${action} failed for "${titleName}" [${titleId}]: ${cause}. Refresh the library and retry; if it persists, reinstall the forwarder.`;
}
