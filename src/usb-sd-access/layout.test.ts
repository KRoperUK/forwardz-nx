import { describe, expect, it } from 'vitest';
import {
	USB_SD_ACCESS_METRICS,
	bulletText,
	layoutUsbSdAccessScreen,
} from './layout';
import { USB_SD_ACCESS_DETAILS, evaluateUsbSdAccessFeasibility } from './support';

const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 720;
const M = USB_SD_ACCESS_METRICS;

/**
 * Approximate proportional-font advance. Deliberately wide (0.62em average,
 * vs ~0.5em typical for system-ui) so the layout is checked against a
 * pessimistic, wider-than-real rendering.
 */
function measureAt(fontSize: number) {
	return (text: string) => text.length * fontSize * 0.62;
}

/** The real copy the screen renders on the audited runtime. */
const feasibility = evaluateUsbSdAccessFeasibility({
	nxjs: '0.0.69',
	libnx: '4.9.1',
	hos: '19.0.0',
});

function layoutRealScreen(width = SCREEN_WIDTH, height = SCREEN_HEIGHT) {
	return layoutUsbSdAccessScreen({
		screenWidth: width,
		screenHeight: height,
		reason: feasibility.reason,
		details: feasibility.details,
		measureReason: measureAt(M.reasonFontSize),
		measureDetail: measureAt(M.detailFontSize),
	});
}

describe('layoutUsbSdAccessScreen', () => {
	it('centres the panel horizontally with equal margins', () => {
		const layout = layoutRealScreen();

		expect(layout.panelX).toBe(M.screenPadding);
		const rightMargin = SCREEN_WIDTH - (layout.panelX + layout.panelWidth);
		expect(rightMargin).toBe(M.screenPadding);
	});

	it('keeps the panel inside the screen', () => {
		const layout = layoutRealScreen();

		expect(layout.panelX).toBeGreaterThanOrEqual(0);
		expect(layout.panelX + layout.panelWidth).toBeLessThanOrEqual(SCREEN_WIDTH);
		expect(layout.panelY + layout.panelHeight).toBeLessThanOrEqual(
			SCREEN_HEIGHT - M.footerHeight,
		);
	});

	it('does not overlap the header text with the panel', () => {
		const layout = layoutRealScreen();
		const summaryBottom = M.summaryY + M.summaryFontSize;

		expect(layout.panelY).toBeGreaterThan(summaryBottom);
	});

	it('stacks every detail row without overlapping', () => {
		const { details } = layoutRealScreen();
		expect(details.rows).toHaveLength(USB_SD_ACCESS_DETAILS.length);

		for (let i = 1; i < details.rows.length; i++) {
			const previousBottom = details.rows[i - 1].y + details.rows[i - 1].height;
			expect(details.rows[i].y).toBeGreaterThanOrEqual(previousBottom);
		}
	});

	it('does not overlap the reason headline with the first detail row', () => {
		const layout = layoutRealScreen();
		const reasonBottom = layout.reason.endY;

		expect(layout.details.rows[0].y).toBeGreaterThan(reasonBottom);
	});

	it('keeps all panel content inside the panel box', () => {
		const layout = layoutRealScreen();
		const lastRow = layout.details.rows[layout.details.rows.length - 1];

		expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(layout.panelHeight);
		expect(layout.reason.rows[0].y).toBeGreaterThanOrEqual(0);
	});

	it('wraps long details rather than leaving them on one over-wide line', () => {
		const layout = layoutRealScreen();
		const measure = measureAt(M.detailFontSize);

		// The audit bullets are long sentences; at this width they must wrap.
		expect(
			layout.details.rows.some((row) => row.lines.length > 1),
		).toBe(true);

		for (const row of layout.details.rows) {
			for (const line of row.lines) {
				if (line.includes(' ')) {
					expect(measure(line)).toBeLessThanOrEqual(layout.contentWidth);
				}
			}
		}
	});

	it('places the note below the panel and above the footer', () => {
		const layout = layoutRealScreen();

		expect(layout.noteY).toBeGreaterThanOrEqual(
			layout.panelY + layout.panelHeight,
		);
		expect(layout.noteY + M.noteFontSize).toBeLessThanOrEqual(
			SCREEN_HEIGHT - M.footerHeight,
		);
	});

	it('does not need clamping for the real copy at 1280x720', () => {
		expect(layoutRealScreen().clamped).toBe(false);
	});

	it('clamps the note above the footer when content is unusually tall', () => {
		const manyDetails = Array.from(
			{ length: 12 },
			(_, i) =>
				`Detail number ${i} that is deliberately long enough to wrap across more than a single rendered line on the screen.`,
		);

		const layout = layoutUsbSdAccessScreen({
			screenWidth: SCREEN_WIDTH,
			screenHeight: SCREEN_HEIGHT,
			reason: feasibility.reason,
			details: manyDetails,
			measureReason: measureAt(M.reasonFontSize),
			measureDetail: measureAt(M.detailFontSize),
		});

		expect(layout.clamped).toBe(true);
		// Even when clamped, the note must not collide with the footer.
		expect(layout.noteY + M.noteFontSize).toBeLessThanOrEqual(
			SCREEN_HEIGHT - M.footerHeight,
		);
	});
});

describe('bulletText', () => {
	it('prefixes the bullet glyph', () => {
		expect(bulletText('hello')).toBe('• hello');
	});
});
