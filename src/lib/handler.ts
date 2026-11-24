import type { RequestEvent } from '@sveltejs/kit';
import { createAttemptLimiter, type AttemptLimiter } from './rate-limit.js';
import { verifySignedSessionValue } from './session.js';

export interface SessionConfig {
	/**
	 * The shared password, usually read from a private environment variable.
	 * Pass a function to read it lazily on each request.
	 *
	 * It is also the key used to sign session cookies, so changing it signs
	 * everyone out.
	 *
	 * @example
	 * ```ts
	 * // SvelteKit 3 (declare SESSION_PASSWORD in src/env.ts)
	 * import { SESSION_PASSWORD } from '$app/env/private';
	 * handleSession({ password: () => SESSION_PASSWORD });
	 *
	 * // SvelteKit 2
	 * import { env } from '$env/dynamic/private';
	 * handleSession({ password: () => env.SESSION_PASSWORD });
	 * ```
	 */
	password: string | (() => string | undefined);

	/**
	 * The name of the cookie that stores the session state.
	 * @default 'session'
	 */
	cookieName?: string;

	/**
	 * Session lifetime in seconds. Used for the cookie's `Max-Age` and enforced
	 * server-side when the cookie is verified.
	 * @default 60 * 60 * 24 * 7 (7 days)
	 */
	maxAge?: number;

	/**
	 * Delay in milliseconds before returning an invalid password response.
	 * @default 500
	 */
	failureDelayMs?: number;

	/**
	 * Number of failed sign-in attempts allowed per client within
	 * `failedAttemptWindowMs` before further attempts are rejected.
	 * Set to `0` to disable the limit.
	 * @default 10
	 */
	maxFailedAttempts?: number;

	/**
	 * Window in milliseconds over which failed attempts are counted. A locked-out
	 * client can try again once the window ends.
	 * @default 15 * 60 * 1000 (15 minutes)
	 */
	failedAttemptWindowMs?: number;
}

/**
 * A SvelteKit `handle` hook. Declared structurally (rather than importing `Handle`)
 * because Kit 2 exports it from `@sveltejs/kit` and Kit 3 from `@sveltejs/kit/hooks`.
 */
export type SessionHandle = (input: {
	event: RequestEvent;
	resolve: (event: RequestEvent) => Response | Promise<Response>;
}) => Promise<Response>;

export interface Session {
	isAuthenticated: boolean;
}

type ResolvedConfig = Required<Omit<SessionConfig, 'password'>>;

/** @internal */
export interface SessionInternals {
	config: ResolvedConfig;
	getPassword: () => string | undefined;
	limiter: AttemptLimiter;
}

export interface SessionLocals {
	session: Session;
	/** @internal */
	_sesher: SessionInternals;
}

const DEFAULT_CONFIG: ResolvedConfig = {
	cookieName: 'session',
	maxAge: 60 * 60 * 24 * 7, // 7 days
	failureDelayMs: 500,
	maxFailedAttempts: 10,
	failedAttemptWindowMs: 15 * 60 * 1000 // 15 minutes
};

/**
 * Creates a SvelteKit handle function that manages session state.
 *
 * @example
 * ```ts
 * // src/hooks.server.ts
 * import { handleSession } from 'sk-sesher';
 * import { SESSION_PASSWORD } from '$app/env/private';
 *
 * export const handle = handleSession({ password: () => SESSION_PASSWORD });
 * ```
 *
 * @example
 * ```ts
 * // With custom config
 * import { handleSession } from 'sk-sesher';
 * import { sequence } from '@sveltejs/kit/hooks';
 *
 * export const handle = sequence(
 *   handleSession({
 *     password: () => SESSION_PASSWORD,
 *     cookieName: 'auth',
 *     maxAge: 60 * 60 * 24 // 1 day
 *   }),
 *   // other handlers...
 * );
 * ```
 */
export function handleSession(config: SessionConfig): SessionHandle {
	const { password, ...options } = config;
	const getPassword = typeof password === 'function' ? password : () => password;
	let warnedMissingPassword = false;

	const internals: SessionInternals = {
		config: { ...DEFAULT_CONFIG, ...options },
		getPassword,
		limiter: createAttemptLimiter(
			config.maxFailedAttempts ?? DEFAULT_CONFIG.maxFailedAttempts,
			config.failedAttemptWindowMs ?? DEFAULT_CONFIG.failedAttemptWindowMs
		)
	};
	const { cookieName, maxAge } = internals.config;

	return async ({ event, resolve }) => {
		const expectedPassword = getPassword();

		if (!expectedPassword && !warnedMissingPassword) {
			warnedMissingPassword = true;
			console.error('[sk-sesher] No password configured; every request will be unauthenticated.');
		}

		const isAuthenticated = expectedPassword
			? await verifySignedSessionValue(expectedPassword, event.cookies.get(cookieName), maxAge)
			: false;

		// Type assertion needed since library users will augment App.Locals
		const locals = event.locals as unknown as SessionLocals;

		locals.session = { isAuthenticated };
		locals._sesher = internals;

		return resolve(event);
	};
}

/**
 * Reads the state set up by `handleSession`, failing loudly if the hook is missing.
 * @internal
 */
export function getSessionInternals(event: RequestEvent): SessionInternals {
	const internals = (event.locals as unknown as Partial<SessionLocals>)._sesher;

	if (!internals) {
		throw new Error(
			'[sk-sesher] The handleSession() hook did not run for this request. ' +
				'Add `export const handle = handleSession({ password: ... });` to src/hooks.server.ts ' +
				'(or include it in your `sequence(...)`).'
		);
	}

	return internals;
}
