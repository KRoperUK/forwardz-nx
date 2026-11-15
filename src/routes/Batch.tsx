import { useCallback, useEffect, useMemo, useState } from 'react';
import { Group, Rect, Text, useParent } from 'react-tela';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppInfo } from '../apps';
import {
	buildBatchQueue,
	resetFailedItems,
	summarizeBatch,
	type BatchContext,
	type BatchItem,
} from '../batch';
import { Footer, FooterItem } from '../components/Footer';
import { ScrollGroup } from '../components/ScrollGroup';
import { getInstalledTitleIds } from '../forwarder-state';
import { useDirection, useGamepadButton } from '../hooks/use-gamepad';
import type { GenerateState } from './Generate';

export type BatchRouteState =
	| { finished?: false; apps: AppInfo[] }
	| { finished: true; items: BatchItem[] };

function generateStateFor(
	app: AppInfo,
	batch: BatchContext,
): GenerateState {
	return {
		id: app.forwarderId ?? '',
		icon: app.icon,
		path: app.path,
		romPath: '',
		name: app.name,
		author: app.author,
		version: app.version,
		profileSelector: false,
		install: true,
		batch,
	};
}

function statusColor(status: BatchItem['status']): string {
	if (status === 'succeeded') return '#56e0c0';
	if (status === 'failed') return '#e06c6c';
	if (status === 'skipped') return '#d9a85b';
	return '#d8e4f2';
}

function statusLabel(item: BatchItem): string {
	if (item.status === 'queued') return 'TO INSTALL';
	if (item.status === 'succeeded') return 'DONE';
	if (item.status === 'failed') return `FAILED — ${item.message ?? 'error'}`;
	return `SKIPPED — ${item.message ?? ''}`;
}

