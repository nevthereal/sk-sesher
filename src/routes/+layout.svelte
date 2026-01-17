<script>
	import { signIn, signOut } from '$lib/auth.remote.ts';
	import { invalidateAll } from '$app/navigation';

	let { data, children } = $props();
</script>

{#if data.session.isAuthenticated}
	<button onclick={() => signOut().then(() => invalidateAll())}>Sign Out</button>
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
