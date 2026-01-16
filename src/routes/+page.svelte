<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>sk-sesher Demo</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">Welcome to sk-sesher</h1>
<p class="text-gray-700">This is a simple session management library for SvelteKit.</p>

<section class="my-8">
	<h2 class="mb-3 text-xl font-semibold">Session Info</h2>
	<pre class="overflow-x-auto rounded bg-gray-100 p-4">{JSON.stringify(data.session, null, 2)}</pre>
</section>

<section class="my-8">
	<h2 class="mb-3 text-xl font-semibold">How it works</h2>
	<ol class="list-decimal space-y-2 pl-6">
		<li>
			The <code class="rounded bg-gray-200 px-1.5 py-0.5 text-sm">handleSession</code> hook reads the
			session cookie on each request
		</li>
		<li>
			Session state is passed to <code class="rounded bg-gray-200 px-1.5 py-0.5 text-sm"
				>locals.session</code
			>
		</li>
		<li>The layout server load function passes it to the client</li>
		<li>The layout conditionally renders based on authentication state</li>
	</ol>
</section>
