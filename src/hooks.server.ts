import { SESSION_PASSWORD } from '$app/env/private';
import { handleSession } from '#lib/index.js';

export const handle = handleSession({ password: () => SESSION_PASSWORD });
