<script lang="ts">
	import './layout.css';
	import { signOut } from '$lib/auth.remote.js';
	import { invalidateAll } from '$app/navigation';
	import SignIn from '$lib/SignIn.svelte';

	let { data, children } = $props();

	async function handleSignOut() {
		await signOut();
		await invalidateAll();
	}
</script>

{#if data.session.isAuthenticated}
	<header class="flex items-center justify-between border-b border-gray-300 bg-gray-100 px-8 py-4">
		<span class="font-medium">You are signed in</span>
		<button
			onclick={handleSignOut}
			class="cursor-pointer rounded border-none bg-gray-800 px-4 py-2 text-white hover:bg-gray-600"
		>
			Sign Out
		</button>
	</header>
	<main class="p-8">
		{@render children()}
	</main>
{:else}
	<SignIn />
{/if}
