import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	SESSION_PASSWORD: {
		description: 'The shared password used to sign in to the demo app'
	}
});
