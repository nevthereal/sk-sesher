import { describe, expect, it } from 'vitest';
import type { SessionInternals } from './handler.js';
import { createAttemptLimiter } from './rate-limit.js';
import { verifySignedSessionValue } from './session.js';
import { attemptSignIn } from './sign-in.js';

const PASSWORD = 'correct horse battery staple';

function internals(password: string | undefined = PASSWORD, maxFailedAttempts = 3) {
	return {
		config: {
			cookieName: 'session',
			maxAge: 3600,
			failureDelayMs: 0,
			maxFailedAttempts,
			failedAttemptWindowMs: 60_000
		},
		getPassword: () => password,
		limiter: createAttemptLimiter(maxFailedAttempts, 60_000)
	} satisfies SessionInternals;
}

describe('attemptSignIn', () => {
	it('returns a valid signed session for the right password', async () => {
		const result = await attemptSignIn(internals(), 'ip', PASSWORD);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(await verifySignedSessionValue(PASSWORD, result.sessionValue, 3600)).toBe(true);
		}
	});

	it('rejects a wrong password', async () => {
		expect(await attemptSignIn(internals(), 'ip', 'nope')).toEqual({
			ok: false,
			reason: 'wrong-password'
		});
	});

	it('refuses to sign in when no password is configured', async () => {
		expect(await attemptSignIn(internals(''), 'ip', '')).toEqual({
			ok: false,
			reason: 'not-configured'
		});
	});

	it('locks a client out after too many failures, even with the right password', async () => {
		const state = internals();
		for (let i = 0; i < 3; i++) await attemptSignIn(state, 'ip', 'nope');

		const result = await attemptSignIn(state, 'ip', PASSWORD);
		expect(result).toMatchObject({ ok: false, reason: 'locked' });
	});

	it('clears the failure count after a successful sign-in', async () => {
		const state = internals();
		await attemptSignIn(state, 'ip', 'nope');
		await attemptSignIn(state, 'ip', 'nope');
		expect((await attemptSignIn(state, 'ip', PASSWORD)).ok).toBe(true);

		// The counter restarted, so three more tries are allowed.
		for (let i = 0; i < 2; i++) await attemptSignIn(state, 'ip', 'nope');
		expect((await attemptSignIn(state, 'ip', PASSWORD)).ok).toBe(true);
	});

	it('does not let concurrent guesses from one client exceed the limit', async () => {
		const state = internals(PASSWORD, 3);

		const results = await Promise.all(
			Array.from({ length: 20 }, (_, i) => attemptSignIn(state, 'ip', `guess-${i}`))
		);

		const checked = results.filter((r) => !r.ok && r.reason === 'wrong-password');
		const locked = results.filter((r) => !r.ok && r.reason === 'locked');

		expect(checked).toHaveLength(3);
		expect(locked).toHaveLength(17);
	});
});
