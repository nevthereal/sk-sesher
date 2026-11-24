import type { SessionInternals } from './handler.js';
import { createSignedSessionValue, delay, timingSafeEqual } from './session.js';

export type SignInResult =
	| { ok: true; sessionValue: string }
	| { ok: false; reason: 'not-configured' }
	| { ok: false; reason: 'locked'; retryAfterMs: number }
	| { ok: false; reason: 'wrong-password' };

/**
 * Checks a sign-in attempt and, on success, returns a new signed session value.
 * Kept free of SvelteKit request APIs so it can be tested directly.
 */
export async function attemptSignIn(
	{ config, getPassword, limiter }: SessionInternals,
	clientKey: string,
	password: string
): Promise<SignInResult> {
	const expectedPassword = getPassword();
	if (!expectedPassword) return { ok: false, reason: 'not-configured' };

	// Reserve the attempt before any `await`, so parallel requests can't overshoot the limit.
	const retryAfterMs = limiter.consume(clientKey);

	if (retryAfterMs > 0) {
		await delay(config.failureDelayMs);
		return { ok: false, reason: 'locked', retryAfterMs };
	}

	if (!(await timingSafeEqual(password, expectedPassword))) {
		await delay(config.failureDelayMs);
		return { ok: false, reason: 'wrong-password' };
	}

	limiter.reset(clientKey);

	return { ok: true, sessionValue: await createSignedSessionValue(expectedPassword) };
}
