import { describe, expect, it } from 'vitest';
import {
	PROD_KEYS_PATHS,
	discoverProdKeys,
	rescanProdKeys,
	validateProdKeys,
} from './prod-keys';

function encode(text: string): ArrayBuffer {
	return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

const GOOD_KEYS = 'master_key_00 = 1234abcdef5678\npackage2_key_00 = 0011223344556677\n';

describe('discoverProdKeys', () => {
	it('selects the first location that has a file', () => {
		const files = new Map<string, ArrayBuffer>([
			[PROD_KEYS_PATHS[1], encode(GOOD_KEYS)],
		]);
		const found = discoverProdKeys((path) => files.get(path) ?? null);
		expect(found.path).toBe(PROD_KEYS_PATHS[1]);
		expect(found.data).not.toBeNull();
		expect(found.checkedPaths).toEqual([...PROD_KEYS_PATHS]);
		expect(found.unreadablePaths).toEqual([]);
	});

	it('skips throwing locations and records them as unreadable', () => {
		const found = discoverProdKeys((path) => {
			if (path === PROD_KEYS_PATHS[0]) throw new Error('denied');
			return null;
		});
		expect(found.data).toBeNull();
		expect(found.unreadablePaths).toEqual([PROD_KEYS_PATHS[0]]);
	});
});

describe('validateProdKeys', () => {
	it('reports missing files distinctly', () => {
		const report = validateProdKeys({
			data: null,
			path: null,
			checkedPaths: [...PROD_KEYS_PATHS],
			unreadablePaths: [],
		});
		expect(report.state).toBe('missing');
		expect(report.message).toContain('No prod.keys found');
	});

	it('reports unreadable files distinctly', () => {
		const report = validateProdKeys({
			data: null,
			path: null,
			checkedPaths: [...PROD_KEYS_PATHS],
			unreadablePaths: [PROD_KEYS_PATHS[0]],
		});
		expect(report.state).toBe('unreadable');
		expect(report.message).toContain(PROD_KEYS_PATHS[0]);
	});

	it('reports non-text and keyless files as malformed', () => {
		const binary = validateProdKeys({
			data: new Uint8Array([0xff, 0xfe, 0x00]).buffer as ArrayBuffer,
			path: PROD_KEYS_PATHS[0],
			checkedPaths: [...PROD_KEYS_PATHS],
			unreadablePaths: [],
		});
		expect(binary.state).toBe('malformed');
		const keyless = validateProdKeys({
			data: encode('hello world\n'),
			path: PROD_KEYS_PATHS[0],
			checkedPaths: [...PROD_KEYS_PATHS],
			unreadablePaths: [],
		});
		expect(keyless.state).toBe('malformed');
		expect(keyless.message).toContain('no key entries');
	});

	it('accepts files with key entries and counts them', () => {
		const report = validateProdKeys({
			data: encode(GOOD_KEYS),
			path: PROD_KEYS_PATHS[2],
			checkedPaths: [...PROD_KEYS_PATHS],
			unreadablePaths: [],
		});
		expect(report.state).toBe('valid');
		expect(report.keyCount).toBe(2);
		expect(report.message).toContain(PROD_KEYS_PATHS[2]);
	});

	it('never repeats key material in messages', () => {
		const secret = 'aabbccddeeff00112233445566778899';
		const report = validateProdKeys({
			data: encode(`master_key_00 = ${secret}\n`),
			path: PROD_KEYS_PATHS[0],
			checkedPaths: [...PROD_KEYS_PATHS],
			unreadablePaths: [],
		});
		expect(report.state).toBe('valid');
		expect(report.message).not.toContain(secret);
	});
});

describe('rescanProdKeys', () => {
	it('recovers after keys are copied without a restart', () => {
		const files = new Map<string, ArrayBuffer>();
		const read = (path: string) => files.get(path) ?? null;
		expect(rescanProdKeys(read).state).toBe('missing');
		files.set(PROD_KEYS_PATHS[0], encode(GOOD_KEYS));
		const retry = rescanProdKeys(read);
		expect(retry.state).toBe('valid');
		expect(retry.path).toBe(PROD_KEYS_PATHS[0]);
	});
});
