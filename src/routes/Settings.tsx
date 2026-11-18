import { useCallback, useState } from 'react';
import { Rect, Text, useParent } from 'react-tela';
import { useNavigate } from 'react-router-dom';
import { FilePicker } from '../components/FilePicker';
import { Footer, FooterItem } from '../components/Footer';
import { useGamepadButton } from '../hooks/use-gamepad';
import { applyTextScale, themeFor } from '../accessibility';
import {
	SETTINGS_BACKUP_PATH,
	SETTINGS_EXPORT_FILENAME,
	collectSettings,
	describeSettings,
	importSettings,
	loadSettings,
	saveSettings,
	saveSettingsBackup,
	serializeSettings,
	type Settings,
} from '../settings';
import {
	loadAppOverrides,
	loadHiddenPaths,
	saveAppOverrides,
	saveHiddenPaths,
} from '../forwarder-state';
import { parseAppOverrides } from '../overrides';
import { USB_SD_ACCESS_EXPLANATION_ENABLED } from '../usb-sd-access/support';

function switchStorage() {
	return {
		readFile: (path: string) => Switch.readFileSync(path),
		writeFile: (path: string, data: string | BufferSource) => {
			Switch.writeFileSync(path, data);
		},
	};
}

/** Live settings assembled from the on-device stores. */
function readLiveSettings(): Settings {
	const stored = loadSettings(switchStorage());
	const overrides = loadAppOverrides();
	return collectSettings({
		hiddenPaths: loadHiddenPaths(),
		overrides,
		preferences: stored.preferences,
	});
}

type Notice = { kind: 'info' | 'error'; text: string };

/**
 * Settings backup screen (issue #7): export the library organisation to
 * the SD root for moving consoles/cards, import with validation and a
 * replace warning, and roll back from the automatic backup.
 */
