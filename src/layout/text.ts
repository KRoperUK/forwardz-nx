/**
 * Pure text layout helpers.
 *
 * react-tela positions every entity absolutely, so stacking multiple blocks of
 * wrapping text requires knowing each block's rendered height *before* laying
 * out the next one. These helpers compute wrapped lines and vertical offsets
 * from a caller-supplied measure function, so they can be unit tested without
 * a canvas.
 *
 * The wrapping algorithm intentionally mirrors `@react-tela/core`'s internal
 * `Text` wrapping (greedy, whitespace-split, one pass per `\n` paragraph) and
 * the same height formula, so precomputed layout matches what actually renders.
 */

/** Measures the rendered width of `text` in pixels, for a fixed font. */
export type MeasureText = (text: string) => number;

export interface TextRowLayout {
	/** The row's text, already split into rendered lines. */
	lines: string[];
	/** `lines` joined with newlines, ready to pass as a `<Text>` value. */
	value: string;
	/** Y offset of the row, relative to the same origin as `startY`. */
	y: number;
	/** Rendered height of the row in pixels. */
	height: number;
}

export interface StackTextRowsOptions {
	/** Maximum line width in pixels before wrapping. */
	maxWidth: number;
	/** Font size in pixels. */
	fontSize: number;
	/** Line height as a multiple of `fontSize`. Matches react-tela's default. */
	lineHeight?: number;
	/** Vertical gap in pixels between consecutive rows. */
	gap?: number;
	/** Y offset of the first row. */
	startY?: number;
}

export interface StackTextRowsResult {
	rows: TextRowLayout[];
	/** Y offset immediately after the last row (no trailing gap). */
	endY: number;
	/** Total height from `startY` to `endY`. */
	totalHeight: number;
}

/**
 * Greedily wraps `text` into lines that each fit within `maxWidth`.
 *
 * Mirrors `@react-tela/core`'s `Text` wrapping: existing newlines are treated
 * as hard paragraph breaks, runs of whitespace collapse to single spaces, and
 * a word longer than `maxWidth` is left on its own (over-long) line rather
 * than being broken mid-word.
 */
export function wrapTextLines(
	measure: MeasureText,
	text: string,
	maxWidth: number,
): string[] {
	const lines: string[] = [];

	for (const paragraph of text.split('\n')) {
		const words = paragraph.split(/\s+/).filter((w) => w.length > 0);

		if (words.length === 0) {
			lines.push('');
			continue;
		}

		let currentLine = words[0];
		for (let i = 1; i < words.length; i++) {
			const candidate = `${currentLine} ${words[i]}`;
			if (measure(candidate) > maxWidth) {
				lines.push(currentLine);
				currentLine = words[i];
			} else {
				currentLine = candidate;
			}
		}
		lines.push(currentLine);
	}

	return lines;
}

export interface AvailableWidthOptions {
	/** Total width of the containing box. */
	containerWidth: number;
	/** Inset from the left edge. */
	leftPadding?: number;
	/** Inset from the right edge. */
	rightPadding?: number;
	/** Width already taken by something else on the same rows (e.g. a
	 * right-aligned status label). */
	reservedWidth?: number;
	/** Gap to leave between this text and the reserved element. */
	gap?: number;
	/** Never return less than this, so text doesn't collapse to nothing. */
	minWidth?: number;
}

/**
 * Width available for text that shares horizontal space with another element.
 *
 * Used for rows where a left-aligned label and a right-aligned value sit on
 * overlapping baselines: without reserving the right-hand element's measured
 * width, a long label silently draws straight through it.
 */
export function availableWidthBeside(options: AvailableWidthOptions): number {
	const {
		containerWidth,
		leftPadding = 0,
		rightPadding = 0,
		reservedWidth = 0,
		gap = 0,
		minWidth = 0,
	} = options;

	const reserved = reservedWidth > 0 ? reservedWidth + gap : 0;
	const available = containerWidth - leftPadding - rightPadding - reserved;

	return Math.max(minWidth, available);
}

/**
 * Height of a block of `lineCount` lines, matching react-tela's `Text`
 * height calculation.
 */
export function textBlockHeight(
	lineCount: number,
	fontSize: number,
	lineHeight = 1.2,
): number {
	if (lineCount <= 1) return fontSize;
	return fontSize * lineHeight * (lineCount - 1) + fontSize;
}

/**
 * Wraps each entry of `texts` and stacks them vertically without overlap,
 * returning per-row `y` offsets and the total consumed height.
 */
export function stackTextRows(
	measure: MeasureText,
	texts: readonly string[],
	options: StackTextRowsOptions,
): StackTextRowsResult {
	const { maxWidth, fontSize, lineHeight = 1.2, gap = 0, startY = 0 } = options;

	const rows: TextRowLayout[] = [];
	let cursor = startY;

	for (let i = 0; i < texts.length; i++) {
		const lines = wrapTextLines(measure, texts[i], maxWidth);
		const height = textBlockHeight(lines.length, fontSize, lineHeight);

		rows.push({ lines, value: lines.join('\n'), y: cursor, height });

		cursor += height;
		if (i < texts.length - 1) cursor += gap;
	}

	return { rows, endY: cursor, totalHeight: cursor - startY };
}
