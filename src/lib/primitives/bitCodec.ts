export function boolArrayToBase64Url(bits: boolean[]): string {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));

  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      bytes[i >> 3] |= 1 << (7 - (i & 7));
    }
  }

  let binary = "";
  const CHUNK_SIZE = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  const base64 = btoa(binary);

  // base64 -> base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBoolArray(base64url: string, bitLength: number): boolean[] {
  if (!Number.isInteger(bitLength) || bitLength < 0) {
    throw new Error("bitLength must be a non-negative integer");
  }

  // base64url -> base64
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) {
    base64 += "=".repeat(4 - pad);
  }

  const binary = atob(base64);
  const byteLength = Math.ceil(bitLength / 8);
  if (binary.length !== byteLength) {
    throw new Error(`expected ${byteLength} bytes for ${bitLength} bits, got ${binary.length}`);
  }

  const bits: boolean[] = new Array(bitLength);
  for (let i = 0; i < bitLength; i++) {
    const byte = binary.charCodeAt(i >> 3);
    bits[i] = (byte & (1 << (7 - (i & 7)))) !== 0;
  }

  return bits;
}
