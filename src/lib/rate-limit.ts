interface AttemptRecord {
	count: number;
	windowStart: number;
}

/** Hard cap on tracked clients; the oldest entry is evicted beyond this. */
const MAX_TRACKED_CLIENTS = 10_000;

export interface AttemptLimiter {
	/**
	 * Reserves an attempt for `key`. Returns `0` if the attempt may proceed (and
	 * counts it), or the milliseconds until `key` may try again.
	 *
	 * This is synchronous so the check and the reservation can't be split by an
	 * `await`: concurrent requests from one client can never exceed the limit.
	 */
	consume(key: string, now?: number): number;
	/** Forgets `key`, e.g. after a successful sign-in. */
	reset(key: string): void;
}

/**
 * A fixed-window, in-memory limiter for sign-in attempts.
 *
 * Each client may make `maxAttempts` attempts per `windowMs`, counted from its
 * first attempt in the window. Callers `reset` on success, so in practice only
 * failures accumulate. `maxAttempts <= 0` disables it.
 *
 * State lives in the server process, so it is not shared between instances
 * (e.g. separate serverless invocations) and resets on restart.
 */
export function createAttemptLimiter(maxAttempts: number, windowMs: number): AttemptLimiter {
	const attempts = new Map<string, AttemptRecord>();
	let lastPrune = -Infinity;

	// Runs at most once per window, so each call is amortised O(1).
	function pruneExpired(now: number) {
		if (now - lastPrune < windowMs) return;
		lastPrune = now;

		for (const [key, record] of attempts) {
			if (now - record.windowStart >= windowMs) attempts.delete(key);
		}
	}

	return {
		consume(key, now = Date.now()) {
			if (maxAttempts <= 0) return 0;

			pruneExpired(now);

			const record = attempts.get(key);

			if (record && now - record.windowStart < windowMs) {
				if (record.count >= maxAttempts) return record.windowStart + windowMs - now;
				record.count++;
				return 0;
			}

			// New window: re-insert so Map order stays oldest-first for eviction.
			attempts.delete(key);
			if (attempts.size >= MAX_TRACKED_CLIENTS) {
				const oldest = attempts.keys().next().value;
				if (oldest !== undefined) attempts.delete(oldest);
			}
			attempts.set(key, { count: 1, windowStart: now });
			return 0;
		},

		reset(key) {
			attempts.delete(key);
		}
	};
}
