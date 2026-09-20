import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The few cryptographic operations our own auth code performs, all straight from
 * Node's crypto. Nothing here is novel: HMAC-SHA256, SHA-256, a constant-time
 * comparison and random bytes.
 */

/**
 * HMAC-SHA256 of a value, keyed with HMAC_SECRET. `purpose` separates the uses of the
 * one secret, so a hash made for one purpose can never be replayed as another.
 */
export function keyedHash(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret).update(`${purpose}\n${value}`).digest("base64url");
}

/** Plain SHA-256, for values that are already long and random (a device token). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

/** Constant-time comparison of two strings. Different lengths compare unequal. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual needs equal lengths; comparing `left` with itself keeps the work constant.
  if (left.length !== right.length) return timingSafeEqual(left, left) && false;
  return timingSafeEqual(left, right);
}

/** A URL-safe random token: 32 bytes, 43 characters. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