export function SettingsScreen() {
	const root = useParent();
	const navigate = useNavigate();
	const width = root.ctx.canvas.width;
	const [notice, setNotice] = useState<Notice | null>(null);
	const [pickerShowing, setPickerShowing] = useState(false);
	const [pending, setPending] = useState<Settings | null>(null);
	const [pendingBackup, setPendingBackup] = useState<string | null>(null);
	const [prefs, setPrefs] = useState(
		() => loadSettings(switchStorage()).preferences,
	);
	const theme = themeFor(prefs);
	const [hasBackup, setHasBackup] = useState(() => {
		try {
			return Switch.readFileSync(SETTINGS_BACKUP_PATH) != null;
		} catch {
			return false;
		}
	});

	const togglePreference = useCallback(
		(key: 'largerText' | 'highContrast') => {
			setPrefs((current) => {
				const next = { ...current, [key]: !current[key] };
				const stored = loadSettings(switchStorage());
				saveSettings(switchStorage(), { ...stored, preferences: next });
				return next;
			});
		},
		[],
	);

	const doExport = useCallback(() => {
		setPending(null);
		try {
			const live = readLiveSettings();
			const raw = serializeSettings(live);
			Switch.writeFileSync(`sdmc:/${SETTINGS_EXPORT_FILENAME}`, raw);
			saveSettings(switchStorage(), live);
			setNotice({
				kind: 'info',
				text: `Exported ${describeSettings(live)} to SD:/${SETTINGS_EXPORT_FILENAME}.`,
			});
		} catch {
			setNotice({
				kind: 'error',
				text: 'Export failed — check free space on the SD card and retry.',
			});
		}
	}, []);

	const applySettings = useCallback(
		(next: Settings, backup: string | null) => {
			try {
				if (backup) saveSettingsBackup(switchStorage(), backup);
				saveHiddenPaths(new Set(next.hiddenPaths));
				saveAppOverrides(parseAppOverrides(next.overrides));
				const stored = loadSettings(switchStorage());
				saveSettings(switchStorage(), { ...next, preferences: stored.preferences });
				setPending(null);
				setHasBackup(backup != null || hasBackup);
				setNotice({
					kind: 'info',
					text: `Applied ${describeSettings(next)}. A backup was kept for rollback.`,
				});
			} catch {
				setNotice({
					kind: 'error',
					text: 'Import failed while writing — current settings were left untouched where possible. Retry or restore the backup.',
				});
			}
		},
		[hasBackup],
	);

	const restoreBackup = useCallback(() => {
		try {
			const raw = Switch.readFileSync(SETTINGS_BACKUP_PATH);
			if (!raw) throw new Error('empty backup');
			const result = importSettings(
				new TextDecoder().decode(raw),
				readLiveSettings(),
			);
			if (!result.ok) {
				setNotice({ kind: 'error', text: `Backup is unusable: ${result.error}` });
				return;
			}
			setPending(result.import.settings);
			setPendingBackup(null);
			setNotice({
				kind: 'info',
				text: `Backup staged (${describeSettings(result.import.settings)}). Press A to restore it.`,
			});
		} catch {
			setNotice({ kind: 'error', text: 'No readable backup found.' });
		}
	}, []);

	// First press stages the import and warns; the second press replaces.
	// With nothing staged, A restores the automatic backup instead.
	const confirmPending = useCallback(() => {
		if (pending) {
			applySettings(pending, pendingBackup);
		} else if (hasBackup) {
			restoreBackup();
		}
	}, [pending, pendingBackup, applySettings, hasBackup, restoreBackup]);

	useGamepadButton(
		'X',
		() => {
			doExport();
		},
		[doExport],
		!pickerShowing,
	);
	useGamepadButton(
		'Y',
		() => {
			setPickerShowing(true);
		},
		[],
		!pickerShowing && !pending,
	);
	useGamepadButton(
		'A',
		() => {
			confirmPending();
		},
		[confirmPending],
		!pickerShowing && (!!pending || hasBackup),
	);
	useGamepadButton(
		'B',
		() => {
			if (pending) {
				setPending(null);
				setPendingBackup(null);
			} else {
				navigate(-1);
			}
		},
		[navigate, pending],
		!pickerShowing,
	);
	useGamepadButton('Plus', () => Switch.exit(), [], !pickerShowing);
	useGamepadButton(
		'L',
		() => {
			togglePreference('largerText');
		},
		[togglePreference],
		!pickerShowing,
	);
	useGamepadButton(
		'R',
		() => {
			togglePreference('highContrast');
		},
		[togglePreference],
		!pickerShowing,
	);
	useGamepadButton(
		'ZL',
		() => navigate('/walkthrough'),
		[navigate],
		!pickerShowing && !pending,
	);
	// Issue #10: explanation-only entry behind its feature flag. The target
	// screen performs no USB or SD activity (docs/usb-sd-access.md).
	useGamepadButton(
		'ZR',
		() => navigate('/usb-sd-access'),
		[navigate],
		!pickerShowing && !pending && USB_SD_ACCESS_EXPLANATION_ENABLED,
	);

	return (
		<>
			<Rect width={width} height={root.ctx.canvas.height} fill={theme.background} />
			<Rect width={width} height={6} fill={theme.accent} />
			<Text fill={theme.text} fontSize={applyTextScale(30, prefs)} x={26} y={18}>
				SETTINGS BACKUP
			</Text>
			<Text fill={theme.muted} fontSize={applyTextScale(16, prefs)} x={28} y={55} maxWidth={width - 56}>
				Move hidden apps, favourites, and overrides to another SD card. Imports validate first and keep a backup.
			</Text>

			<Text fill={theme.text} fontSize={applyTextScale(20, prefs)} x={28} y={110}>
				{`This console: ${describeSettings(readLiveSettings())}.`}
			</Text>
			<Text fill={theme.muted} fontSize={applyTextScale(16, prefs)} x={28} y={136} maxWidth={width - 56}>
				{`Text: ${prefs.largerText ? 'Larger' : 'Standard'} (L) · Contrast: ${prefs.highContrast ? 'High' : 'Standard'} (R)${USB_SD_ACCESS_EXPLANATION_ENABLED ? ' · USB SD info (ZR)' : ''}`}
			</Text>

			{pending && (
				<>
					<Text fill={theme.warning} fontSize={applyTextScale(22, prefs)} x={28} y={176}>
						{`Replace current settings with ${describeSettings(pending)}?`}
					</Text>
					<Text fill={theme.warning} fontSize={applyTextScale(18, prefs)} x={28} y={206}>
						Press A to replace (a backup is kept), B to keep current settings.
					</Text>
				</>
			)}
			{notice && (
				<Text
					fill={notice.kind === 'error' ? theme.error : theme.accent}
					fontSize={applyTextScale(18, prefs)}
					x={28}
					y={pending ? 246 : 176}
					maxWidth={width - 56}
				>
					{notice.text}
				</Text>
			)}

			<Footer>
				<FooterItem button='X' x={24}>Export</FooterItem>
				<FooterItem button='Y' x={170}>Import</FooterItem>
				{hasBackup && !pending && (
					<FooterItem button='A' x={320}>Restore backup</FooterItem>
				)}
				{pending && (
					<FooterItem button='A' x={320}>Replace</FooterItem>
				)}
				<FooterItem button='B' x={500}>Back</FooterItem>
				<FooterItem button='Plus' x={620}>Exit</FooterItem>
				<FooterItem button='L' x={740}>Text size</FooterItem>
				<FooterItem button='R' x={900}>Contrast</FooterItem>
				<FooterItem button='ZL' x={1060}>Walkthrough</FooterItem>
			</Footer>

			{pickerShowing && (
				<FilePicker
					onClose={() => setPickerShowing(false)}
					onSelect={(url) => {
						setPickerShowing(false);
						if (!url.href.toLowerCase().endsWith('.json')) {
							setNotice({
								kind: 'error',
								text: 'Pick a .json settings export — other files cannot be imported.',
							});
							return;
						}
						try {
							const data = Switch.readFileSync(url.href);
							if (!data) throw new Error('empty file');
							const result = importSettings(
								new TextDecoder().decode(data),
								readLiveSettings(),
							);
							if (!result.ok) {
								setNotice({ kind: 'error', text: result.error });
								return;
							}
							setPending(result.import.settings);
							setPendingBackup(result.import.backup);
							setNotice({
								kind: 'info',
								text: `Staged ${describeSettings(result.import.settings)}. Press A to replace, B to cancel.`,
							});
						} catch {
							setNotice({
								kind: 'error',
								text: 'Could not read that file — current settings are untouched.',
							});
						}
					}}
				/>
			)}
		</>
	);
}
