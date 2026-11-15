/**
 * Custom artwork and metadata editing (issue #4).
 *
 * Generation cover-crops artwork to the 256x256 HOME-menu icon instead of
 * stretching it, and the preview uses the same geometry so what the user
 * sees is what gets written. Everything here is pure (vitest-covered);
 * Jimp decoding and SD reads stay in the routes.
 */

/** Final HOME-menu icon dimension. Generation and preview share it. */
export const HOME_MENU_ICON_SIZE = 256;

/**
 * Icons at or above this size make Atmosphere show a "?" tile, so
 * generation re-encodes at lower JPEG quality until the icon fits.
 */
export const MAX_HOME_MENU_ICON_BYTES = 0x20000;

/** Refuse icon imports larger than this before decoding them. */
export const MAX_ICON_SOURCE_BYTES = 8 * 1024 * 1024;

/** File types Jimp can decode for icon imports. */
export const SUPPORTED_ICON_EXTENSIONS = [
	'.jpg',
	'.jpeg',
	'.png',
	'.bmp',
] as const;

export const MAX_METADATA_TITLE_LENGTH = 64;
export const MAX_METADATA_AUTHOR_LENGTH = 64;
export const MAX_METADATA_VERSION_LENGTH = 16;

export interface MetadataInput {
	name: string;
	author: string;
	version: string;
}

export interface MetadataValidation {
	/** Blocking problems: generation refuses to start until fixed. */
	errors: string[];
	/** Non-blocking concerns shown alongside the preview. */
	warnings: string[];
}

/**
 * Validate title metadata before generation. Empty titles/authors fail
 * generation downstream, so they block; over-long values still generate
 * (the HOME menu truncates) but warn so the preview can be trusted.
 */
export function validateMetadata(input: MetadataInput): MetadataValidation {
	const errors: string[] = [];
	const warnings: string[] = [];
	const name = input.name.trim();
	const author = input.author.trim();
	const version = input.version.trim();
	if (name === '') {
		errors.push('App title is required — generation cannot start without it.');
	} else if (name.length > MAX_METADATA_TITLE_LENGTH) {
		warnings.push(
			`App title is ${name.length} characters; the HOME menu shows the first ${MAX_METADATA_TITLE_LENGTH}.`,
		);
	}
	if (author === '') {
		errors.push('Author is required — generation cannot start without it.');
	} else if (author.length > MAX_METADATA_AUTHOR_LENGTH) {
		warnings.push(
			`Author is ${author.length} characters; the HOME menu shows the first ${MAX_METADATA_AUTHOR_LENGTH}.`,
		);
	}
	if (
		version !== '' &&
		(version.length > MAX_METADATA_VERSION_LENGTH ||
			!/^[0-9A-Za-z._-]+$/.test(version))
	) {
		warnings.push(
			`Version should be up to ${MAX_METADATA_VERSION_LENGTH} characters of letters, numbers, ".", "_" or "-".`,
		);
	}
	return { errors, warnings };
}

/** Square center-crop of the source image, in source pixels. */
export interface CoverCrop {
	sx: number;
	sy: number;
	sw: number;
	sh: number;
}

/**
 * Centered cover-crop for a square icon: the largest centered square of
 * the source, matching Jimp `cover()` geometry so the preview and the
 * generated icon agree. Returns `null` for unusable dimensions.
 */
export function computeCoverCrop(
	srcWidth: number,
	srcHeight: number,
): CoverCrop | null {
	if (
		!Number.isFinite(srcWidth) ||
		!Number.isFinite(srcHeight) ||
		srcWidth <= 0 ||
		srcHeight <= 0
	) {
		return null;
	}
	const side = Math.floor(Math.min(srcWidth, srcHeight));
	if (side <= 0) return null;
	return {
		sx: Math.floor((srcWidth - side) / 2),
		sy: Math.floor((srcHeight - side) / 2),
		sw: side,
		sh: side,
	};
}

/** True when the encoded icon fits the HOME-menu size budget. */
export function isIconSizeSafe(byteLength: number): boolean {
	return (
		Number.isFinite(byteLength) &&
		byteLength > 0 &&
		byteLength < MAX_HOME_MENU_ICON_BYTES
	);
}

export type IconFileCheck = { ok: true } | { ok: false; reason: string };

/**
 * Pre-screen an icon import by file name and size before decoding it.
 * Decoding stays in the route so oversized or hostile files fail here.
 */
export function checkIconFile(
	fileName: string,
	byteLength: number,
): IconFileCheck {
	const lower = fileName.toLowerCase();
	const supported = SUPPORTED_ICON_EXTENSIONS.some((ext) =>
		lower.endsWith(ext),
	);
	if (!supported) {
		return {
			ok: false,
			reason: `Unsupported icon type — use one of: ${SUPPORTED_ICON_EXTENSIONS.join(', ')}.`,
		};
	}
	if (!Number.isFinite(byteLength) || byteLength <= 0) {
		return { ok: false, reason: 'Could not read that file — pick another icon.' };
	}
	if (byteLength > MAX_ICON_SOURCE_BYTES) {
		return {
			ok: false,
			reason: `Icon is ${(byteLength / 1048576).toFixed(1)} MB; keep imports under ${MAX_ICON_SOURCE_BYTES / 1048576} MB.`,
		};
	}
	return { ok: true };
}
