import { describe, expect, it } from 'vitest';
import {
	CONTROLLER_MAP,
	WALKTHROUGH_STEPS,
	applyTextScale,
	mappingsForScreen,
	markWalkthroughSeen,
	shouldShowWalkthrough,
	themeFor,
} from './accessibility';

describe('walkthrough', () => {
	it('covers browse, configure, install, hide, and exit', () => {
		const bodies = WALKTHROUGH_STEPS.map((step) => step.body).join('\n');
		for (const word of ['L and R', 'Press A', 'Press X', 'hide', 'Plus']) {
			expect(bodies).toContain(word);
		}
	});

	it('shows until completed or skipped', () => {
		expect(shouldShowWalkthrough(null)).toBe(true);
		expect(shouldShowWalkthrough(undefined)).toBe(true);
		expect(
			shouldShowWalkthrough({
				largerText: false,
				highContrast: false,
				seenWalkthrough: false,
			}),
		).toBe(true);
		expect(
			shouldShowWalkthrough(
				markWalkthroughSeen({
					largerText: false,
					highContrast: false,
					seenWalkthrough: false,
				}),
			),
		).toBe(false);
	});
});

describe('controller map', () => {
	it('documents every library, edit, backup, keys, and walkthrough action', () => {
		for (const screen of ['Library', 'Edit', 'Backup', 'Keys', 'Walkthrough']) {
			expect(mappingsForScreen(screen).length).toBeGreaterThan(0);
		}
		expect(CONTROLLER_MAP.length).toBeGreaterThan(20);
	});

	it('keeps one mapping per screen and button', () => {
		const seen = new Set<string>();
		for (const mapping of CONTROLLER_MAP) {
			const key = `${mapping.screen}:${mapping.button}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
		}
	});
});

describe('text scaling and theme', () => {
	it('scales fonts only when larger text is on', () => {
		expect(applyTextScale(24, null)).toBe(24);
		expect(
			applyTextScale(24, {
				largerText: false,
				highContrast: false,
				seenWalkthrough: true,
			}),
		).toBe(24);
		expect(
			applyTextScale(24, {
				largerText: true,
				highContrast: false,
				seenWalkthrough: true,
			}),
		).toBe(30);
	});

	it('keeps the same style with stronger separation in high contrast', () => {
		const normal = themeFor(null);
		const contrast = themeFor({
			largerText: false,
			highContrast: true,
			seenWalkthrough: true,
		});
		expect(Object.keys(contrast).sort()).toEqual(Object.keys(normal).sort());
		expect(contrast.background).toBe('#000000');
		expect(contrast.text).toBe('#ffffff');
	});
});
