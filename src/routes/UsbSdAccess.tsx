import { Group, Rect, Text, useParent } from 'react-tela';
import { useNavigate } from 'react-router-dom';
import { Footer, FooterItem } from '../components/Footer';
import { useGamepadButton } from '../hooks/use-gamepad';
import {
	USB_SD_ACCESS_FOOTER_NOTE,
	USB_SD_ACCESS_SUMMARY,
	USB_SD_ACCESS_TITLE,
	evaluateUsbSdAccessFeasibility,
} from '../usb-sd-access/support';

/**
 * Explains why full USB Mass Storage (Hekate-style SD card access over USB)
 * is not offered as a feature, instead of showing a button that cannot
 * actually perform the action. See docs/usb-sd-access.md for the full
 * feasibility audit this screen's copy is derived from.
 */
export function UsbSdAccess() {
	const root = useParent();
	const navigate = useNavigate();
	const width = root.ctx.canvas.width;

	const feasibility = evaluateUsbSdAccessFeasibility(Switch.version);

	useGamepadButton('A', () => navigate(-1), [navigate]);
	useGamepadButton('B', () => navigate(-1), [navigate]);

	return (
		<>
			<Rect width={width} height={root.ctx.canvas.height} fill='#0b1220' />
			<Rect width={width} height={7} fill='#8197b2' />
			<Text fill='#f6f8fb' fontSize={34} x={42} y={34}>
				{USB_SD_ACCESS_TITLE}
			</Text>
			<Text fill='#8197b2' fontSize={18} x={44} y={82}>
				{USB_SD_ACCESS_SUMMARY}
			</Text>

			<Group x={42} y={130} width={960} height={360}>
				<Rect width={960} height={360} fill='#151f33' stroke='#3d4b61' lineWidth={2} />
				<Text fill='#ffffff' fontSize={24} x={28} y={30}>
					{feasibility.reason}
				</Text>
				{feasibility.details.map((line, index) => (
					<Text
						key={line}
						fill='#d8e4f2'
						fontSize={17}
						x={28}
						y={72 + index * 56}
						maxWidth={904}
						overflow='clip'
					>
						{`• ${line}`}
					</Text>
				))}
			</Group>

			<Text fill='#56e0c0' fontSize={15} x={44} y={520}>
				{USB_SD_ACCESS_FOOTER_NOTE}
			</Text>

			<Footer>
				<FooterItem button='B' x={width - 320}>Back</FooterItem>
				<FooterItem button='A' x={width - 160}>Back</FooterItem>
			</Footer>
		</>
	);
}
