import type { Handle, RequestEvent } from '@sveltejs/kit';

export interface SessionConfig {
	/**
	 * The name of the environment variable that contains the password.
	 * @default 'SESSION_PASSWORD'
	 */
	envKey?: string;

	/**
	 * The name of the cookie that stores the session state.
	 * @default 'session'
	 */
	cookieName?: string;

	/**
	 * Cookie max age in seconds.
	 * @default 60 * 60 * 24 * 7 (7 days)
	 */
	maxAge?: number;
}

export interface Session {
	isAuthenticated: boolean;
}

export interface SessionLocals {
	session: Session;
	/** @internal */
	_sessionConfig: Required<SessionConfig>;
}

const DEFAULT_CONFIG: Required<SessionConfig> = {
	envKey: 'SESSION_PASSWORD',
	cookieName: 'session',
	maxAge: 60 * 60 * 24 * 7 // 7 days
};

/**
 * Creates a SvelteKit handle function that manages session state.
 *
 * @example
 * ```ts
 * // src/hooks.server.ts
 * import { handleSession } from 'sk-sesher';
 *
 * export const handle = handleSession();
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
 *     envKey: 'MY_SECRET_PASSWORD',
 *     cookieName: 'auth',
 *     maxAge: 60 * 60 * 24 // 1 day
 *   }),
 *   // other handlers...
 * );
 * ```
 */
export function handleSession(config: SessionConfig = {}): Handle {
	const { envKey, cookieName, maxAge } = { ...DEFAULT_CONFIG, ...config };

	return async ({ event, resolve }) => {
		const sessionCookie = event.cookies.get(cookieName);
		const isAuthenticated = sessionCookie === 'authenticated';

		// Type assertion needed since library users will augment App.Locals
		const locals = event.locals as unknown as SessionLocals;

		locals.session = {
			isAuthenticated
		};

		// Store config in locals for use by signIn/signOut
		locals._sessionConfig = {
			envKey,
			cookieName,
			maxAge
		};

		return resolve(event);
	};
}

/**
 * Helper to get session config from event locals.
 * @internal
 */
export function getSessionConfig(event: RequestEvent): Required<SessionConfig> {
	const locals = event.locals as unknown as SessionLocals;
	return locals._sessionConfig ?? DEFAULT_CONFIG;
}
