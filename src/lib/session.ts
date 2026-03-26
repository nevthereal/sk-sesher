const encoder = new TextEncoder();

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

export async function createSignedSessionValue(secret: string): Promise<string> {
	const payload = `${Date.now().toString(36)}.${crypto.randomUUID().replaceAll('-', '')}`;
	const key = await importSigningKey(secret);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

	return `${payload}.${bytesToHex(new Uint8Array(signature))}`;
}

export async function verifySignedSessionValue(
	secret: string,
	cookieValue: string | undefined
): Promise<boolean> {
	if (!cookieValue) return false;

	const lastSeparator = cookieValue.lastIndexOf('.');
	if (lastSeparator <= 0 || lastSeparator === cookieValue.length - 1) return false;

	const payload = cookieValue.slice(0, lastSeparator);
	const signatureHex = cookieValue.slice(lastSeparator + 1);
	const signature = hexToBytes(signatureHex);

	if (!signature) return false;

	const key = await importSigningKey(secret);
	return crypto.subtle.verify('HMAC', key, signature as BufferSource, encoder.encode(payload));
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
