/**
 * Controller-first accessibility and onboarding (issue #8).
 *
 * First-run walkthrough steps, the full controller map each screen
 * documents itself from, and the larger-text / high-contrast preferences.
 * Everything here is pure (vitest-covered); routes render from it so the
 * documented controls and the working controls cannot drift apart.
 */

import type { SettingsPreferences } from './settings';

export interface WalkthroughStep {
	title: string;
	body: string;
}

/** First-run tour: browse, configure, install, hide, exit. */
export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
	{
		title: 'BROWSE THE LIBRARY',
		body: 'Move with the stick or D-pad. L and R switch between all apps, installed forwarders, and apps still to install.',
	},
	{
		title: 'CONFIGURE A FORWARDER',
		body: 'Press A on a tile to edit its title, author, version, icon, and favourite flag. The preview shows the final HOME-menu icon.',
	},
	{
		title: 'INSTALL OR SAVE',
		body: 'Press X to install the forwarder to the HOME menu, Y to save the NSP to the SD card. Installing over an existing title asks twice.',
	},
	{
		title: 'HIDE WHAT YOU DO NOT USE',
		body: 'Press Y in the library to hide a tile without deleting anything. Hidden apps stay hidden after restarts and exports.',
	},
	{
		title: 'BACK UP AND EXIT',
		body: 'Press ZL for the backup screen to move your setup to another card. Press Plus anywhere to exit the app.',
	},
];

export interface ControllerMapping {
	screen: string;
	button: string;
	action: string;
}

/**
 * Every user-facing action and its controller mapping. In-app footers and
 * the walkthrough render from this table.
 */
export const CONTROLLER_MAP: ControllerMapping[] = [
	{ screen: 'Library', button: 'Stick/D-pad', action: 'Move selection' },
	{ screen: 'Library', button: 'A', action: 'Configure forwarder' },
	{ screen: 'Library', button: 'B', action: 'Back' },
	{ screen: 'Library', button: 'X', action: 'Open file picker' },
	{ screen: 'Library', button: 'Y', action: 'Hide or show app' },
	{ screen: 'Library', button: 'L/R', action: 'Previous/next view' },
	{ screen: 'Library', button: 'Minus', action: 'Batch mode' },
	{ screen: 'Library', button: 'ZR', action: 'Refresh library' },
	{ screen: 'Library', button: 'ZL', action: 'Backup screen' },
	{ screen: 'Library', button: 'Plus', action: 'Exit' },
	{ screen: 'Edit', button: 'Up/Down', action: 'Move between fields' },
	{ screen: 'Edit', button: 'A', action: 'Import icon / toggle favourite' },
	{ screen: 'Edit', button: 'X', action: 'Install forwarder' },
	{ screen: 'Edit', button: 'Y', action: 'Save forwarder' },
	{ screen: 'Edit', button: 'B', action: 'Back' },
	{ screen: 'Backup', button: 'X', action: 'Export settings' },
	{ screen: 'Backup', button: 'Y', action: 'Import settings' },
	{ screen: 'Backup', button: 'A', action: 'Confirm replace / restore' },
	{ screen: 'Backup', button: 'B', action: 'Back' },
	{ screen: 'Backup', button: 'L', action: 'Toggle larger text' },
	{ screen: 'Backup', button: 'R', action: 'Toggle high contrast' },
	{ screen: 'Backup', button: 'ZL', action: 'Replay walkthrough' },
	{ screen: 'Backup', button: 'Plus', action: 'Exit' },
	{ screen: 'Keys', button: 'X', action: 'Retry detection' },
	{ screen: 'Keys', button: 'A/Plus', action: 'Exit' },
	{ screen: 'Walkthrough', button: 'A', action: 'Next step' },
	{ screen: 'Walkthrough', button: 'B', action: 'Previous step' },
	{ screen: 'Walkthrough', button: 'Plus', action: 'Skip tour' },
];

/** Mappings for one screen, in controller order. */
export function mappingsForScreen(screen: string): ControllerMapping[] {
	return CONTROLLER_MAP.filter((mapping) => mapping.screen === screen);
}

/** First-run tour shows until it has been completed or skipped. */
export function shouldShowWalkthrough(
	preferences: SettingsPreferences | null | undefined,
): boolean {
	return !preferences || preferences.seenWalkthrough !== true;
}

export function markWalkthroughSeen(
	preferences: SettingsPreferences,
): SettingsPreferences {
	return { ...preferences, seenWalkthrough: true };
}

/** Scale base font sizes up when larger text is enabled. */
export function applyTextScale(
	baseFontSize: number,
	preferences: SettingsPreferences | null | undefined,
): number {
	if (preferences?.largerText === true) {
		return Math.round(baseFontSize * 1.25);
	}
	return baseFontSize;
}

export interface AccessibilityTheme {
	background: string;
	surface: string;
	text: string;
	muted: string;
	accent: string;
	warning: string;
	error: string;
}

const DEFAULT_THEME: AccessibilityTheme = {
	background: '#0b1220',
	surface: '#111c2d',
	text: '#f4f7fb',
	muted: '#8197b2',
	accent: '#56e0c0',
	warning: '#d9a85b',
	error: '#e06c6c',
};

/**
 * Theme for new screens. High contrast keeps the same visual style with
 * stronger separation; it never inverts meaning (warnings stay warm,
 * errors stay red).
 */
export function themeFor(
	preferences: SettingsPreferences | null | undefined,
): AccessibilityTheme {
	if (preferences?.highContrast === true) {
		return {
			background: '#000000',
			surface: '#0d1526',
			text: '#ffffff',
			muted: '#c9d4e3',
			accent: '#00ffb0',
			warning: '#ffd166',
			error: '#ff6b6b',
		};
	}
	return { ...DEFAULT_THEME };
}
