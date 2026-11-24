interface AttemptRecord {
	count: number;
	windowStart: number;
}

/** Prune expired entries once the map grows past this many clients. */
const PRUNE_THRESHOLD = 1_000;

export interface AttemptLimiter {
	/** Milliseconds until `key` may try again, or `0` if it is not locked out. */
	lockedFor(key: string, now?: number): number;
	recordFailure(key: string, now?: number): void;
	reset(key: string): void;
}

/**
 * A fixed-window, in-memory limiter for failed sign-in attempts.
 *
 * After `maxAttempts` failures within `windowMs`, the key is locked until the
 * window that started with its first failure ends. `maxAttempts <= 0` disables it.
 *
 * State lives in the server process, so it is not shared between instances
 * (e.g. separate serverless invocations) and resets on restart.
 */
export function createAttemptLimiter(maxAttempts: number, windowMs: number): AttemptLimiter {
	const attempts = new Map<string, AttemptRecord>();

	function prune(now: number) {
		for (const [key, record] of attempts) {
			if (now - record.windowStart >= windowMs) attempts.delete(key);
		}
	}

	return {
		lockedFor(key, now = Date.now()) {
			if (maxAttempts <= 0) return 0;

			const record = attempts.get(key);
			if (!record) return 0;

			const remaining = record.windowStart + windowMs - now;

			if (remaining <= 0) {
				attempts.delete(key);
				return 0;
			}

			return record.count >= maxAttempts ? remaining : 0;
		},

		recordFailure(key, now = Date.now()) {
			if (maxAttempts <= 0) return;

			const record = attempts.get(key);

			if (!record || now - record.windowStart >= windowMs) {
				if (attempts.size >= PRUNE_THRESHOLD) prune(now);
				attempts.set(key, { count: 1, windowStart: now });
			} else {
				record.count++;
			}
		},

		reset(key) {
			attempts.delete(key);
		}
	};
}
