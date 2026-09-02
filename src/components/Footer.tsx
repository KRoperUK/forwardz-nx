import { Fragment } from 'react';
import { Group, Rect, Text, useParent } from 'react-tela';
import { BUTTON_ICONS } from '../button-icons';
import { useMeasureText } from '../hooks/use-measure-text';
import { type FooterAction, layoutFooterItems } from '../layout/footer';

export type { FooterAction };

const FOOTER_HEIGHT = 74;
const LABEL_FONT_SIZE = 24;

/**
 * The bottom button-hint bar.
 *
 * Hint positions are measured from their label widths rather than hardcoded
 * per screen, so hints cannot overlap when labels change length or when a
 * screen adds another hint.
 */
export function Footer({
	actions,
	align = 'right',
}: {
	actions: readonly FooterAction[];
	align?: 'left' | 'right';
}) {
	const root = useParent();
	const width = root.ctx.canvas.width;
	const measureLabel = useMeasureText('system-ui', LABEL_FONT_SIZE);

	const { items } = layoutFooterItems(measureLabel, actions, {
		containerWidth: width,
		align,
	});

	return (
		<Group width={width} height={FOOTER_HEIGHT} y={root.ctx.canvas.height - FOOTER_HEIGHT}>
			<Rect width={width} height={2} fill='white' />
			{items.map((item) => (
				<Fragment key={`${item.button}-${item.label}`}>
					<Text
						fontFamily='system-icons'
						fill='white'
						fontSize={LABEL_FONT_SIZE}
						textBaseline='middle'
						x={item.iconX}
						y={37}
					>
						{BUTTON_ICONS[item.button]}
					</Text>
					<Text
						fontFamily='system-ui'
						fill='white'
						fontSize={LABEL_FONT_SIZE}
						textBaseline='middle'
						x={item.labelX}
						y={37}
					>
						{item.label}
					</Text>
				</Fragment>
			))}
		</Group>
	);
}
