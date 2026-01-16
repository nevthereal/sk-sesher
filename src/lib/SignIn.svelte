<script lang="ts">
	import { signIn } from './auth.remote.js';
	import { invalidateAll } from '$app/navigation';

	const enhanced = signIn.enhance(async ({ submit }) => {
		await submit();
		if (signIn.result?.success) {
			await invalidateAll();
		}
	});
</script>

<div
	class="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100"
>
	<div class="w-full max-w-sm">
		<div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
			<div class="mb-8 text-center">
				<div
					class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-7 w-7 text-white"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
						/>
					</svg>
				</div>
				<h1 class="text-2xl font-bold text-slate-800">Welcome back</h1>
				<p class="mt-1 text-sm text-slate-500">Enter your password to continue</p>
			</div>

			<form {...enhanced} class="flex flex-col gap-5">
				<div>
					<label for="password" class="mb-2 block text-sm font-medium text-slate-700">
						Password
					</label>
					<input
						{...signIn.fields._password.as('password')}
						id="password"
						placeholder="Enter your password"
						class="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
					/>
				</div>

				{#each signIn.fields._password.issues() as issue}
					<div class="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						{issue.message}
					</div>
				{/each}

				{#if signIn.result?.error}
					<div class="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						{signIn.result.error}
					</div>
				{/if}

				<button
					type="submit"
					disabled={!!signIn.pending}
					class="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-blue-500 to-blue-600 px-4 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-blue-500/40 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
				>
					{#if signIn.pending}
						<svg
							class="h-5 w-5 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Signing in...
					{:else}
						Sign In
					{/if}
				</button>
			</form>
		</div>

		<p class="mt-6 text-center text-xs text-slate-400">Protected by sk-sesher</p>
	</div>
</div>
