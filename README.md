# sk-sesher

A simple, password-based session management library for SvelteKit personal projects.

Uses SvelteKit's experimental [remote functions](https://svelte.dev/docs/kit/remote-functions) for type-safe client-server communication with progressive enhancement.

## Features

- A single shared password, read from wherever you keep secrets
- Progressive enhancement with form-based sign in (works without JavaScript)
- Signed, `httpOnly` session cookies that expire server-side
- Built-in throttling of failed sign-in attempts
- Full TypeScript support

## Requirements

- SvelteKit `^2.49.0` or `^3.0.0` (this library only works with SvelteKit!)
- Svelte `^5.46.0`

## Installation

```bash
npm install sk-sesher
```

## Quick Start

The examples below use SvelteKit 3. Where SvelteKit 2 differs, the difference is shown right after.

### 1. Enable Remote Functions

```js
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: { experimental: { async: true } },
			experimental: { remoteFunctions: true }
		})
	]
});
```

<details>
<summary>SvelteKit 2</summary>

```js
// svelte.config.js
export default {
	kit: {
		experimental: {
			remoteFunctions: true
		}
	}
};
```

</details>

### 2. Set the Password

Add the password to `.env` (or your host's environment settings):

```bash
SESSION_PASSWORD=your-secret-password
```

On SvelteKit 3, declare it in `src/env.ts` so it can be imported from `$app/env/private`:

```ts
// src/env.ts
import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	SESSION_PASSWORD: {}
});
```

SvelteKit 2 needs no extra step.

### 3. Add the Hook

Create or update `src/hooks.server.ts`:

```ts
import { SESSION_PASSWORD } from '$app/env/private';
import { handleSession } from 'sk-sesher';

export const handle = handleSession({ password: () => SESSION_PASSWORD });
```

<details>
<summary>SvelteKit 2</summary>

```ts
import { env } from '$env/dynamic/private';
import { handleSession } from 'sk-sesher';

export const handle = handleSession({ password: () => env.SESSION_PASSWORD });
```

</details>

The password is also the key used to sign session cookies, so changing it signs everyone out.

### 4. Configure Types

Update your `src/app.d.ts`:

```ts
import type { SessionLocals } from 'sk-sesher';

declare global {
	namespace App {
		interface Locals extends SessionLocals {}
	}
}

export {};
```

### 5. Pass Session to Client

Create `src/routes/+layout.server.ts`:

```ts
export const load = ({ locals }) => {
	return {
		session: locals.session
	};
};
```

### 6. Re-export the Remote Functions From Your `lib` Folder

SvelteKit only serves remote functions from your own `.remote.ts` files, so re-export them:

```ts
// src/lib/remote/auth.remote.ts
export { signIn, signOut } from 'sk-sesher/auth/remote';
```

### 7. Create Layout with Auth Check

Create `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
	import { signIn, signOut } from '#lib/remote/auth.remote.js';
	import { refreshAll } from '$app/navigation';

	let { data, children } = $props();

	async function handleSignOut() {
		await signOut();
		await refreshAll();
	}
</script>

{#if data.session.isAuthenticated}
	<button onclick={handleSignOut}>Sign Out</button>
	{@render children()}
{:else}
	<form {...signIn}>
		<label>
			Password
			<input {...signIn.fields._password.as('password')} />
		</label>

		{#each signIn.fields._password.issues() as issue (issue)}
			<p class="error">{issue.message}</p>
		{/each}

		<button disabled={!!signIn.pending}>
			{signIn.pending ? 'Signing in...' : 'Sign In'}
		</button>
	</form>
{/if}
```

On SvelteKit 2, import from `$lib/remote/auth.remote.js` and use `invalidateAll` instead of `refreshAll`.

That's it! Your app now has password protection.

## Configuration

```ts
import { SESSION_PASSWORD } from '$app/env/private';
import { handleSession } from 'sk-sesher';

export const handle = handleSession({
	password: () => SESSION_PASSWORD,
	cookieName: 'auth',
	maxAge: 60 * 60 * 24
});
```

| Option                  | Default           | Description                                                                                    |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `password`              | _required_        | The shared password, or a function returning it. If it's empty, everyone is signed out.        |
| `cookieName`            | `'session'`       | Name of the session cookie.                                                                    |
| `maxAge`                | `604800` (7 days) | Session lifetime in seconds. Sets the cookie's `Max-Age` and is also enforced on the server.   |
| `failureDelayMs`        | `500`             | Delay before answering a failed sign-in attempt.                                               |
| `maxFailedAttempts`     | `10`              | Failed attempts allowed per client within `failedAttemptWindowMs`. `0` disables the limit.     |
| `failedAttemptWindowMs` | `900000` (15 min) | Window over which failed attempts are counted. A locked-out client can try again when it ends. |

### Using with Other Hooks

```ts
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(
	handleSession({ password: () => SESSION_PASSWORD })
	// your other hooks...
);
```

## Remote Functions

This library provides two remote functions. Remember to re-export them from _your own `src/lib` folder_ and to enable the experimental flag, or they won't work.

### `signIn` (form)

A [remote form](https://svelte.dev/docs/kit/remote-functions#form) that checks the password, with progressive enhancement.

- Spread `{...signIn}` onto your `<form>` element
- Use `signIn.fields._password.as('password')` to get the input attributes
- Validation errors, a wrong password and a lockout after too many attempts all appear in `signIn.fields._password.issues()`
- Check `signIn.pending` to show loading state

> **Note:** The password field is named `_password` (with underscore) so SvelteKit doesn't send it back to the client on validation errors, as per its [sensitive data handling](https://svelte.dev/docs/kit/remote-functions#form-Handling-sensitive-data).

### `signOut` (command)

A [remote command](https://svelte.dev/docs/kit/remote-functions#command) that clears the session cookie. Call `refreshAll()` (or `invalidateAll()` on SvelteKit 2) afterwards so the page reflects the signed-out state.

## API Reference

### Exports from `sk-sesher`

| Export          | Type                 | Description                                         |
| --------------- | -------------------- | --------------------------------------------------- |
| `handleSession` | `(config) => Handle` | Creates the session management hook                 |
| `SessionConfig` | `type`               | Configuration options type                          |
| `Session`       | `type`               | Session state type (`{ isAuthenticated: boolean }`) |
| `SessionLocals` | `type`               | Type to extend `App.Locals`                         |
| `SessionHandle` | `type`               | The hook type returned by `handleSession`           |

### Exports from `sk-sesher/auth/remote`

| Export    | Type            | Description                                     |
| --------- | --------------- | ----------------------------------------------- |
| `signIn`  | `RemoteForm`    | Form-based sign in with progressive enhancement |
| `signOut` | `RemoteCommand` | Signs out and clears the session cookie         |

## Upgrading from 0.0.x

- **Upgrade promptly:** in 0.0.x, setting a `session=authenticated` cookie by hand bypassed the password. 0.1.0 only accepts cookies the server has signed.
- `handleSession()` now requires a `password` option, and the `envKey` option has been removed. Replace `handleSession()` with `handleSession({ password: () => env.SESSION_PASSWORD })` (SvelteKit 2) or the SvelteKit 3 form shown above.
- Existing sessions are invalidated, so everyone needs to sign in again once.
- A wrong password is now reported through `signIn.fields._password.issues()` instead of `signIn.result?.error`.

## Security Notes

- The password stays on the server and is never sent to the client.
- Session cookies are HMAC-SHA256 signed with the password, and tampered or forged cookies are rejected.
- Sessions expire on the server after `maxAge`, so a copied cookie stops working even if the browser keeps sending it.
- Cookies are `httpOnly` and `sameSite: 'lax'`. They are also `secure` everywhere except `http://localhost` during development (SvelteKit's default).
- Passwords are compared in constant time.
- Failed attempts are slowed by `failureDelayMs` and capped per client IP by `maxFailedAttempts`. The counter is kept **in memory**, so:
  - it resets when the server restarts and isn't shared between instances (for example, separate serverless functions);
  - behind a reverse proxy, configure your adapter to read the real client IP (e.g. `ADDRESS_HEADER` for `adapter-node`). Otherwise every visitor shares one counter and a lockout affects everyone.
- Use a long, random password. Throttling slows guessing but can't make a weak password safe.
- This is designed for **personal projects** with a single shared password, not multi-user authentication.

## License

MIT
