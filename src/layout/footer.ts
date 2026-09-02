/**
 * Pure footer layout helper.
 *
 * Footer button hints used to be positioned with hand-tuned `x` values per
 * screen, which meant adding or renaming a hint could silently overlap its
 * neighbour. This computes positions from measured label widths instead, so
 * hints can never collide regardless of label text or how many are shown.
 */

import type { MeasureText } from './text';
import type { ButtonName } from '../types';

/** A single footer button hint. */
export interface FooterAction {
	button: ButtonName;
	label: string;
}

export interface FooterLayoutOptions {
	/** Width of the footer (normally the screen width) in pixels. */
	containerWidth: number;
	/** Which edge the hints are anchored to. */
	align?: 'left' | 'right';
	/** Padding from the anchored edge in pixels. */
	padding?: number;
	/** Preferred gap between hints in pixels. */
	gap?: number;
	/** Smallest gap the layout may shrink to before reporting overflow. */
	minGap?: number;
	/** Horizontal space reserved for the button glyph, before its label. */
	iconSlot?: number;
}

export interface FooterItemLayout extends FooterAction {
	/** X offset of the button glyph. */
	iconX: number;
	/** X offset of the label text. */
	labelX: number;
	/** Total width of glyph + label. */
	width: number;
}

export interface FooterLayoutResult {
	items: FooterItemLayout[];
	/** Gap actually used, after any shrinking to fit. */
	gap: number;
	/** Total width consumed by hints and gaps. */
	totalWidth: number;
	/**
	 * `true` when the hints cannot fit even at `minGap`. Callers should treat
	 * this as a layout bug (too many or too long hints for the screen) rather
	 * than render overlapping text.
	 */
	overflows: boolean;
}

export const FOOTER_DEFAULTS = {
	padding: 24,
	gap: 32,
	minGap: 14,
	iconSlot: 30,
} as const;

/**
 * Computes non-overlapping x positions for footer hints.
 *
 * Hints are laid out in order at their measured widths. If the preferred gap
 * doesn't fit, the gap shrinks (down to `minGap`) before the layout reports
 * `overflows`.
 */
export function layoutFooterItems(
	measure: MeasureText,
	actions: readonly FooterAction[],
	options: FooterLayoutOptions,
): FooterLayoutResult {
	const {
		containerWidth,
		align = 'right',
		padding = FOOTER_DEFAULTS.padding,
		gap: preferredGap = FOOTER_DEFAULTS.gap,
		minGap = FOOTER_DEFAULTS.minGap,
		iconSlot = FOOTER_DEFAULTS.iconSlot,
	} = options;

	if (actions.length === 0) {
		return { items: [], gap: preferredGap, totalWidth: 0, overflows: false };
	}

	const widths = actions.map((a) => iconSlot + measure(a.label));
	const contentWidth = widths.reduce((sum, w) => sum + w, 0);
	const gapCount = actions.length - 1;
	const available = containerWidth - padding * 2;

	let gap = preferredGap;
	if (gapCount > 0 && contentWidth + preferredGap * gapCount > available) {
		const fitted = (available - contentWidth) / gapCount;
		gap = Math.max(minGap, Math.min(preferredGap, fitted));
	}

	const totalWidth = contentWidth + gap * gapCount;
	const overflows = totalWidth > available;

	let cursor =
		align === 'left' ? padding : containerWidth - padding - totalWidth;

	const items = actions.map((action, i) => {
		const width = widths[i];
		const item: FooterItemLayout = {
			...action,
			iconX: cursor,
			labelX: cursor + iconSlot,
			width,
		};
		cursor += width + gap;
		return item;
	});

	return { items, gap, totalWidth, overflows };
}
