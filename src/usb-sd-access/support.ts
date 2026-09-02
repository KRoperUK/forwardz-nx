/**
 * Pure reasoning module backing the "USB SD Access" screen.
 *
 * This module intentionally contains no rendering, no gamepad handling, and
 * no filesystem access. It exists so the "why is this unsupported" logic can
 * be unit tested independently of react-tela and the native `Switch` global.
 *
 * See `docs/usb-sd-access.md` for the full feasibility audit this module is
 * derived from.
 */

/**
 * Lifecycle states for a hypothetical USB Mass Storage session, as required
 * by the design in docs/usb-sd-access.md. Only `unsupported` is reachable
 * today; the rest are documented here so the type stays the single source of
 * truth if/when the runtime gap closes.
 */
export type UsbSdAccessState =
	| 'unsupported'
	| 'idle'
	| 'preparing'
	| 'mounted'
	| 'stopping'
	| 'restored'
	| 'error';

/** Minimal shape of the pieces of `Switch.version` this module reasons about. */
export interface RuntimeVersions {
	/** The semver version of the nx.js runtime itself, e.g. "0.0.69". */
	nxjs: string;
	/** The version of libnx the runtime was built against. */
	libnx: string;
	/** The Horizon OS (Switch system software) version, e.g. "18.1.0". */
	hos: string;
}

export interface FeasibilityResult {
	supported: boolean;
	/** Short, user-facing reason. Always set, even when `supported` is true. */
	reason: string;
	/** Longer-form detail lines suitable for the explanation screen. */
	details: string[];
}

/**
 * The nx.js runtime version that this audit was performed against. Native
 * `usb:ds` (USB device-mode / gadget) bindings are not present in this
 * version's native bridge (`packages/runtime/src/$.ts`) or in
 * `navigator.usb`, which only wraps host-mode `usb:hs`.
 */
export const AUDITED_UNSUPPORTED_NXJS_VERSION = '0.0.69';

export const USB_SD_ACCESS_TITLE = 'USB SD ACCESS';

export const USB_SD_ACCESS_SUMMARY =
	'This feature is not available on the current runtime.';

/**
 * Explanation bullet points shown on the USB SD Access screen. Kept in one
 * place so the screen component and its tests read the same copy.
 */
export const USB_SD_ACCESS_DETAILS: readonly string[] = [
	'Hekate can show the SD card as a USB disk because it runs before the console boots into the system software (Horizon), before anything else owns the card.',
	'Forwardz runs as a normal application after Horizon has already mounted the SD card, so it cannot safely take exclusive ownership of it.',
	'Doing this safely needs a native USB device-mode driver (usb:ds) that the current nx.js runtime does not expose to apps.',
	'Shipping a button that does not actually work risks SD card corruption, so this screen explains the limitation instead.',
];

export const USB_SD_ACCESS_FOOTER_NOTE =
	'See docs/usb-sd-access.md in the Forwardz repository for the full technical audit.';

/**
 * Evaluates whether the current runtime could support a real USB Mass
 * Storage session, based on the nx.js/libnx versions reported by the
 * console. Accepts an explicit `versions` object (rather than reading
 * `Switch.version` directly) so it can be unit tested without a `Switch`
 * global.
 *
 * As of this audit, no released nx.js version exposes `usb:ds` bindings, so
 * this always returns `supported: false` for now. The version check exists
 * so a future nx.js release that adds the bindings can be detected without
 * re-deriving the reasoning from scratch — the intent is for a later PR to
 * extend this function, not to hardcode a permanent refusal.
 */
export function evaluateUsbSdAccessFeasibility(
	versions: RuntimeVersions,
): FeasibilityResult {
	if (!versions.nxjs || !versions.libnx || !versions.hos) {
		return {
			supported: false,
			reason: 'Unable to determine the current runtime version.',
			details: [...USB_SD_ACCESS_DETAILS],
		};
	}

	// No released nx.js version currently exposes the native usb:ds bindings
	// required for device-mode USB Mass Storage. See docs/usb-sd-access.md.
	return {
		supported: false,
		reason: `nx.js ${versions.nxjs} does not expose USB device-mode (usb:ds) support.`,
		details: [...USB_SD_ACCESS_DETAILS],
	};
}
