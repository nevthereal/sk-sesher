import type { SessionLocals } from '#lib/index.js';

declare global {
	namespace App {
		// interface Error {}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface Locals extends SessionLocals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
