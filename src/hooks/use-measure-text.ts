import { useMemo } from 'react';
import { useParent } from 'react-tela';
import type { MeasureText } from '../layout/text';

/** Quotes a font family name only when it needs it, like CSS requires. */
function formatFamily(fontFamily: string) {
	if (fontFamily.includes(',')) return fontFamily;
	return fontFamily.includes(' ') ? `"${fontFamily}"` : fontFamily;
}

/**
 * Returns a memoized text-measuring function bound to a specific font, using
 * the parent canvas context.
 *
 * `useTextMetrics` from react-tela measures a single fixed string; this returns
 * a reusable measurer so layout helpers can measure many strings for one font.
 */
export function useMeasureText(
	fontFamily = 'sans-serif',
	fontSize = 24,
	fontWeight = '',
): MeasureText {
	const { ctx } = useParent();

	return useMemo(() => {
		const font = `${fontWeight} ${fontSize}px ${formatFamily(fontFamily)}`.trim();
		return (text: string) => {
			ctx.font = font;
			return ctx.measureText(text).width;
		};
	}, [ctx, fontFamily, fontSize, fontWeight]);
}
