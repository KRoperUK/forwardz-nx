import { describe, expect, it } from 'vitest';
import { FOOTER_DEFAULTS, type FooterAction, layoutFooterItems } from './footer';

/** Deterministic stand-in for canvas measurement: 12px per character. */
const measure = (text: string) => text.length * 12;

/** The full hint set shown on the library screen, the densest footer. */
const SELECT_ACTIONS: FooterAction[] = [
	{ button: 'L', label: 'Previous view' },
	{ button: 'R', label: 'Next view' },
	{ button: 'Y', label: 'Hide' },
	{ button: 'X', label: 'File picker' },
	{ button: 'ZL', label: 'USB SD' },
	{ button: 'A', label: 'Configure' },
	{ button: 'Plus', label: 'Exit' },
];

function assertNoOverlaps(
	items: { iconX: number; labelX: number; width: number }[],
) {
	for (let i = 1; i < items.length; i++) {
		const previousEnd = items[i - 1].iconX + items[i - 1].width;
		expect(items[i].iconX).toBeGreaterThanOrEqual(previousEnd);
	}
}

describe('layoutFooterItems', () => {
	it('returns an empty layout for no actions', () => {
		const result = layoutFooterItems(measure, [], { containerWidth: 1280 });
		expect(result.items).toEqual([]);
		expect(result.totalWidth).toBe(0);
		expect(result.overflows).toBe(false);
	});

	it('positions left-aligned hints from the padding edge', () => {
		const result = layoutFooterItems(
			measure,
			[
				{ button: 'A', label: 'ab' },
				{ button: 'B', label: 'cd' },
			],
			{ containerWidth: 1280, align: 'left', padding: 20, gap: 10 },
		);

		expect(result.items[0].iconX).toBe(20);
		expect(result.items[0].labelX).toBe(20 + FOOTER_DEFAULTS.iconSlot);
		// First item is iconSlot + 24px label wide, then a 10px gap.
		expect(result.items[1].iconX).toBe(20 + FOOTER_DEFAULTS.iconSlot + 24 + 10);
	});

	it('right-aligns so the last hint ends at the padding edge', () => {
		const result = layoutFooterItems(
			measure,
			[
				{ button: 'A', label: 'ab' },
				{ button: 'B', label: 'cd' },
			],
			{ containerWidth: 1000, align: 'right', padding: 20, gap: 10 },
		);

		const last = result.items[result.items.length - 1];
		expect(last.iconX + last.width).toBe(1000 - 20);
	});

	it('defaults to right alignment', () => {
		const result = layoutFooterItems(measure, [{ button: 'A', label: 'ab' }], {
			containerWidth: 1000,
			padding: 20,
		});

		const only = result.items[0];
		expect(only.iconX + only.width).toBe(1000 - 20);
	});

	it('never overlaps hints in the dense library footer at 1280px', () => {
		const result = layoutFooterItems(measure, SELECT_ACTIONS, {
			containerWidth: 1280,
			align: 'left',
		});

		assertNoOverlaps(result.items);
		expect(result.overflows).toBe(false);
	});

	it('keeps the dense footer inside the screen bounds', () => {
		const result = layoutFooterItems(measure, SELECT_ACTIONS, {
			containerWidth: 1280,
			align: 'left',
		});

		const last = result.items[result.items.length - 1];
		expect(last.iconX + last.width).toBeLessThanOrEqual(
			1280 - FOOTER_DEFAULTS.padding,
		);
		expect(result.items[0].iconX).toBeGreaterThanOrEqual(0);
	});

	it('shrinks the gap instead of overlapping when space is tight', () => {
		const roomy = layoutFooterItems(measure, SELECT_ACTIONS, {
			containerWidth: 1280,
			align: 'left',
		});
		const tight = layoutFooterItems(measure, SELECT_ACTIONS, {
			containerWidth: 1000,
			align: 'left',
		});

		expect(tight.gap).toBeLessThan(roomy.gap);
		assertNoOverlaps(tight.items);
	});

	it('never shrinks the gap below minGap', () => {
		const result = layoutFooterItems(measure, SELECT_ACTIONS, {
			containerWidth: 400,
			align: 'left',
			minGap: 9,
		});

		expect(result.gap).toBeGreaterThanOrEqual(9);
	});

	it('reports overflow rather than silently cramming hints', () => {
		const result = layoutFooterItems(
			measure,
			[
				{ button: 'A', label: 'an extremely long hint label here' },
				{ button: 'B', label: 'another extremely long hint label' },
			],
			{ containerWidth: 300 },
		);

		expect(result.overflows).toBe(true);
		// Even when overflowing, hints must still be ordered and non-overlapping.
		assertNoOverlaps(result.items);
	});

	it('keeps hints non-overlapping for every label length', () => {
		for (const label of ['a', 'Hide', 'File picker', 'Install Forwarder']) {
			const result = layoutFooterItems(
				measure,
				[
					{ button: 'B', label },
					{ button: 'A', label },
					{ button: 'X', label },
				],
				{ containerWidth: 1280 },
			);
			assertNoOverlaps(result.items);
		}
	});

	it('places the label after the button glyph slot', () => {
		const result = layoutFooterItems(measure, [{ button: 'A', label: 'Edit' }], {
			containerWidth: 1280,
			iconSlot: 44,
		});

		expect(result.items[0].labelX - result.items[0].iconX).toBe(44);
	});
});
