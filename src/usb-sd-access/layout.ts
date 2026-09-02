/**
 * Geometry for the USB SD Access screen.
 *
 * Kept separate from the component so the layout can be asserted in tests
 * (nothing overlapping, everything inside the 1280x720 screen) without
 * rendering to a canvas.
 */

import {
	type MeasureText,
	type StackTextRowsResult,
	stackTextRows,
} from '../layout/text';

export const USB_SD_ACCESS_METRICS = {
	screenPadding: 42,
	panelPadding: 28,
	panelTop: 130,
	accentHeight: 7,
	titleY: 34,
	titleFontSize: 34,
	summaryY: 84,
	summaryFontSize: 18,
	reasonFontSize: 24,
	/** Gap between the reason headline and the first bullet. */
	reasonToDetailsGap: 22,
	detailFontSize: 17,
	detailLineHeight: 1.35,
	detailGap: 16,
	noteFontSize: 15,
	/** Gap between the panel bottom and the note. */
	panelToNoteGap: 24,
	footerHeight: 74,
} as const;

export interface UsbSdAccessLayoutInput {
	screenWidth: number;
	screenHeight: number;
	reason: string;
	details: readonly string[];
	/** Measures text at `reasonFontSize`. */
	measureReason: MeasureText;
	/** Measures text at `detailFontSize`. */
	measureDetail: MeasureText;
}

export interface UsbSdAccessLayout {
	panelX: number;
	panelY: number;
	panelWidth: number;
	panelHeight: number;
	/** Usable width for text inside the panel. */
	contentWidth: number;
	/** X offset of text inside the panel, relative to the panel. */
	contentX: number;
	reason: StackTextRowsResult;
	details: StackTextRowsResult;
	noteY: number;
	/** `true` when content had to be clamped to avoid the footer. */
	clamped: boolean;
}

/** Prefixes a detail string with the bullet glyph used on screen. */
export function bulletText(detail: string) {
	return `• ${detail}`;
}

/**
 * Computes the panel and note geometry from measured, wrapped text.
 *
 * The panel grows to fit its content, and the note is clamped so it can never
 * be pushed underneath the footer bar.
 */
export function layoutUsbSdAccessScreen(
	input: UsbSdAccessLayoutInput,
): UsbSdAccessLayout {
	const m = USB_SD_ACCESS_METRICS;
	const { screenWidth, screenHeight, reason, details } = input;

	const panelWidth = screenWidth - m.screenPadding * 2;
	const contentWidth = panelWidth - m.panelPadding * 2;

	const reasonLayout = stackTextRows(input.measureReason, [reason], {
		maxWidth: contentWidth,
		fontSize: m.reasonFontSize,
		startY: m.panelPadding,
	});

	const detailLayout = stackTextRows(
		input.measureDetail,
		details.map(bulletText),
		{
			maxWidth: contentWidth,
			fontSize: m.detailFontSize,
			lineHeight: m.detailLineHeight,
			gap: m.detailGap,
			startY: reasonLayout.endY + m.reasonToDetailsGap,
		},
	);

	const panelHeight = detailLayout.endY + m.panelPadding;

	const preferredNoteY = m.panelTop + panelHeight + m.panelToNoteGap;
	const maxNoteY = screenHeight - m.footerHeight - m.noteFontSize - 18;
	const noteY = Math.min(preferredNoteY, maxNoteY);

	return {
		panelX: m.screenPadding,
		panelY: m.panelTop,
		panelWidth,
		panelHeight,
		contentWidth,
		contentX: m.panelPadding,
		reason: reasonLayout,
		details: detailLayout,
		noteY,
		clamped: preferredNoteY > maxNoteY,
	};
}
