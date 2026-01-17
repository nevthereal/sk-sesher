# sk-sesher

A simple, password-based session management library for SvelteKit personal projects.

Uses SvelteKit's experimental [remote functions](https://svelte.dev/docs/kit/remote-functions) for type-safe client-server communication with progressive enhancement.

## Features

- Password-based authentication via environment variable
- Progressive enhancement with form-based sign in
- Cookie-based session management
- Full TypeScript support
- Works without JavaScript (graceful degradation)

## Requirements

- SvelteKit `^2.49.0` (this library is only intended to use with SvelteKit!)
- Svelte `^5.46.0`

## Installation

```bash
npm install sk-sesher
```

## Quick Start

### 1. Enable Remote Functions

Add the experimental flag to your `svelte.config.js`:

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

### 2. Set Environment Variable

Create a `.env` file with your password:

```bash
SESSION_PASSWORD=your-secret-password
```

### 3. Configure Types

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

### 4. Add the Hook

Create or update `src/hooks.server.ts`:

```ts
import { handleSession } from 'sk-sesher';

export const handle = handleSession();
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

### 6. Re-export remote functions inside your `lib` folder

Make sure to export them from any file ending in `.remote.ts`.

```ts
// src/lib/remote/auth.remote.ts

export { signIn, signOut } from "sk-sesher/auth/remote"
```

### 7. Create Layout with Auth Check

Create `src/routes/+layout.svelte`:

```svelte
<script>
	import { signIn, signOut } from '$lib/remote/auth.remote.ts';
	import { invalidateAll } from '$app/navigation';

	let { data, children } = $props();
</script>

{#if data.session.isAuthenticated}
	<button onclick={() => signOut().then(() => invalidate())}>Sign Out</button>
	{@render children()}
{:else}
	<form {...signIn}>
		<label>
			Password
			<input {...signIn.fields._password.as('password')} />
		</label>

		{#each signIn.fields._password.issues() as issue}
			<p class="error">{issue.message}</p>
		{/each}

		<button disabled={!!signIn.pending}>
			{signIn.pending ? 'Signing in...' : 'Sign In'}
		</button>
	</form>
{/if}
```

That's it! Your app now has password protection.

## Configuration

### Custom Options

```ts
import { handleSession } from 'sk-sesher';

export const handle = handleSession({
	// Environment variable name for the password
	envKey: 'MY_SECRET_PASSWORD', // default: 'SESSION_PASSWORD'

	// Cookie name for the session
	cookieName: 'auth', // default: 'session'

	// Session duration in seconds
	maxAge: 60 * 60 * 24 // default: 7 days
});
```

### Using with Other Hooks

```ts
import { handleSession } from 'sk-sesher';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(
	handleSession()
	// your other hooks...
);
```

## Remote Functions

This library provides two remote functions for authentication:

### `signIn` (form)

A [remote form](https://svelte.dev/docs/kit/remote-functions#form) that handles password authentication with progressive enhancement.

```svelte
<script>
	import { signIn } from 'sk-sesher/auth/remote';
	import { invalidateAll } from '$app/navigation';

	// Use enhance for progressive enhancement
	const enhanced = signIn.enhance(async ({ submit }) => {
		await submit();
		if (signIn.result?.success) {
			await invalidateAll();
		}
	});
</script>

<form {...enhanced}>
	<label>
		Password
		<input {...signIn.fields._password.as('password')} />
	</label>

	<!-- Validation errors -->
	{#each signIn.fields._password.issues() as issue}
		<p class="error">{issue.message}</p>
	{/each}

	<!-- Server-side errors (wrong password) -->
	{#if signIn.result?.error}
		<p class="error">{signIn.result.error}</p>
	{/if}

	<button disabled={!!signIn.pending}>
		{signIn.pending ? 'Signing in...' : 'Sign In'}
	</button>
</form>
```

**Key features:**

- Spread `{...enhanced}` onto your `<form>` element for progressive enhancement
- Use `signIn.fields._password.as('password')` to get the input attributes
- Access validation issues via `signIn.fields._password.issues()`
- Check `signIn.result?.error` for server-side errors (e.g., wrong password)
- Check `signIn.pending` to show loading state

> **Note:** The password field is named `_password` (with underscore) to prevent it from being sent back to the client on validation errors, as per SvelteKit's [sensitive data handling](https://svelte.dev/docs/kit/remote-functions#form-Handling-sensitive-data).

### `signOut` (command)

A [remote command](https://svelte.dev/docs/kit/remote-functions#command) that clears the session cookie.

```svelte
<script>
	import { signOut } from 'sk-sesher/auth/remote';
	import { invalidateAll } from '$app/navigation';

	async function handleSignOut() {
		await signOut();
		await invalidateAll(); // Refresh page data to reflect logged-out state
	}
</script>

<button onclick={handleSignOut}>Sign Out</button>
```

## API Reference

### Exports from `sk-sesher`

| Export          | Type                  | Description                                         |
| --------------- | --------------------- | --------------------------------------------------- |
| `handleSession` | `(config?) => Handle` | Creates the session management hook                 |
| `SessionConfig` | `type`                | Configuration options type                          |
| `Session`       | `type`                | Session state type (`{ isAuthenticated: boolean }`) |
| `SessionLocals` | `type`                | Type to extend `App.Locals`                         |

### Exports from `sk-sesher/auth/remote`

| Export    | Type            | Description                                     |
| --------- | --------------- | ----------------------------------------------- |
| `signIn`  | `RemoteForm`    | Form-based sign in with progressive enhancement |
| `signOut` | `RemoteCommand` | Signs out and clears the session cookie         |

## How It Works

1. **`handleSession`** hook runs on every request, reading the session cookie and populating `locals.session`
2. **`signIn`** is a remote form function that validates the password against the environment variable and sets a secure cookie
3. **`signOut`** is a remote command that clears the session cookie
4. The layout passes session state to the client and conditionally renders content

## Security Notes

- The password is stored as an environment variable and never exposed to the client
- Session cookies are `httpOnly`, `secure`, and use `sameSite: 'lax'`
- The password field uses an underscore prefix (`_password`) to prevent it from being echoed back on form errors
- This is designed for **personal projects** with a single shared password, not multi-user authentication

## License

MIT
