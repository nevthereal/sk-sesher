import { describe, expect, it } from 'vitest';
import { createAttemptLimiter } from './rate-limit.js';

const WINDOW = 60_000;
const T0 = 1_000_000;

describe('createAttemptLimiter', () => {
	it('allows up to maxAttempts attempts per window', () => {
		const limiter = createAttemptLimiter(3, WINDOW);
		expect([0, 1, 2].map((i) => limiter.consume('a', T0 + i))).toEqual([0, 0, 0]);
		expect(limiter.consume('a', T0 + 3)).toBeGreaterThan(0);
	});

	it('reports the time left until the window ends', () => {
		const limiter = createAttemptLimiter(1, WINDOW);
		limiter.consume('a', T0);

		expect(limiter.consume('a', T0 + 10)).toBe(WINDOW - 10);
		expect(limiter.consume('a', T0 + WINDOW - 1)).toBe(1);
		expect(limiter.consume('a', T0 + WINDOW)).toBe(0);
	});

	it('never lets a burst of synchronous calls exceed the limit', () => {
		const limiter = createAttemptLimiter(10, WINDOW);
		const allowed = Array.from({ length: 50 }, () => limiter.consume('a', T0)).filter(
			(wait) => wait === 0
		);
		expect(allowed).toHaveLength(10);
	});

	it('tracks clients independently', () => {
		const limiter = createAttemptLimiter(1, WINDOW);
		limiter.consume('a', T0);
		expect(limiter.consume('a', T0)).toBeGreaterThan(0);
		expect(limiter.consume('b', T0)).toBe(0);
	});

	it('starts a fresh window after the previous one expires', () => {
		const limiter = createAttemptLimiter(2, WINDOW);
		limiter.consume('a', T0);
		limiter.consume('a', T0 + 1);
		expect(limiter.consume('a', T0 + WINDOW + 1)).toBe(0);
		expect(limiter.consume('a', T0 + WINDOW + 2)).toBe(0);
		expect(limiter.consume('a', T0 + WINDOW + 3)).toBeGreaterThan(0);
	});

	it('clears a client on reset', () => {
		const limiter = createAttemptLimiter(1, WINDOW);
		limiter.consume('a', T0);
		limiter.reset('a');
		expect(limiter.consume('a', T0)).toBe(0);
	});

	it('is disabled when maxAttempts is 0', () => {
		const limiter = createAttemptLimiter(0, WINDOW);
		for (let i = 0; i < 100; i++) expect(limiter.consume('a', T0)).toBe(0);
	});

	it('stays fast with many distinct clients inside one window', () => {
		const limiter = createAttemptLimiter(1, WINDOW);
		const start = performance.now();

		// Before the fix, every insert past 1,000 entries rescanned the whole map.
		for (let i = 0; i < 50_000; i++) limiter.consume(`client-${i}`, T0 + i / 1000);

		expect(performance.now() - start).toBeLessThan(500);
	});

	it('evicts the oldest client once the tracking cap is reached', () => {
		const limiter = createAttemptLimiter(1, WINDOW);
		limiter.consume('first', T0);
		for (let i = 0; i < 10_000; i++) limiter.consume(`client-${i}`, T0);

		// 'first' was evicted to make room, so it starts over; a recent client is still locked.
		expect(limiter.consume('first', T0)).toBe(0);
		expect(limiter.consume('client-9999', T0)).toBeGreaterThan(0);
	});
});
