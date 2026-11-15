import { describe, expect, it } from 'vitest';
import {
	classifyLibraryLifecycle,
	guardDestructiveAction,
	lifecycleError,
	requiresConfirmation,
} from './lifecycle';

const APPS = [
	{ path: 'sdmc:/switch/a.nro', forwarderId: '0100000000001000' },
	{ path: 'sdmc:/switch/b.nro', forwarderId: '0100000000002000' },
	{ path: 'sdmc:/switch/c.nro' },
];

describe('classifyLibraryLifecycle', () => {
	it('distinguishes installed and missing forwarders', () => {
		const result = classifyLibraryLifecycle(APPS, [
			'0100000000001000',
		]);
		expect(result.statuses.get('sdmc:/switch/a.nro')).toBe('installed');
		expect(result.statuses.get('sdmc:/switch/b.nro')).toBe('missing');
		expect(result.statuses.get('sdmc:/switch/c.nro')).toBe('missing');
		expect(result.staleInstalledIds).toEqual([]);
	});

	it('compares title IDs case-insensitively', () => {
		const result = classifyLibraryLifecycle(APPS, [
			'0100000000002000'.toUpperCase(),
		]);
		expect(result.statuses.get('sdmc:/switch/b.nro')).toBe('installed');
	});

	it('reports installed titles with no source NRO as stale, not as apps', () => {
		const result = classifyLibraryLifecycle(APPS, [
			'0100000000001000',
			'0100000000009999',
		]);
		expect(result.statuses.get('sdmc:/switch/b.nro')).toBe('missing');
		expect(result.staleInstalledIds).toEqual(['0100000000009999']);
	});

	it('drops stale state once the outside forwarder is gone', () => {
		const before = classifyLibraryLifecycle(APPS, ['0100000000009999']);
		expect(before.staleInstalledIds).toEqual(['0100000000009999']);
		// Recomputed from a fresh enumeration after the outside removal.
		const after = classifyLibraryLifecycle(APPS, []);
		expect(after.staleInstalledIds).toEqual([]);
		expect(after.statuses.get('sdmc:/switch/a.nro')).toBe('missing');
	});

	it('ignores malformed installed IDs instead of matching them', () => {
		const result = classifyLibraryLifecycle(APPS, ['not-a-title-id']);
		expect(result.statuses.get('sdmc:/switch/a.nro')).toBe('missing');
		expect(result.staleInstalledIds).toEqual([]);
	});
});

describe('destructive action gating', () => {
	it('requires confirmation for uninstall and replace', () => {
		expect(requiresConfirmation('uninstall')).toBe(true);
		expect(requiresConfirmation('replace')).toBe(true);
	});

	it('refuses unconfirmed actions with the title and a way out', () => {
		const result = guardDestructiveAction(
			'uninstall',
			'My Game',
			'0100000000001000',
			false,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('My Game');
			expect(result.error).toContain('0100000000001000');
			expect(result.error).toContain('cancel');
		}
	});

	it('allows confirmed actions through', () => {
		expect(
			guardDestructiveAction(
				'replace',
				'My Game',
				'0100000000001000',
				true,
			),
		).toEqual({ ok: true });
	});
});

describe('lifecycleError', () => {
	it('names the title and suggests recovery', () => {
		const message = lifecycleError(
			'Install',
			'My Game',
			'0100000000001000',
			'storage full',
		);
		expect(message).toContain('My Game');
		expect(message).toContain('0100000000001000');
		expect(message).toContain('Refresh the library and retry');
	});
});
