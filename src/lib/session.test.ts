import { describe, expect, it } from 'vitest';
import { createSignedSessionValue, timingSafeEqual, verifySignedSessionValue } from './session.js';

const SECRET = 'correct horse battery staple';
const MAX_AGE = 60 * 60; // 1 hour
const NOW = Date.UTC(2026, 0, 1);

describe('signed session cookies', () => {
	it('accepts a freshly issued cookie', async () => {
		const value = await createSignedSessionValue(SECRET, NOW);
		expect(await verifySignedSessionValue(SECRET, value, MAX_AGE, NOW)).toBe(true);
	});

	it('issues a different value every time', async () => {
		const a = await createSignedSessionValue(SECRET, NOW);
		const b = await createSignedSessionValue(SECRET, NOW);
		expect(a).not.toBe(b);
	});

	it.each([
		['missing', undefined],
		['empty', ''],
		['the old unsigned value', 'authenticated'],
		['no signature', 'abc.def.'],
		['no payload', '.deadbeef'],
		['non-hex signature', 'abc.def.zzzz'],
		['odd-length signature', 'abc.def.abc']
	])('rejects a %s cookie', async (_, value) => {
		expect(await verifySignedSessionValue(SECRET, value, MAX_AGE, NOW)).toBe(false);
	});

	it('rejects a cookie signed with a different secret', async () => {
		const value = await createSignedSessionValue('old password', NOW);
		expect(await verifySignedSessionValue(SECRET, value, MAX_AGE, NOW)).toBe(false);
	});

	it('rejects a cookie with a tampered payload', async () => {
		const value = await createSignedSessionValue(SECRET, NOW);
		const [, nonce, signature] = value.split('.');
		const forged = `${(NOW + 1000).toString(36)}.${nonce}.${signature}`;
		expect(await verifySignedSessionValue(SECRET, forged, MAX_AGE, NOW)).toBe(false);
	});

	it('rejects a cookie with a tampered signature', async () => {
		const value = await createSignedSessionValue(SECRET, NOW);
		const last = value.at(-1) === '0' ? '1' : '0';
		const forged = value.slice(0, -1) + last;
		expect(await verifySignedSessionValue(SECRET, forged, MAX_AGE, NOW)).toBe(false);
	});

	it('accepts a cookie right up to maxAge', async () => {
		const value = await createSignedSessionValue(SECRET, NOW);
		const at = NOW + MAX_AGE * 1000;
		expect(await verifySignedSessionValue(SECRET, value, MAX_AGE, at)).toBe(true);
	});

	it('rejects a cookie older than maxAge, even with a valid signature', async () => {
		const value = await createSignedSessionValue(SECRET, NOW);
		const at = NOW + MAX_AGE * 1000 + 1;
		expect(await verifySignedSessionValue(SECRET, value, MAX_AGE, at)).toBe(false);
	});

	it('rejects a cookie issued too far in the future', async () => {
		const value = await createSignedSessionValue(SECRET, NOW + 5 * 60_000);
		expect(await verifySignedSessionValue(SECRET, value, MAX_AGE, NOW)).toBe(false);
	});

	it('tolerates small clock skew between servers', async () => {
		const value = await createSignedSessionValue(SECRET, NOW + 10_000);
		expect(await verifySignedSessionValue(SECRET, value, MAX_AGE, NOW)).toBe(true);
	});
});

describe('timingSafeEqual', () => {
	it('matches identical strings', async () => {
		expect(await timingSafeEqual('hunter2', 'hunter2')).toBe(true);
	});

	it.each([
		['hunter2', 'hunter3'],
		['hunter2', 'hunter22'],
		['hunter2', ''],
		['Hunter2', 'hunter2']
	])('rejects %j vs %j', async (a, b) => {
		expect(await timingSafeEqual(a, b)).toBe(false);
	});
});
