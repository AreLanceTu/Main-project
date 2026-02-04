function toUint8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    toUint8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, toUint8(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const aa = (a || "").toLowerCase();
  const bb = (b || "").toLowerCase();
  if (aa.length !== bb.length) return false;

  let diff = 0;
  for (let i = 0; i < aa.length; i++) {
    diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return diff === 0;
}

export function razorpayBasicAuthHeader(keyId: string, keySecret: string): string {
  const raw = `${keyId}:${keySecret}`;
  const encoded = btoa(raw);
  return `Basic ${encoded}`;
}