export function Batch() {
	const root = useParent();
	const navigate = useNavigate();
	const state = useLocation().state as BatchRouteState;
	const finished = state.finished === true;
	const [includeInstalled, setIncludeInstalled] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [scrollTop, setScrollTop] = useState(0);

	const installedIds = useMemo(() => getInstalledTitleIds(), []);
	const review = useMemo(
		() =>
			finished
				? null
				: buildBatchQueue(
						(state as { apps: AppInfo[] }).apps,
						installedIds,
						{ includeInstalled },
					),
		[state, installedIds, includeInstalled, finished],
	);
	const items = finished ? state.items : (review?.items ?? []);
	const duplicates = finished ? [] : (review?.duplicates ?? []);
	const summary = summarizeBatch(items);
	const queuedCount = items.filter((item) => item.status === 'queued').length;
	const failedCount = summary.failed;

	const viewportWidth = root.ctx.canvas.width;
	const rowHeight = 56;
	const listTop = 190;
	const listHeight = root.ctx.canvas.height - listTop - 150;
	const contentHeight = Math.max(1, items.length * rowHeight);
	const rowsVisible = Math.max(1, Math.floor(listHeight / rowHeight));

	useEffect(() => {
		setSelectedIndex((index) =>
			items.length === 0 ? 0 : Math.min(index, items.length - 1),
		);
		setScrollTop(0);
	}, [items.length]);

	const selectedRow = selectedIndex;
	const centerRow = Math.floor(rowsVisible / 2);
	useEffect(() => {
		setScrollTop(
			Math.max(
				0,
				Math.min(
					(selectedRow - centerRow) * rowHeight,
					Math.max(0, contentHeight - listHeight),
				),
			),
		);
	}, [selectedRow, centerRow, contentHeight, listHeight]);

	const startBatch = useCallback(() => {
		const first = items.findIndex((item) => item.status === 'queued');
		if (first === -1) return;
		navigate('/generate', {
			state: generateStateFor(items[first].app, { items, index: first }),
		});
	}, [items, navigate]);

	const retryFailed = useCallback(() => {
		if (!finished || failedCount === 0) return;
		const reset = resetFailedItems(items);
		const first = reset.findIndex((item) => item.status === 'queued');
		if (first === -1) return;
		navigate('/generate', {
			state: generateStateFor(reset[first].app, { items: reset, index: first }),
		});
	}, [finished, failedCount, items, navigate]);

	const goBack = useCallback(() => {
		if (finished) {
			navigate('/select');
		} else {
			navigate(-1);
		}
	}, [finished, navigate]);

	useGamepadButton(
		'B',
		() => goBack(),
		[goBack],
		true,
	);
	useGamepadButton(
		'X',
		() => {
			if (finished) {
				retryFailed();
			} else {
				startBatch();
			}
		},
		[finished, retryFailed, startBatch],
		finished ? failedCount > 0 : queuedCount > 0,
	);
	useGamepadButton(
		'Y',
		() => setIncludeInstalled((value) => !value),
		[],
		!finished,
	);
	useDirection(
		'Up',
		() => setSelectedIndex((index) => Math.max(0, index - 1)),
		[],
		true,
	);
	useDirection(
		'Down',
		() =>
			setSelectedIndex((index) =>
				Math.min(Math.max(0, items.length - 1), index + 1),
			),
		[items.length],
		true,
	);

	return (
		<>
			<Rect width={viewportWidth} height={root.ctx.canvas.height} fill='#0b1220' />
			<Rect width={viewportWidth} height={6} fill='#56e0c0' />
			<Text fill='#f4f7fb' fontSize={30} x={26} y={18}>
				{finished ? 'BATCH SUMMARY' : 'BATCH REVIEW'}
			</Text>
			<Text fill='#8197b2' fontSize={16} x={28} y={55}>
				{finished
					? 'One failed item never stops the rest — retry below.'
					: 'Items install one by one. Skipped items are left alone.'}
			</Text>
			<Text fill='#56e0c0' fontSize={18} textAlign='right' x={viewportWidth - 28} y={22}>
				{finished
					? `${summary.succeeded} DONE · ${summary.skipped} SKIPPED · ${summary.failed} FAILED`
					: `${queuedCount} TO INSTALL · ${summary.skipped} SKIPPED`}
			</Text>
			{!finished && includeInstalled && (
				<Text fill='#d9a85b' fontSize={15} textAlign='right' x={viewportWidth - 28} y={48}>
					INCLUDING ALREADY-INSTALLED (REINSTALL)
				</Text>
			)}
			{duplicates.map((group, i) => (
				<Text
					key={group.titleId}
					fill='#e06c6c'
					fontSize={15}
					x={28}
					y={82 + i * 24}
					maxWidth={viewportWidth - 56}
					overflow='ellipsis'
				>
					{`Collision: ${group.titleId} claimed by ${group.paths.length} apps — extras skipped.`}
				</Text>
			))}

			<ScrollGroup
				y={listTop}
				width={viewportWidth}
				height={listHeight}
				contentHeight={contentHeight}
				scrollTop={scrollTop}
				onScrollTopChange={setScrollTop}
				numEntries={Math.max(1, items.length)}
				itemsPerPage={rowsVisible}
			>
				{items.map((item, index) => (
					<Group key={item.app.path} width={viewportWidth} height={rowHeight} y={index * rowHeight}>
						<Rect
							x={24}
							width={viewportWidth - 48}
							height={rowHeight - 8}
							fill={selectedIndex === index ? '#243b63' : '#111c2d'}
							stroke={selectedIndex === index ? '#56e0c0' : '#26364d'}
							lineWidth={selectedIndex === index ? 2 : 1}
						/>
						<Text
							fill='#d8e4f2'
							fontSize={17}
							x={40}
							y={index * rowHeight + 8}
							maxWidth={viewportWidth - 320}
							overflow='ellipsis'
						>
							{item.app.name}
						</Text>
						<Text
							fill={statusColor(item.status)}
							fontSize={14}
							textAlign='right'
							x={viewportWidth - 40}
							y={index * rowHeight + 14}
							maxWidth={260}
							overflow='ellipsis'
						>
							{statusLabel(item)}
						</Text>
					</Group>
				))}
				{items.length === 0 && (
					<Text fill='#8197b2' fontSize={24} x={viewportWidth / 2} y={60} textAlign='center'>
						Nothing in this batch
					</Text>
				)}
			</ScrollGroup>

			<Footer>
				<FooterItem button='B' x={24}>
					{finished ? 'Library' : 'Back'}
				</FooterItem>
				{!finished && (
					<FooterItem button='Y' x={190}>
						{includeInstalled ? 'Skip installed' : 'Reinstall too'}
					</FooterItem>
				)}
				{!finished && queuedCount > 0 && (
					<FooterItem button='X' x={430}>
						{`Install ${queuedCount}`}
					</FooterItem>
				)}
				{finished && failedCount > 0 && (
					<FooterItem button='X' x={190}>
						{`Retry ${failedCount} failed`}
					</FooterItem>
				)}
			</Footer>
		</>
	);
}
