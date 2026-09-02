import { Group, Rect, Text, useParent } from 'react-tela';
import { useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { useGamepadButton } from '../hooks/use-gamepad';
import { useMeasureText } from '../hooks/use-measure-text';
import { USB_SD_ACCESS_METRICS, layoutUsbSdAccessScreen } from '../usb-sd-access/layout';
import {
	USB_SD_ACCESS_FOOTER_NOTE,
	USB_SD_ACCESS_SUMMARY,
	USB_SD_ACCESS_TITLE,
	evaluateUsbSdAccessFeasibility,
} from '../usb-sd-access/support';

const M = USB_SD_ACCESS_METRICS;

/**
 * Explains why full USB Mass Storage (Hekate-style SD card access over USB)
 * is not offered as a feature, instead of showing a button that cannot
 * actually perform the action. See docs/usb-sd-access.md for the full
 * feasibility audit this screen's copy is derived from.
 *
 * Positions come from `layoutUsbSdAccessScreen`, which derives them from
 * measured and wrapped text, so the explanation can change length without
 * overlapping the panel edge, the note beneath it, or the footer.
 */
export function UsbSdAccess() {
	const root = useParent();
	const navigate = useNavigate();
	const screenWidth = root.ctx.canvas.width;
	const screenHeight = root.ctx.canvas.height;

	const feasibility = evaluateUsbSdAccessFeasibility(Switch.version);

	const measureReason = useMeasureText('system-ui', M.reasonFontSize);
	const measureDetail = useMeasureText('system-ui', M.detailFontSize);

	useGamepadButton('A', () => navigate(-1), [navigate]);
	useGamepadButton('B', () => navigate(-1), [navigate]);

	const layout = layoutUsbSdAccessScreen({
		screenWidth,
		screenHeight,
		reason: feasibility.reason,
		details: feasibility.details,
		measureReason,
		measureDetail,
	});

	return (
		<>
			<Rect width={screenWidth} height={screenHeight} fill='#0b1220' />
			<Rect width={screenWidth} height={M.accentHeight} fill='#8197b2' />

			<Text
				fill='#f6f8fb'
				fontSize={M.titleFontSize}
				x={M.screenPadding}
				y={M.titleY}
				maxWidth={layout.panelWidth}
				overflow='ellipsis'
			>
				{USB_SD_ACCESS_TITLE}
			</Text>
			<Text
				fill='#8197b2'
				fontSize={M.summaryFontSize}
				x={M.screenPadding}
				y={M.summaryY}
				maxWidth={layout.panelWidth}
				overflow='ellipsis'
			>
				{USB_SD_ACCESS_SUMMARY}
			</Text>

			<Group
				x={layout.panelX}
				y={layout.panelY}
				width={layout.panelWidth}
				height={layout.panelHeight}
			>
				<Rect
					width={layout.panelWidth}
					height={layout.panelHeight}
					fill='#151f33'
					stroke='#3d4b61'
					lineWidth={2}
				/>
				{layout.reason.rows.map((row) => (
					<Text
						key={row.value}
						fill='#ffffff'
						fontSize={M.reasonFontSize}
						x={layout.contentX}
						y={row.y}
					>
						{row.value}
					</Text>
				))}
				{layout.details.rows.map((row) => (
					<Text
						key={row.value}
						fill='#d8e4f2'
						fontSize={M.detailFontSize}
						lineHeight={M.detailLineHeight}
						x={layout.contentX}
						y={row.y}
					>
						{row.value}
					</Text>
				))}
			</Group>

			<Text
				fill='#56e0c0'
				fontSize={M.noteFontSize}
				x={M.screenPadding}
				y={layout.noteY}
				maxWidth={layout.panelWidth}
				overflow='ellipsis'
			>
				{USB_SD_ACCESS_FOOTER_NOTE}
			</Text>

			<Footer actions={[{ button: 'B', label: 'Back' }]} />
		</>
	);
}
