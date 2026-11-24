const encoder = new TextEncoder();

/** Tolerated clock skew for cookies issued "in the future" (e.g. across server instances). */
const MAX_CLOCK_SKEW_MS = 60_000;

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array | null {
	if (hex.length === 0 || hex.length % 2 !== 0 || /[^a-f0-9]/i.test(hex)) return null;

	const bytes = new Uint8Array(hex.length / 2);

	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
	}

	return bytes;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

/**
 * Creates a session cookie value of the form `<issuedAt>.<nonce>.<signature>`,
 * where the signature is an HMAC-SHA256 of `<issuedAt>.<nonce>` keyed by `secret`.
 */
export async function createSignedSessionValue(
	secret: string,
	now: number = Date.now()
): Promise<string> {
	const payload = `${now.toString(36)}.${crypto.randomUUID().replaceAll('-', '')}`;
	const key = await importSigningKey(secret);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

	return `${payload}.${bytesToHex(new Uint8Array(signature))}`;
}

/**
 * Returns `true` only if the cookie was signed with `secret` and was issued
 * no more than `maxAgeSeconds` ago. The age check is enforced server-side, so a
 * copied cookie stops working once it expires even if the client keeps sending it.
 */
export async function verifySignedSessionValue(
	secret: string,
	cookieValue: string | undefined,
	maxAgeSeconds: number,
	now: number = Date.now()
): Promise<boolean> {
	if (!cookieValue) return false;

	const lastSeparator = cookieValue.lastIndexOf('.');
	if (lastSeparator <= 0 || lastSeparator === cookieValue.length - 1) return false;

	const payload = cookieValue.slice(0, lastSeparator);
	const signature = hexToBytes(cookieValue.slice(lastSeparator + 1));

	if (!signature) return false;

	const key = await importSigningKey(secret);
	const valid = await crypto.subtle.verify(
		'HMAC',
		key,
		signature as BufferSource,
		encoder.encode(payload)
	);

	if (!valid) return false;

	const issuedAtPart = payload.slice(0, payload.indexOf('.'));
	if (!/^[0-9a-z]+$/.test(issuedAtPart)) return false;

	const issuedAt = Number.parseInt(issuedAtPart, 36);
	if (!Number.isSafeInteger(issuedAt)) return false;
	if (issuedAt > now + MAX_CLOCK_SKEW_MS) return false;

	return now - issuedAt <= maxAgeSeconds * 1000;
}

/**
 * Compares two strings without leaking where they differ through timing.
 * Both sides are hashed first so the comparison runs over fixed-length input.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
	const [hashA, hashB] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(a)),
		crypto.subtle.digest('SHA-256', encoder.encode(b))
	]);

	const bytesA = new Uint8Array(hashA);
	const bytesB = new Uint8Array(hashB);
	let diff = 0;

	for (let i = 0; i < bytesA.length; i++) {
		diff |= bytesA[i] ^ bytesB[i];
	}

	return diff === 0;
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
