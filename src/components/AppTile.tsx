import { useCallback } from 'react';
import { Group, Rect, Text, useParent } from 'react-tela';
import { AppIcon } from './AppIcon';
import { useScrollDrag } from './ScrollGroup';

export function AppTile({
	icon,
	name,
	index,
	selected,
	installed = false,
	hidden = false,
	onTouchEnd,
}: {
	icon: ArrayBuffer | undefined;
	name: string;
	index: number;
	selected: boolean;
	installed?: boolean;
	hidden?: boolean;
	onTouchEnd?: () => void;
}) {
	const root = useParent();
	const { isDragging } = useScrollDrag();
	const perRow = 5;
	const width = root.ctx.canvas.width / perRow;
	const height = 174;
	const x = (index % perRow) * width;
	const y = Math.floor(index / perRow) * height;
	const cardWidth = width - 14;
	const cardHeight = height - 12;
	const iconSize = 102;
	const handleTouchEnd = useCallback(() => {
		if (!isDragging()) {
			onTouchEnd?.();
		}
	}, [isDragging, onTouchEnd]);
	return (
		<Group
			width={width}
			height={height}
			x={x}
			y={y}
			onTouchEnd={handleTouchEnd}
		>
			<Rect
				x={7}
				width={cardWidth}
				height={cardHeight}
				fill={selected ? '#243b63' : '#151f33'}
				stroke={selected ? '#56e0c0' : installed ? '#35c89a' : '#2b3a53'}
				lineWidth={selected ? 3 : 2}
			/>
			<AppIcon
				icon={icon}
				width={iconSize}
				height={iconSize}
				x={width / 2 - iconSize / 2}
				y={12}
			/>
			<Rect
				x={width - 94}
				y={14}
				width={72}
				height={22}
				fill={installed ? '#1b8a6b' : '#a8662a'}
			/>
			<Text
				fill='white'
				fontSize={12}
				textAlign='center'
				x={width - 58}
				y={18}
			>
				{installed ? 'INSTALLED' : 'TO INSTALL'}
			</Text>
			<Text
				fill={selected ? '#ffffff' : '#d8e4f2'}
				fontSize={17}
				x={width / 2}
				y={iconSize + 26}
				textAlign='center'
				maxWidth={cardWidth - 20}
				overflow='ellipsis'
			>
				{name}
			</Text>
			<Text
				fill={hidden ? '#d9a85b' : '#7990ab'}
				fontSize={12}
				x={width / 2}
				y={iconSize + 51}
				textAlign='center'
			>
				{hidden ? 'HIDDEN FROM ALL' : 'FORWARDER READY'}
			</Text>
		</Group>
	);
}
