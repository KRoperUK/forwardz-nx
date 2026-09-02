import { useCallback, useEffect, useMemo, useState } from 'react';
import { Group, Rect, Text, useParent } from 'react-tela';
import { useNavigate } from 'react-router-dom';
import { type AppInfo, apps, pathToAppInfo } from '../apps';
import { AppTile } from '../components/AppTile';
import { FilePicker } from '../components/FilePicker';
import { Footer, FooterItem } from '../components/Footer';
import { ScrollGroup } from '../components/ScrollGroup';
import { useDirection, useGamepadButton } from '../hooks/use-gamepad';
import {
	getInstalledTitleIds,
	loadHiddenPaths,
	pathKey,
	saveHiddenPaths,
} from '../forwarder-state';
import { generateDeterministicID } from '../title-id';

type Filter = 'all' | 'installed' | 'missing' | 'hidden';

const FILTERS: { key: Filter; label: string }[] = [
	{ key: 'all', label: 'ALL APPS' },
	{ key: 'installed', label: 'INSTALLED' },
	{ key: 'missing', label: 'TO INSTALL' },
	{ key: 'hidden', label: 'HIDDEN' },
];

export function Select() {
	const root = useParent();
	const navigate = useNavigate();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [filterIndex, setFilterIndex] = useState(0);
	const [filePickerShowing, setFilePickerShowing] = useState(false);
	const [scrollTop, setScrollTop] = useState(0);
	const [hiddenPaths, setHiddenPaths] = useState<Set<string>>(
		() => loadHiddenPaths(),
	);
	const [installedIds, setInstalledIds] = useState<Set<string>>(
		() => new Set(),
	);
	const [forwarderIds, setForwarderIds] = useState<Record<string, string>>({});

	const filter = FILTERS[filterIndex].key;
	const perRow = 5;
	const viewportWidth = root.ctx.canvas.width;
	const viewportHeight = root.ctx.canvas.height - 212;
	const tileHeight = 174;

	useEffect(() => {
		setInstalledIds(getInstalledTitleIds());
		let cancelled = false;
		Promise.all(
			apps.map(async (app) => {
				const path = decodeURI(app.path);
				const id = await generateDeterministicID(path, path);
				return [app.path, id] as const;
			}),
		).then((entries) => {
			if (!cancelled) setForwarderIds(Object.fromEntries(entries));
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const isInstalled = useCallback(
		(app: AppInfo) => {
			const id = forwarderIds[app.path];
			return Boolean(id && installedIds.has(id));
		},
		[forwarderIds, installedIds],
	);

	const visibleApps = useMemo(
		() =>
			apps.filter((app) => {
				const hidden = hiddenPaths.has(pathKey(app.path));
				if (filter === 'hidden') return hidden;
				if (hidden) return false;
				if (filter === 'installed') return isInstalled(app);
				if (filter === 'missing') return !isInstalled(app);
				return true;
			}),
		[filter, hiddenPaths, isInstalled],
	);

	const installedCount = apps.filter(isInstalled).length;
	const totalRows = Math.max(1, Math.ceil(visibleApps.length / perRow));
	const contentHeight = totalRows * tileHeight;
	const rowsVisible = Math.max(1, Math.floor(viewportHeight / tileHeight));
	const selectedApp = visibleApps[selectedIndex];

	useEffect(() => {
		setSelectedIndex((index) =>
			visibleApps.length === 0 ? 0 : Math.min(index, visibleApps.length - 1),
		);
		setScrollTop(0);
	}, [visibleApps.length]);

	const selectedRow = Math.floor(selectedIndex / perRow);
	const centerRow = Math.floor(rowsVisible / 2);
	useEffect(() => {
		setScrollTop(
			Math.max(
				0,
				Math.min(
					(selectedRow - centerRow) * tileHeight,
					Math.max(0, contentHeight - viewportHeight),
				),
			),
		);
	}, [selectedRow, centerRow, contentHeight, viewportHeight]);

	const goToEdit = useCallback(
		(appInfo: AppInfo) => navigate('/edit', { state: appInfo }),
		[navigate],
	);

	const toggleHidden = useCallback(() => {
		if (!selectedApp) return;
		setHiddenPaths((current) => {
			const next = new Set(current);
			const key = pathKey(selectedApp.path);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			saveHiddenPaths(next);
			return next;
		});
	}, [selectedApp]);

	useGamepadButton(
		'A',
		() => selectedApp && goToEdit(selectedApp),
		[selectedApp, goToEdit],
		!filePickerShowing,
	);
	useGamepadButton('B', () => navigate(-1), [navigate], !filePickerShowing);
	useGamepadButton('Plus', () => Switch.exit(), [], !filePickerShowing);
	// `selectedApp` is required here so the memoized callback never hides a stale tile.
	// biome-ignore lint/correctness/useExhaustiveDependencies: dependency is consumed by useGamepadButton's callback wrapper
	useGamepadButton('Y', toggleHidden, [selectedApp], !filePickerShowing);
	useGamepadButton(
		'L',
		() => setFilterIndex((index) => Math.max(0, index - 1)),
		[],
		!filePickerShowing,
	);
	useGamepadButton(
		'R',
		() => setFilterIndex((index) => Math.min(FILTERS.length - 1, index + 1)),
		[],
		!filePickerShowing,
	);
	useGamepadButton(
		'X',
		() => setFilePickerShowing(true),
		[],
		!filePickerShowing,
	);

	useDirection(
		'Left',
		() => setSelectedIndex((index) => Math.max(0, index - 1)),
		[],
		!filePickerShowing,
	);
	useDirection(
		'Right',
		() =>
			setSelectedIndex((index) =>
				Math.min(Math.max(0, visibleApps.length - 1), index + 1),
			),
		[visibleApps.length],
		!filePickerShowing,
	);
	useDirection(
		'Up',
		() => setSelectedIndex((index) => Math.max(0, index - perRow)),
		[],
		!filePickerShowing,
	);
	useDirection(
		'Down',
		() =>
			setSelectedIndex((index) =>
				Math.min(Math.max(0, visibleApps.length - 1), index + perRow),
			),
		[visibleApps.length],
		!filePickerShowing,
	);

	return (
		<>
			<Rect width={viewportWidth} height={root.ctx.canvas.height} fill='#0b1220' />
			<Rect width={viewportWidth} height={6} fill='#56e0c0' />
			<Text fill='#f4f7fb' fontSize={30} x={26} y={18}>
				FORWARDZ LIBRARY
			</Text>
			<Text fill='#8197b2' fontSize={16} x={28} y={55}>
				Select homebrew, review its status, and create a HOME-menu shortcut.
			</Text>
			<Text fill='#56e0c0' fontSize={18} textAlign='right' x={viewportWidth - 28} y={22}>
				{`${installedCount} INSTALLED  /  ${apps.length} APPS`}
			</Text>

			<Group x={24} y={82} width={viewportWidth - 48} height={38}>
				{FILTERS.map((tab, index) => {
					const tabWidth = 150;
					const active = filterIndex === index;
					return (
						<Group key={tab.key} x={index * (tabWidth + 8)} width={tabWidth} height={38}>
							<Rect
								width={tabWidth}
								height={38}
								fill={active ? '#224c62' : '#111c2d'}
								stroke={active ? '#56e0c0' : '#26364d'}
								lineWidth={2}
							/>
							<Text
								fill={active ? '#ffffff' : '#8197b2'}
								fontSize={15}
								textAlign='center'
								textBaseline='middle'
								x={tabWidth / 2}
								y={19}
							>
								{tab.label}
							</Text>
						</Group>
					);
				})}
			</Group>

			<ScrollGroup
				y={128}
				width={viewportWidth}
				height={viewportHeight}
				contentHeight={contentHeight}
				scrollTop={scrollTop}
				onScrollTopChange={setScrollTop}
				numEntries={totalRows}
				itemsPerPage={rowsVisible}
			>
				{visibleApps.map((app, index) => (
					<AppTile
						key={app.path}
						icon={app.icon}
						name={app.name}
						index={index}
						installed={isInstalled(app)}
						hidden={hiddenPaths.has(pathKey(app.path))}
						selected={selectedIndex === index}
						onTouchEnd={() => goToEdit(app)}
					/>
				))}
				{visibleApps.length === 0 && (
					<Text fill='#8197b2' fontSize={24} x={viewportWidth / 2} y={120} textAlign='center'>
						{filter === 'hidden' ? 'No hidden apps' : 'No apps in this view'}
					</Text>
				)}
			</ScrollGroup>

			<Rect
				x={24}
				y={root.ctx.canvas.height - 142}
				width={viewportWidth - 48}
				height={50}
				fill='#111c2d'
				stroke='#26364d'
				lineWidth={2}
			/>
			<Text fill='#d8e4f2' fontSize={17} x={40} y={root.ctx.canvas.height - 132}>
				{selectedApp ? selectedApp.name : 'Nothing selected'}
			</Text>
			<Text fill='#8197b2' fontSize={14} x={40} y={root.ctx.canvas.height - 108} maxWidth={viewportWidth - 360} overflow='ellipsis'>
				{selectedApp ? decodeURI(selectedApp.path) : 'Use L/R to change view'}
			</Text>
			<Text fill={selectedApp && isInstalled(selectedApp) ? '#56e0c0' : '#d9a85b'} fontSize={15} textAlign='right' x={viewportWidth - 40} y={root.ctx.canvas.height - 120}>
				{selectedApp ? (isInstalled(selectedApp) ? 'INSTALLED FORWARDER' : 'NOT INSTALLED') : ''}
			</Text>

			<Footer>
				<FooterItem button='L' x={24}>Previous view</FooterItem>
				<FooterItem button='R' x={190}>Next view</FooterItem>
				<FooterItem button='Y' x={350}>{selectedApp && hiddenPaths.has(pathKey(selectedApp.path)) ? 'Show' : 'Hide'}</FooterItem>
				<FooterItem button='X' x={450}>File picker</FooterItem>
				<FooterItem button='A' x={650}>Configure</FooterItem>
				<FooterItem button='Plus' x={850}>Exit</FooterItem>
			</Footer>

			{filePickerShowing && (
				<FilePicker
					onClose={() => setFilePickerShowing(false)}
					onSelect={(url) => {
						const app = pathToAppInfo(url);
						if (app) goToEdit(app);
					}}
				/>
			)}
		</>
	);
}
