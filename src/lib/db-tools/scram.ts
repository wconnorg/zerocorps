import { createHash, createHmac, pbkdf2Sync, randomBytes, randomInt } from "node:crypto";

/**
 * A PostgreSQL SCRAM-SHA-256 password secret, computed on the laptop, so a role's password
 * is set without the password itself ever reaching the server: what psql's `\password` and
 * libpq's PQencryptPasswordConn do (RFC 5802, RFC 7677). PostgreSQL stores a string of this
 * exact form unchanged, so the password cannot turn up in its logs or statistics.
 *
 * Only for generated passwords of plain ASCII letters and digits, which SASLprep leaves
 * exactly as they are; anything else is refused rather than normalised by hand here.
 *
 * This module imports nothing from the app, so the scripts in `scripts/` can load it.
 */

export const SCRAM_ITERATIONS = 4096;
const LETTERS_AND_DIGITS = /^[A-Za-z0-9]+$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** The three keys of RFC 5802, section 3. Exported for the tests' known-answer check. */
export function scramKeys(password: string, salt: Buffer, iterations = SCRAM_ITERATIONS) {
  if (!LETTERS_AND_DIGITS.test(password)) {
    throw new Error("Only letters and digits: this module does not apply SASLprep.");
  }
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  return {
    clientKey,
    storedKey: createHash("sha256").update(clientKey).digest(),
    serverKey: createHmac("sha256", salted).update("Server Key").digest(),
  };
}

/** `SCRAM-SHA-256$<iterations>:<salt>$<StoredKey>:<ServerKey>`, all base64. */
export function scramSecret(
  password: string,
  salt: Buffer = randomBytes(16),
  iterations = SCRAM_ITERATIONS,
): string {
  const { storedKey, serverKey } = scramKeys(password, salt, iterations);
  return (
    `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}` +
    `$${storedKey.toString("base64")}:${serverKey.toString("base64")}`
  );
}

/** Random letters and digits from the operating system's generator: 40 is ~238 bits. */
export function generatePassword(length = 40): string {
  let password = "";
  for (let i = 0; i < length; i++) password += ALPHABET[randomInt(ALPHABET.length)];
  return password;
}
