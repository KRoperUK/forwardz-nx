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
 * actually perform the action (issue #10). See docs/usb-sd-access.md for the
 * full feasibility audit this screen's copy is derived from.
 *
 * Display only: no SD reads or writes, no USB session, no lifecycle. A/B
 * both dismiss back to the previous screen.
 */
export function UsbSdAccess() {
	const root = useParent();
	const navigate = useNavigate();
	const screenWidth = root.ctx.canvas.width;
	const screenHeight = root.ctx.canvas.height;

	const feasibility = evaluateUsbSdAccessFeasibility(Switch.version);

	useGamepadButton('A', () => navigate(-1), [navigate]);
	useGamepadButton('B', () => navigate(-1), [navigate]);
	useGamepadButton('Plus', () => Switch.exit(), []);

	return (
		<>
			<Rect width={screenWidth} height={screenHeight} fill='#0b1220' />
			<Rect width={screenWidth} height={7} fill='#8197b2' />

			<Text fill='#f6f8fb' fontSize={34} x={42} y={34}>
				{USB_SD_ACCESS_TITLE}
			</Text>
			<Text fill='#8197b2' fontSize={18} x={44} y={84}>
				{USB_SD_ACCESS_SUMMARY}
			</Text>

			<Group x={42} y={130} width={screenWidth - 84} height={452}>
				<Rect
					width={screenWidth - 84}
					height={452}
					fill='#151f33'
					stroke='#3d4b61'
					lineWidth={2}
				/>
				<Text
					fill='#ffffff'
					fontSize={22}
					x={28}
					y={28}
					maxWidth={screenWidth - 140}
				>
					{feasibility.reason}
				</Text>
				{feasibility.details.map((detail, index) => (
					<Text
						key={detail}
						fill='#d8e4f2'
						fontSize={16}
						x={28}
						y={96 + index * 78}
						maxWidth={screenWidth - 140}
					>
						{`• ${detail}`}
					</Text>
				))}
			</Group>

			<Text
				fill='#56e0c0'
				fontSize={15}
				x={42}
				y={600}
				maxWidth={screenWidth - 84}
				overflow='ellipsis'
			>
				{USB_SD_ACCESS_FOOTER_NOTE}
			</Text>

			<Footer>
				<FooterItem button='B' x={24}>
					Back
				</FooterItem>
				<FooterItem button='Plus' x={140}>
					Exit
				</FooterItem>
			</Footer>
		</>
	);
}
