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
import { FilePicker } from '../components/FilePicker';
import { Footer, FooterItem } from '../components/Footer';
import { TextInput } from '../components/TextInput';
import { checkIconFile, validateMetadata } from '../artwork';
import {
	getInstalledTitleIds,
	loadAppOverrides,
	saveAppOverrides,
} from '../forwarder-state';
import { useGamepadButton } from '../hooks/use-gamepad';
import { guardDestructiveAction } from '../lifecycle';
import { getAppOverride, setAppOverride } from '../overrides';
import { generateDeterministicID } from '../title-id';
import type { GenerateState } from './Generate';

export interface EditState extends AppInfo {
	romPath?: string;
}

export function Edit() {
	const initialState: EditState = useLocation().state;
	const root = useParent();
	const navigate = useNavigate();
	const [storedOverride] = useState(() =>
		getAppOverride(loadAppOverrides(), decodeURI(initialState.path)),
	);
	const [id, setId] = useState('');
	const [name, setName] = useState(
		() => storedOverride?.name ?? initialState.name,
	);
	const [author, setAuthor] = useState(
		() => storedOverride?.author ?? initialState.author,
	);
	const [version, setVersion] = useState(
		() => storedOverride?.version ?? initialState.version,
	);
	const [favourite, setFavourite] = useState(
		() => storedOverride?.favourite ?? false,
	);
	const [customIcon, setCustomIcon] = useState<ArrayBuffer | null>(() => {
		if (!storedOverride?.iconPath) return null;
		try {
			return Switch.readFileSync(storedOverride.iconPath);
		} catch {
			return null;
		}
	});
	const [iconPath, setIconPath] = useState(
		() => storedOverride?.iconPath ?? '',
	);
	const [iconPickerShowing, setIconPickerShowing] = useState(false);
	const [iconError, setIconError] = useState<string | null>(null);
	const [profileSelector, _setProfileSelector] = useState(false);
	const [nroPath, setNroPath] = useState(() => decodeURI(initialState.path));
	const [romPath, setRomPath] = useState(() =>
		decodeURI(initialState.romPath ?? ''),
	);
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const icon = customIcon ?? initialState.icon;
	const [generatedId, setGeneratedId] = useState('');
	const [installedIds] = useState<Set<string>>(() => getInstalledTitleIds());
	const [replaceArmed, setReplaceArmed] = useState(false);
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
	// A retargeted title ID disarms a pending replace confirmation.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the effect must re-run when the title ID changes; the setter alone cannot express that.
	useEffect(() => {
		setReplaceArmed(false);
	}, [id]);
	const warnings: { text: string; error: boolean }[] = [];
	if (replaceArmed && overrideValid && alreadyInstalled) {
		const gate = guardDestructiveAction('replace', name, id, false);
		if (!gate.ok) {
			warnings.push({ text: gate.error, error: false });
		}
	}
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
	const metadata = validateMetadata({ name, author, version });
	for (const error of metadata.errors) {
		warnings.push({ text: error, error: true });
	}
	for (const warning of metadata.warnings) {
		warnings.push({ text: warning, error: false });
	}
	if (iconError) {
		warnings.push({ text: iconError, error: true });
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: metadata travels as one object into validateMetadata and initialState is location state (stable for the screen's lifetime).
	const goToGenerate = useCallback(
		(install: boolean) => {
			// Blocking metadata errors are shown above; stay put until fixed.
			if (validateMetadata({ name, author, version }).errors.length > 0) {
				return;
			}
			// Installing over an already-installed title replaces that
			// forwarder, so the first press only arms the confirmation.
			if (install && overrideValid && alreadyInstalled && !replaceArmed) {
				setReplaceArmed(true);
				return;
			}
			// Persist per-app overrides for future regeneration; fields
			// matching the scanned NRO are cleared rather than stored.
			saveAppOverrides(
				setAppOverride(loadAppOverrides(), nroPath, {
					name: name !== initialState.name ? name : undefined,
					author: author !== initialState.author ? author : undefined,
					version: version !== initialState.version ? version : undefined,
					favourite,
					iconPath: iconPath === '' ? undefined : iconPath,
				}),
			);
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
			overrideValid,
			alreadyInstalled,
			replaceArmed,
			name,
			author,
			version,
			nroPath,
			favourite,
			iconPath,
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
			setFocusedIndex((i) => Math.min(fieldsLength + 1, i + 1));
		},
		[fieldsLength],
		!keyboardShown && !iconPickerShowing,
	);

	const extraRows = [
		{
			name: 'Icon',
			value: iconPath === '' ? 'NRO embedded (A to import)' : 'Custom (A to change)',
		},
		{ name: 'Favourite', value: favourite ? 'YES (A to clear)' : 'NO (A to set)' },
	];

	useGamepadButton(
		'A',
		() => {
			if (focusedIndex === fieldsLength) {
				setIconPickerShowing(true);
			} else if (focusedIndex === fieldsLength + 1) {
				setFavourite((value) => !value);
			}
		},
		[focusedIndex, fieldsLength],
		!keyboardShown && !iconPickerShowing && focusedIndex >= fieldsLength,
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

			{extraRows.map((row, j) => {
				const i = fieldsLength + j;
				const focused = focusedIndex === i;
				return (
					<>
						<Text
							key={`${row.name}-label`}
							fill='white'
							fontSize={24}
							x={20}
							y={88 + i * 50}
						>
							{row.name}:
						</Text>
						<Text
							key={`${row.name}-value`}
							fill={focused ? '#56e0c0' : 'white'}
							fontSize={24}
							x={160}
							y={88 + i * 50}
						>
							{`${focused ? '> ' : ''}${row.value}`}
						</Text>
					</>
				);
			})}

			{warnings.map((warning, i) => (
				<Text
					key={warning.text}
					fill={warning.error ? '#e06c6c' : '#d9a85b'}
					fontSize={20}
					x={20}
					y={88 + (fieldsLength + extraRows.length) * 50 + i * 32}
				>
					{warning.text}
				</Text>
			))}

			<AppIcon icon={icon} x={root.ctx.canvas.width - 320} y={64} />
			<Text
				fill='#8197b2'
				fontSize={16}
				x={root.ctx.canvas.width - 320}
				y={64 + 256 + 12}
			>
				{iconPath === ''
					? 'Preview: NRO icon, center-cropped to 256x256.'
					: 'Preview: custom icon, center-cropped to 256x256.'}
			</Text>

			{iconPickerShowing && (
				<FilePicker
					onClose={() => setIconPickerShowing(false)}
					onSelect={(url) => {
						setIconPickerShowing(false);
						let size = -1;
						try {
							const stat = Switch.statSync(url);
							size = stat ? stat.size : -1;
						} catch {
							size = -1;
						}
						const check = checkIconFile(url.href, size);
						if (!check.ok) {
							setIconError(check.reason);
							return;
						}
						try {
							const data = Switch.readFileSync(url);
							if (!data) throw new Error('empty file');
							setCustomIcon(data);
							setIconPath(decodeURI(url.href));
							setIconError(null);
						} catch {
							setIconError(
								'Could not read that icon — pick another file.',
							);
						}
					}}
				/>
			)}

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
