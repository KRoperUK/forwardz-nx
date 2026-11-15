import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Text, useParent } from 'react-tela';
import type { AppInfo } from '../apps';
import {
	isValidTitleId,
	normalizeTitleId,
	pathChangeCreatesNewId,
} from '../collision';
import { AppIcon } from '../components/AppIcon';
import { Footer, FooterItem } from '../components/Footer';
import { TextInput } from '../components/TextInput';
import { getInstalledTitleIds } from '../forwarder-state';
import { useGamepadButton } from '../hooks/use-gamepad';
import { generateDeterministicID } from '../title-id';
import type { GenerateState } from './Generate';

export interface EditState extends AppInfo {
	romPath?: string;
}

export function Edit() {
	const initialState: EditState = useLocation().state;
	const { icon } = initialState;
	const root = useParent();
	const navigate = useNavigate();
	const [id, setId] = useState('');
	const [name, setName] = useState(() => initialState.name);
	const [author, setAuthor] = useState(() => initialState.author);
	const [version, setVersion] = useState(() => initialState.version);
	const [profileSelector, _setProfileSelector] = useState(false);
	const [nroPath, setNroPath] = useState(() => decodeURI(initialState.path));
	const [romPath, setRomPath] = useState(() =>
		decodeURI(initialState.romPath ?? ''),
	);
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const [generatedId, setGeneratedId] = useState('');
	const [installedIds] = useState<Set<string>>(() => getInstalledTitleIds());
	const lastGeneratedRef = useRef('');
	const initialGeneratedRef = useRef('');

	// Generate a deterministic title ID based on the NRO path and arguments.
	// This matches sphaira's logic so the same NRO always gets the same title ID.
	useEffect(() => {
		let argv = nroPath;
		if (romPath) {
			argv += ` "${romPath}"`;
		}
		generateDeterministicID(nroPath, argv).then((next) => {
			setGeneratedId(next);
			if (!initialGeneratedRef.current) {
				initialGeneratedRef.current = next;
			}
			// Preserve a deliberate user override when the path changes;
			// otherwise keep tracking the derived ID.
			setId((current) =>
				current === '' || current === lastGeneratedRef.current
					? next
					: current,
			);
			lastGeneratedRef.current = next;
		});
	}, [nroPath, romPath]);

	// Collision warnings, checked before any installation begins.
	const overridden =
		id !== '' &&
		generatedId !== '' &&
		normalizeTitleId(id) !== normalizeTitleId(generatedId);
	const overrideValid = isValidTitleId(id);
	const alreadyInstalled =
		id !== '' && installedIds.has(normalizeTitleId(id));
	const pathChangedId =
		!overridden &&
		pathChangeCreatesNewId(initialGeneratedRef.current, generatedId);
	const warnings: { text: string; error: boolean }[] = [];
	if (overridden) {
		warnings.push(
			overrideValid
				? {
						text: 'Custom title ID kept — use it to migrate an existing forwarder.',
						error: false,
					}
				: { text: 'Custom title ID must be 16 hex digits.', error: true },
		);
	}
	if (overrideValid && alreadyInstalled) {
		warnings.push({
			text: 'This title ID is already installed — installing will replace that forwarder.',
			error: false,
		});
	}
	if (pathChangedId) {
		warnings.push({
			text: 'The new path produces a different title ID — the old forwarder stays installed separately.',
			error: false,
		});
	}

	const fields = [
		{ name: 'Title ID', value: id, onChange: setId, description: '' },
		{ name: 'App Title', value: name, onChange: setName },
		{ name: 'Author', value: author, onChange: setAuthor },
		{ name: 'Version', value: version, onChange: setVersion },
		{
			name: romPath ? 'Core Path' : 'NRO Path',
			value: nroPath,
			onChange: setNroPath,
		},
		//{ name: 'Enable Profile Selector', value: profileSelector, onChange: setProfileSelector },
	];
	if (initialState.romPath) {
		fields.push({ name: 'ROM Path', value: romPath, onChange: setRomPath });
	}
	const fieldsLength = fields.length;
	const keyboardShown = navigator.virtualKeyboard.boundingRect.height > 0;

	const goToGenerate = useCallback(
		(install: boolean) => {
			const state: GenerateState = {
				id,
				icon,
				path: nroPath,
				romPath,
				name,
				author,
				version,
				profileSelector,
				install,
			};
			navigate('/generate', { state });
		},
		[
			id,
			icon,
			nroPath,
			romPath,
			name,
			author,
			version,
			profileSelector,
			navigate,
		],
	);

	useGamepadButton(
		'X',
		() => goToGenerate(true),
		[goToGenerate],
		!keyboardShown,
	);

	useGamepadButton(
		'Y',
		() => goToGenerate(false),
		[goToGenerate],
		!keyboardShown,
	);

	useGamepadButton(
		'B',
		() => {
			// Go back
			navigate(-1);
		},
		[navigate],
		!keyboardShown,
	);

	useGamepadButton(
		'Up',
		() => {
			setFocusedIndex((i) => Math.max(0, i - 1));
		},
		[],
		!keyboardShown,
	);

	useGamepadButton(
		'Down',
		() => {
			setFocusedIndex((i) => Math.min(fieldsLength - 1, i + 1));
		},
		[fieldsLength],
		!keyboardShown,
	);

	return (
		<>
			<Text fill='white' fontSize={32} x={4} y={8}>
				Edit configuration for your forwarder:
			</Text>

			{fields.map(({ name, value, onChange }, i) => (
				<>
					<Text
						key={`${name}-label`}
						fill='white'
						fontSize={24}
						x={20}
						y={88 + i * 50}
					>
						{name}:
					</Text>
					<TextInput
						key={`${name}-input`}
						value={value}
						onChange={onChange}
						width={700}
						x={160}
						y={80 + i * 50}
						fontSize={24}
						fill='white'
						focused={focusedIndex === i}
						onTouchEnd={() => setFocusedIndex(i)}
					/>
				</>
			))}

			{warnings.map((warning, i) => (
				<Text
					key={warning.text}
					fill={warning.error ? '#e06c6c' : '#d9a85b'}
					fontSize={20}
					x={20}
					y={88 + fieldsLength * 50 + i * 32}
				>
					{warning.text}
				</Text>
			))}

			<AppIcon icon={icon} x={root.ctx.canvas.width - 320} y={64} />

			<Footer>
				<FooterItem button='B' x={root.ctx.canvas.width - 740}>
					Back
				</FooterItem>
				<FooterItem button='A' x={root.ctx.canvas.width - 620}>
					Edit
				</FooterItem>
				<FooterItem button='Y' x={root.ctx.canvas.width - 510}>
					Save Forwarder
				</FooterItem>
				<FooterItem button='X' x={root.ctx.canvas.width - 260}>
					Install Forwarder
				</FooterItem>
			</Footer>
		</>
	);
}
