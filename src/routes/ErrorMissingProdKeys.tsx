import { useCallback, useState } from 'react';
import { Image, Group, Rect, Text, useParent } from 'react-tela';
import { useNavigate } from 'react-router-dom';
import { Footer, FooterItem } from '../components/Footer';
import { useGamepadButton } from '../hooks/use-gamepad';
import {
	PROD_KEYS_PATHS,
	rescanProdKeys,
	type ProdKeysValidation,
} from '../prod-keys';

const GUIDE_URL = 'https://docs.ryujinx.app/guides/dumping/keys/';

export function ErrorMissingProdKeys() {
	const root = useParent();
	const navigate = useNavigate();
	const width = root.ctx.canvas.width;
	const [retry, setRetry] = useState<ProdKeysValidation | null>(null);

	// Refresh after copying keys to the SD Card — no restart needed.
	// On success the library opens; otherwise the report explains why.
	const rescan = useCallback(() => {
		const report = rescanProdKeys((path) => Switch.readFileSync(path));
		if (report.state === 'valid') {
			navigate('/select');
			return;
		}
		setRetry(report);
	}, [navigate]);

	useGamepadButton('A', () => Switch.exit(), []);
	useGamepadButton(
		'X',
		() => {
			rescan();
		},
		[rescan],
	);
	useGamepadButton('Plus', () => Switch.exit(), []);

	return (
		<>
			<Rect width={width} height={root.ctx.canvas.height} fill='#0b1220' />
			<Rect width={width} height={7} fill='#e6a84d' />
			<Text fill='#f6f8fb' fontSize={34} x={42} y={34}>
				KEYS REQUIRED
			</Text>
			<Text fill='#e6a84d' fontSize={18} x={44} y={82}>
				Forwarder generation is paused until your console keys are available.
			</Text>

			<Group x={42} y={130} width={720} height={420}>
				<Rect width={720} height={420} fill='#151f33' stroke='#3d4b61' lineWidth={2} />
				<Text fill='#ffffff' fontSize={28} x={28} y={28}>
					You must first dump your console's keys.
				</Text>
				<Text fill='#d8e4f2' fontSize={22} x={28} y={82}>
					Consider using the following guide:
				</Text>
				<Text fill='#56e0c0' fontSize={17} x={28} y={126} maxWidth={665} overflow='clip'>
					{GUIDE_URL}
				</Text>
				<Text fill='#8197b2' fontSize={16} x={28} y={178}>
					After dumping, place prod.keys in one of these locations:
				</Text>
				{PROD_KEYS_PATHS.map((path, index) => (
					<Text key={path} fill='#d8e4f2' fontSize={16} x={44} y={210 + index * 27}>
						{`• ${path.replace('sdmc:', 'SD:')}`}
					</Text>
				))}
				{retry && (
					<Text fill='#e6a84d' fontSize={16} x={28} y={312} maxWidth={665} overflow='clip'>
						{`Retry: ${retry.message}`}
					</Text>
				)}
				<Text fill='#8197b2' fontSize={16} x={28} y={retry ? 366 : 342}>
					{retry
						? 'Copy the file over, then press X to retry — no restart needed.'
						: 'Then relaunch this app, or copy the file and press X to retry.'}
				</Text>
			</Group>

			<Group x={840} y={146} width={300} height={350}>
				<Rect width={300} height={350} fill='#f6f8fb' />
				<Image src='romfs:/key-guide-qr.png' x={25} y={25} width={250} height={250} />
				<Text fill='#0b1220' fontSize={19} textAlign='center' x={150} y={292}>
					Scan for the key-dump guide
				</Text>
			</Group>

			<Footer>
				<FooterItem button='X' x={width - 340}>Retry</FooterItem>
				<FooterItem button='A' x={width - 220}>Exit</FooterItem>
				<FooterItem button='Plus' x={width - 100}>Exit</FooterItem>
			</Footer>
		</>
	);
}
