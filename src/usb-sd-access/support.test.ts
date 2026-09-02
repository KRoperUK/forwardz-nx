import { describe, expect, it } from 'vitest';
import {
	USB_SD_ACCESS_DETAILS,
	evaluateUsbSdAccessFeasibility,
} from './support';

describe('evaluateUsbSdAccessFeasibility', () => {
	it('reports unsupported for the audited nx.js runtime version', () => {
		const result = evaluateUsbSdAccessFeasibility({
			nxjs: '0.0.69',
			libnx: '4.9.1',
			hos: '19.0.0',
		});

		expect(result.supported).toBe(false);
		expect(result.reason).toContain('0.0.69');
		expect(result.reason.toLowerCase()).toContain('usb:ds');
	});

	it('reports unsupported for any nx.js version, since no released build exposes usb:ds', () => {
		const result = evaluateUsbSdAccessFeasibility({
			nxjs: '9.9.9',
			libnx: '5.0.0',
			hos: '20.0.0',
		});

		expect(result.supported).toBe(false);
		expect(result.reason).toContain('9.9.9');
	});

	it('falls back to a generic reason when version info is missing', () => {
		const result = evaluateUsbSdAccessFeasibility({
			nxjs: '',
			libnx: '4.9.1',
			hos: '19.0.0',
		});

		expect(result.supported).toBe(false);
		expect(result.reason).toBe(
			'Unable to determine the current runtime version.',
		);
	});

	it('always includes the shared explanation details', () => {
		const result = evaluateUsbSdAccessFeasibility({
			nxjs: '0.0.69',
			libnx: '4.9.1',
			hos: '19.0.0',
		});

		expect(result.details).toEqual([...USB_SD_ACCESS_DETAILS]);
	});

	it('never returns supported: true today', () => {
		// Regression guard: this screen must never silently start claiming
		// support without a corresponding update to docs/usb-sd-access.md
		// and the lifecycle state machine described there.
		const versionsToTry = [
			{ nxjs: '0.0.69', libnx: '4.9.1', hos: '19.0.0' },
			{ nxjs: '0.1.0', libnx: '4.10.0', hos: '20.0.0' },
			{ nxjs: '1.0.0', libnx: '5.0.0', hos: '21.0.0' },
		];

		for (const versions of versionsToTry) {
			expect(evaluateUsbSdAccessFeasibility(versions).supported).toBe(false);
		}
	});
});
