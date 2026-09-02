import { describe, expect, it } from 'vitest';
import { stackTextRows, textBlockHeight, wrapTextLines } from './text';

/** Deterministic stand-in for canvas measurement: 10px per character. */
const measure = (text: string) => text.length * 10;

describe('wrapTextLines', () => {
	it('keeps short text on a single line', () => {
		expect(wrapTextLines(measure, 'hello world', 500)).toEqual(['hello world']);
	});

	it('wraps on word boundaries at the width limit', () => {
		// Each word is 40px ("aaaa"), plus 10px per joining space.
		const lines = wrapTextLines(measure, 'aaaa aaaa aaaa aaaa', 90);
		expect(lines).toEqual(['aaaa aaaa', 'aaaa aaaa']);
	});

	it('treats newlines as hard paragraph breaks', () => {
		expect(wrapTextLines(measure, 'one\ntwo', 1000)).toEqual(['one', 'two']);
	});

	it('collapses runs of whitespace', () => {
		expect(wrapTextLines(measure, 'one   two', 1000)).toEqual(['one two']);
	});

	it('leaves a word longer than maxWidth on its own line rather than dropping it', () => {
		const lines = wrapTextLines(measure, 'tiny enormouswordhere tiny', 60);
		expect(lines).toContain('enormouswordhere');
		expect(lines.join(' ')).toContain('enormouswordhere');
	});

	it('never returns a line exceeding maxWidth unless it is a single long word', () => {
		const text =
			'the quick brown fox jumps over the lazy dog and keeps running onwards';
		for (const line of wrapTextLines(measure, text, 200)) {
			if (line.includes(' ')) {
				expect(measure(line)).toBeLessThanOrEqual(200);
			}
		}
	});
});

describe('textBlockHeight', () => {
	it('is exactly the font size for a single line', () => {
		expect(textBlockHeight(1, 20)).toBe(20);
	});

	it('adds line height for each additional line', () => {
		// 2 lines at fontSize 20, lineHeight 1.5 => 20*1.5*1 + 20
		expect(textBlockHeight(2, 20, 1.5)).toBe(50);
	});

	it('treats an empty block as one line', () => {
		expect(textBlockHeight(0, 18)).toBe(18);
	});
});

describe('stackTextRows', () => {
	it('stacks rows without overlapping', () => {
		const { rows } = stackTextRows(measure, ['aaaa aaaa aaaa', 'bbbb', 'cccc'], {
			maxWidth: 90,
			fontSize: 20,
			gap: 8,
		});

		for (let i = 1; i < rows.length; i++) {
			const previousBottom = rows[i - 1].y + rows[i - 1].height;
			expect(rows[i].y).toBeGreaterThanOrEqual(previousBottom);
		}
	});

	it('applies the gap between rows but not after the last one', () => {
		const result = stackTextRows(measure, ['aa', 'bb'], {
			maxWidth: 1000,
			fontSize: 10,
			gap: 5,
			startY: 0,
		});

		expect(result.rows[0].y).toBe(0);
		expect(result.rows[1].y).toBe(15); // 10px row + 5px gap
		expect(result.endY).toBe(25); // no trailing gap
		expect(result.totalHeight).toBe(25);
	});

	it('honours startY', () => {
		const result = stackTextRows(measure, ['aa'], {
			maxWidth: 1000,
			fontSize: 12,
			startY: 40,
		});

		expect(result.rows[0].y).toBe(40);
		expect(result.endY).toBe(52);
		expect(result.totalHeight).toBe(12);
	});

	it('accounts for wrapped lines when computing the next row position', () => {
		const result = stackTextRows(measure, ['aaaa aaaa aaaa aaaa', 'next'], {
			maxWidth: 90,
			fontSize: 10,
			lineHeight: 2,
			gap: 0,
		});

		// First row wraps to 2 lines: 10*2*1 + 10 = 30px tall.
		expect(result.rows[0].lines).toHaveLength(2);
		expect(result.rows[0].height).toBe(30);
		expect(result.rows[1].y).toBe(30);
	});

	it('exposes a newline-joined value ready for rendering', () => {
		const result = stackTextRows(measure, ['aaaa aaaa aaaa aaaa'], {
			maxWidth: 90,
			fontSize: 10,
		});

		expect(result.rows[0].value).toBe('aaaa aaaa\naaaa aaaa');
	});

	it('handles an empty input list', () => {
		const result = stackTextRows(measure, [], {
			maxWidth: 100,
			fontSize: 10,
			startY: 5,
		});

		expect(result.rows).toEqual([]);
		expect(result.endY).toBe(5);
		expect(result.totalHeight).toBe(0);
	});
});
