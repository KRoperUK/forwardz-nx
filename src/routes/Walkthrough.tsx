import { useCallback, useState } from 'react';
import { Rect, Text, useParent } from 'react-tela';
import { useNavigate } from 'react-router-dom';
import { Footer, FooterItem } from '../components/Footer';
import { useGamepadButton } from '../hooks/use-gamepad';
import {
	WALKTHROUGH_STEPS,
	applyTextScale,
	mappingsForScreen,
	markWalkthroughSeen,
	themeFor,
} from '../accessibility';
import { loadSettings, saveSettings } from '../settings';

function switchStorage() {
	return {
		readFile: (path: string) => Switch.readFileSync(path),
		writeFile: (path: string, data: string | BufferSource) => {
			Switch.writeFileSync(path, data);
		},
	};
}

/**
 * First-run tour (issue #8). Completing or skipping records
 * `seenWalkthrough` so it shows once; the backup screen replays it.
 * Text size and contrast follow the stored accessibility preferences.
 */
export function Walkthrough() {
	const root = useParent();
	const navigate = useNavigate();
	const width = root.ctx.canvas.width;
	const [preferences] = useState(
		() => loadSettings(switchStorage()).preferences,
	);
	const [index, setIndex] = useState(0);
	const theme = themeFor(preferences);
	const titleSize = applyTextScale(34, preferences);
	const bodySize = applyTextScale(20, preferences);
	const step = WALKTHROUGH_STEPS[index];

	const finish = useCallback(() => {
		const stored = loadSettings(switchStorage());
		saveSettings(switchStorage(), {
			...stored,
			preferences: markWalkthroughSeen(stored.preferences),
		});
		navigate('/select');
	}, [navigate]);

	useGamepadButton(
		'A',
		() => {
			if (index >= WALKTHROUGH_STEPS.length - 1) {
				finish();
			} else {
				setIndex(index + 1);
			}
		},
		[index, finish],
	);
	useGamepadButton(
		'B',
		() => {
			setIndex((current) => Math.max(0, current - 1));
		},
		[],
	);
	useGamepadButton(
		'Plus',
		() => {
			finish();
		},
		[finish],
	);

	return (
		<>
			<Rect width={width} height={root.ctx.canvas.height} fill={theme.background} />
			<Rect width={width} height={6} fill={theme.accent} />
			<Text fill={theme.text} fontSize={titleSize} x={42} y={34}>
				{`WELCOME — ${step.title}`}
			</Text>
			<Text
				fill={theme.text}
				fontSize={bodySize}
				x={44}
				y={92}
				maxWidth={width - 88}
			>
				{step.body}
			</Text>
			<Text fill={theme.muted} fontSize={applyTextScale(16, preferences)} x={44} y={170}>
				{`STEP ${index + 1} OF ${WALKTHROUGH_STEPS.length}`}
			</Text>

			{mappingsForScreen('Library').map((mapping, row) => (
				<Text
					key={`${mapping.button}-${mapping.action}`}
					fill={theme.muted}
					fontSize={applyTextScale(16, preferences)}
					x={44}
					y={210 + row * 28}
				>
					{`${mapping.button}: ${mapping.action}`}
				</Text>
			))}

			<Footer>
				<FooterItem button='A' x={42}>
					{index >= WALKTHROUGH_STEPS.length - 1 ? 'Finish' : 'Next'}
				</FooterItem>
				<FooterItem button='B' x={220}>Back</FooterItem>
				<FooterItem button='Plus' x={340}>Skip tour</FooterItem>
			</Footer>
		</>
	);
}
