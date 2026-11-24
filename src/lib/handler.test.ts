import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionInternals, handleSession, type SessionLocals } from './handler.js';
import { createSignedSessionValue } from './session.js';

const PASSWORD = 'hunter2';

function fakeEvent(cookies: Record<string, string> = {}) {
	return {
		cookies: { get: (name: string) => cookies[name] },
		locals: {}
	} as unknown as RequestEvent & { locals: SessionLocals };
}

async function run(handle: ReturnType<typeof handleSession>, event: RequestEvent) {
	await handle({ event, resolve: () => new Response('ok') });
	return event as RequestEvent & { locals: SessionLocals };
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('handleSession', () => {
	it('marks requests without a cookie as unauthenticated', async () => {
		const event = await run(handleSession({ password: PASSWORD }), fakeEvent());
		expect(event.locals.session).toEqual({ isAuthenticated: false });
	});

	it('authenticates a valid signed cookie', async () => {
		const cookie = await createSignedSessionValue(PASSWORD);
		const event = await run(handleSession({ password: PASSWORD }), fakeEvent({ session: cookie }));
		expect(event.locals.session.isAuthenticated).toBe(true);
	});

	it('rejects the unsigned cookie value used by 0.0.x', async () => {
		const event = await run(
			handleSession({ password: PASSWORD }),
			fakeEvent({ session: 'authenticated' })
		);
		expect(event.locals.session.isAuthenticated).toBe(false);
	});

	it('honours a custom cookie name', async () => {
		const cookie = await createSignedSessionValue(PASSWORD);
		const handle = handleSession({ password: PASSWORD, cookieName: 'auth' });

		expect((await run(handle, fakeEvent({ auth: cookie }))).locals.session.isAuthenticated).toBe(
			true
		);
		expect((await run(handle, fakeEvent({ session: cookie }))).locals.session.isAuthenticated).toBe(
			false
		);
	});

	it('expires sessions server-side after maxAge', async () => {
		vi.useFakeTimers({ now: Date.UTC(2026, 0, 1), toFake: ['Date'] });
		const cookie = await createSignedSessionValue(PASSWORD);
		const handle = handleSession({ password: PASSWORD, maxAge: 60 });

		vi.advanceTimersByTime(59_000);
		expect((await run(handle, fakeEvent({ session: cookie }))).locals.session.isAuthenticated).toBe(
			true
		);

		vi.advanceTimersByTime(2_000);
		expect((await run(handle, fakeEvent({ session: cookie }))).locals.session.isAuthenticated).toBe(
			false
		);
	});

	it('reads a password getter on every request, so rotating it signs everyone out', async () => {
		let current = PASSWORD;
		const cookie = await createSignedSessionValue(PASSWORD);
		const handle = handleSession({ password: () => current });

		expect((await run(handle, fakeEvent({ session: cookie }))).locals.session.isAuthenticated).toBe(
			true
		);

		current = 'rotated';
		expect((await run(handle, fakeEvent({ session: cookie }))).locals.session.isAuthenticated).toBe(
			false
		);
	});

	it('treats every request as unauthenticated and logs once when no password is set', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const handle = handleSession({ password: () => undefined });

		for (let i = 0; i < 3; i++) {
			const event = await run(handle, fakeEvent({ session: 'anything' }));
			expect(event.locals.session.isAuthenticated).toBe(false);
		}

		expect(log).toHaveBeenCalledTimes(1);
	});

	it('exposes resolved config to the remote functions', async () => {
		const event = await run(handleSession({ password: PASSWORD, maxAge: 120 }), fakeEvent());
		const { config, getPassword } = getSessionInternals(event);

		expect(config).toMatchObject({ cookieName: 'session', maxAge: 120, maxFailedAttempts: 10 });
		expect(getPassword()).toBe(PASSWORD);
	});
});

describe('getSessionInternals', () => {
	it('throws a helpful error when the hook is not installed', () => {
		expect(() => getSessionInternals(fakeEvent())).toThrow(/handleSession\(\) hook did not run/);
	});
});
