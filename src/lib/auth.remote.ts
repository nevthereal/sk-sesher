import { command, form, getRequestEvent } from '$app/server';
import { error, invalid, type RequestEvent } from '@sveltejs/kit';
import * as v from 'valibot';
import { getSessionInternals } from './handler.js';
import { attemptSignIn } from './sign-in.js';

function getClientKey(event: RequestEvent): string {
	try {
		return event.getClientAddress();
	} catch {
		// Some adapters can't determine the client address; fall back to one shared bucket.
		return 'unknown';
	}
}

/**
 * Form-based sign in. Spread this onto a `<form>` element for progressive enhancement.
 *
 * A wrong password, or too many failed attempts, is reported as an issue on
 * the `_password` field.
 *
 * @example
 * ```svelte
 * <script>
 *   import { signIn } from '$lib/remote/auth.remote.js';
 * </script>
 *
 * <form {...signIn}>
 *   <input {...signIn.fields._password.as('password')} placeholder="Password" />
 *   {#each signIn.fields._password.issues() as issue}
 *     <p class="error">{issue.message}</p>
 *   {/each}
 *   <button>Sign In</button>
 * </form>
 * ```
 */
export const signIn = form(
	v.object({
		_password: v.pipe(v.string(), v.nonEmpty('Password is required'))
	}),
	async ({ _password }, issue) => {
		const event = getRequestEvent();
		const internals = getSessionInternals(event);
		const result = await attemptSignIn(internals, getClientKey(event), _password);

		if (!result.ok) {
			switch (result.reason) {
				case 'not-configured':
					console.error('[sk-sesher] No password configured; sign-in is unavailable.');
					error(500, 'Server configuration error');
					break;
				case 'locked': {
					const minutes = Math.ceil(result.retryAfterMs / 60_000);
					invalid(
						issue._password(
							`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
						)
					);
					break;
				}
				case 'wrong-password':
					invalid(issue._password('Password is wrong'));
			}
		}

		// `secure` is left to SvelteKit's default: on everywhere except http://localhost and dev.
		event.cookies.set(internals.config.cookieName, result.sessionValue, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: internals.config.maxAge
		});

		return { success: true };
	}
);

/**
 * Signs out the user by clearing the session cookie.
 *
 * @example
 * ```svelte
 * <script>
 *   import { signOut } from '$lib/remote/auth.remote.js';
 *   import { invalidateAll } from '$app/navigation';
 *
 *   async function handleSignOut() {
 *     await signOut();
 *     await invalidateAll();
 *   }
 * </script>
 * ```
 */
export const signOut = command(async (): Promise<{ success: boolean }> => {
	const event = getRequestEvent();
	const { config } = getSessionInternals(event);

	event.cookies.delete(config.cookieName, { path: '/' });

	return { success: true };
});
