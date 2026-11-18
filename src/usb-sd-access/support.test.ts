import { describe, expect, it } from 'vitest';
import {
	AUDITED_UNSUPPORTED_NXJS_VERSION,
	USB_SD_ACCESS_DETAILS,
	USB_SD_ACCESS_EXPLANATION_ENABLED,
	evaluateUsbSdAccessFeasibility,
} from './support';

describe('USB SD Access feasibility (issue #10)', () => {
	it('keeps the explanation scaffolding enabled behind its flag', () => {
		expect(USB_SD_ACCESS_EXPLANATION_ENABLED).toBe(true);
	});

	it('reports unsupported on the audited runtime', () => {
		const result = evaluateUsbSdAccessFeasibility({
			nxjs: AUDITED_UNSUPPORTED_NXJS_VERSION,
			libnx: '4.7.0',
			hos: '18.1.0',
		});
		expect(result.supported).toBe(false);
		expect(result.reason).toContain(AUDITED_UNSUPPORTED_NXJS_VERSION);
		expect(result.details).toEqual([...USB_SD_ACCESS_DETAILS]);
	});

	it('never reports support, even for unknown future versions', () => {
		const result = evaluateUsbSdAccessFeasibility({
			nxjs: '99.0.0',
			libnx: '99.0.0',
			hos: '99.0.0',
		});
		expect(result.supported).toBe(false);
		expect(result.reason.length).toBeGreaterThan(0);
		expect(result.details.length).toBeGreaterThan(0);
	});

	it('falls back to an explicit unknown-version reason, never support', () => {
		for (const versions of [
			{ nxjs: '', libnx: '4.7.0', hos: '18.1.0' },
			{ nxjs: '0.0.69', libnx: '', hos: '18.1.0' },
			{ nxjs: '0.0.69', libnx: '4.7.0', hos: '' },
		] as const) {
			const result = evaluateUsbSdAccessFeasibility({ ...versions });
			expect(result.supported).toBe(false);
			expect(result.reason).toBe(
				'Unable to determine the current runtime version.',
			);
			expect(result.details).toEqual([...USB_SD_ACCESS_DETAILS]);
		}
	});

	it('keeps the explanation copy stable for the screen', () => {
		expect(USB_SD_ACCESS_DETAILS).toHaveLength(4);
		for (const detail of USB_SD_ACCESS_DETAILS) {
			expect(detail.length).toBeGreaterThan(0);
		}
	});
});
