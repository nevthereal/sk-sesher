import type { SessionLocals } from '$lib/index.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals extends SessionLocals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
