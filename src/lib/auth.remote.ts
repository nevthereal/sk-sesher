import { command, form, getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { error, invalid } from '@sveltejs/kit';
import * as v from 'valibot';
import { getSessionConfig } from './handler.js';

/**
 * Form-based sign in. Spread this onto a `<form>` element for progressive enhancement.
 *
 * @example
 * ```svelte
 * <script>
 *   import { signIn } from 'sk-sesher/auth.remote';
 * </script>
 *
 * <form {...signIn}>
 *   <input {...signIn.fields._password.as('password')} placeholder="Password" />
 *   {#each signIn.fields._password.issues() as issue}
 *     <p class="error">{issue.message}</p>
 *   {/each}
 *   <button>Sign In</button>
 * </form>
 *
 * {#if signIn.result?.error}
 *   <p class="error">{signIn.result.error}</p>
 * {/if}
 * ```
 */
export const signIn = form(
	v.object({
		_password: v.pipe(v.string(), v.nonEmpty('Password is required'))
	}),
	async ({ _password }, issue) => {
		const event = getRequestEvent();
		const config = getSessionConfig(event);

		const expectedPassword = env[config.envKey];

		if (!expectedPassword) {
			console.error(`[sk-sesher] Environment variable "${config.envKey}" is not set.`);
			error(500, 'Server configuration error');
		}

		if (_password !== expectedPassword) invalid(issue._password('Password is wrong'));

		event.cookies.set(config.cookieName, 'authenticated', {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: config.maxAge
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
 *   import { signOut } from 'sk-sesher/auth.remote';
 *
 *   async function handleSignOut() {
 *     await signOut();
 *     // Redirect or update UI
 *   }
 * </script>
 * ```
 */
export const signOut = command(async (): Promise<{ success: boolean }> => {
	const event = getRequestEvent();
	const config = getSessionConfig(event);

	event.cookies.delete(config.cookieName, {
		path: '/'
	});

	return { success: true };
});
