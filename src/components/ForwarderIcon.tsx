import { useEffect, useState } from 'react';
import { type AppInfo, pathToAppInfo } from '../apps';
import { AppIcon } from './AppIcon';
import { Group, Rect, Text } from 'react-tela';

export interface ForwarderIconProps {
	x: number;
	y: number;
	label: string;
	app: AppInfo;
	selected: boolean;
	onTouchEnd?: () => void;
}

export function NROForwarderIcon(
	props: Omit<ForwarderIconProps, 'app' | 'label'>,
) {
	const [app, setApp] = useState<AppInfo | null>(null);

	useEffect(() => {
		const path = new URL('sdmc:/hbmenu.nro');
		const app = pathToAppInfo(path);
		if (app) setApp(app);
	}, []);

	if (!app) return null;

	return <ForwarderIcon {...props} app={app} label='Forwardz' />;
}

export function RetroArchForwarderIcon(
	props: Omit<ForwarderIconProps, 'app' | 'label'>,
) {
	const [app, setApp] = useState<AppInfo | null>(null);

	useEffect(() => {
		const path = new URL('sdmc:/switch/retroarch_switch.nro');
		const app = pathToAppInfo(path);
		if (app) setApp(app);
	}, []);

	if (!app) return null;

	return <ForwarderIcon {...props} app={app} label='RetroArch Forwarder' />;
}

function ForwarderIcon({
	x,
	y,
	app,
	label,
	selected,
	onTouchEnd,
}: ForwarderIconProps) {
	const width = 330;
	const height = 330;
	return (
		<Group width={width} height={height} x={x} y={y}>
			<AppIcon
				icon={app.icon}
				x={width / 2 - 256 / 2}
				y={20}
				width={256}
				height={256}
				onTouchEnd={onTouchEnd}
			/>
			<Text x={width / 2} y={287} textAlign='center' fill='white' fontSize={24}>
				{label}
			</Text>
			{selected && (
				<Rect width={width} height={height} stroke='blue' lineWidth={10} />
			)}
		</Group>
	);
}
