import { describe, expect, it } from 'vitest';
import { createAttemptLimiter } from './rate-limit.js';

const WINDOW = 60_000;
const T0 = 1_000_000;

describe('createAttemptLimiter', () => {
	it('allows attempts below the limit', () => {
		const limiter = createAttemptLimiter(3, WINDOW);
		limiter.recordFailure('a', T0);
		limiter.recordFailure('a', T0 + 1);
		expect(limiter.lockedFor('a', T0 + 2)).toBe(0);
	});

	it('locks a client once the limit is reached, until the window ends', () => {
		const limiter = createAttemptLimiter(3, WINDOW);
		for (let i = 0; i < 3; i++) limiter.recordFailure('a', T0 + i);

		expect(limiter.lockedFor('a', T0 + 10)).toBe(WINDOW - 10);
		expect(limiter.lockedFor('a', T0 + WINDOW - 1)).toBe(1);
		expect(limiter.lockedFor('a', T0 + WINDOW)).toBe(0);
	});

	it('tracks clients independently', () => {
		const limiter = createAttemptLimiter(1, WINDOW);
		limiter.recordFailure('a', T0);
		expect(limiter.lockedFor('a', T0)).toBeGreaterThan(0);
		expect(limiter.lockedFor('b', T0)).toBe(0);
	});

	it('starts a fresh window after the previous one expires', () => {
		const limiter = createAttemptLimiter(2, WINDOW);
		limiter.recordFailure('a', T0);
		limiter.recordFailure('a', T0 + WINDOW + 1);
		expect(limiter.lockedFor('a', T0 + WINDOW + 2)).toBe(0);
	});

	it('clears a client on reset', () => {
		const limiter = createAttemptLimiter(1, WINDOW);
		limiter.recordFailure('a', T0);
		limiter.reset('a');
		expect(limiter.lockedFor('a', T0)).toBe(0);
	});

	it('is disabled when maxAttempts is 0', () => {
		const limiter = createAttemptLimiter(0, WINDOW);
		for (let i = 0; i < 100; i++) limiter.recordFailure('a', T0);
		expect(limiter.lockedFor('a', T0)).toBe(0);
	});

	it('prunes expired clients instead of growing without bound', () => {
		const limiter = createAttemptLimiter(1, WINDOW);
		for (let i = 0; i < 1_000; i++) limiter.recordFailure(`old-${i}`, T0);

		// Every old entry has expired by now; this insert should prune them.
		limiter.recordFailure('new', T0 + WINDOW);
		expect(limiter.lockedFor('old-0', T0)).toBe(0);
		expect(limiter.lockedFor('new', T0 + WINDOW)).toBeGreaterThan(0);
	});
});
