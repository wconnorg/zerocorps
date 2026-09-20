import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT_VERSION,
  decryptBackup,
  encryptBackup,
  readBackupHeader,
  targetFingerprint,
} from "./format";

const PASSPHRASE = "a long passphrase for the tests";
const META = { createdAt: "2026-09-20T08:00:00.000Z", target: "0123456789abcdef" };
const CHUNK = 1024 * 1024;

/** Where the first chunk starts: magic (5) + version (1) + header length (4) + header. */
const bodyOffset = (file: Buffer) => 10 + file.readUInt32BE(6);

describe("the encrypted backup format", () => {
  it("round-trips, including an empty backup and one that spans several chunks", () => {
    for (const plaintext of [
      Buffer.alloc(0),
      Buffer.from("public.users\t{}\n"),
      randomBytes(2 * CHUNK + 123),
    ]) {
      const file = encryptBackup(plaintext, PASSPHRASE, META);
      const result = decryptBackup(file, PASSPHRASE);
      expect(result.plaintext.equals(plaintext)).toBe(true);
      expect(result.header).toMatchObject({
        v: BACKUP_FORMAT_VERSION,
        cipher: "aes-256-gcm",
        ...META,
      });
    }
  }, 120_000);

  it("derives the key with scrypt and a fresh random salt, recorded in a versioned header", () => {
    const first = readBackupHeader(encryptBackup(Buffer.from("x"), PASSPHRASE, META));
    const second = readBackupHeader(encryptBackup(Buffer.from("x"), PASSPHRASE, META));
    expect(first.v).toBe(1);
    expect(first.kdf).toMatchObject({ name: "scrypt", N: 2 ** 17, r: 8, p: 1 });
    expect(Buffer.from(first.kdf.salt, "base64")).toHaveLength(16);
    expect(first.kdf.salt).not.toBe(second.kdf.salt);
  }, 60_000);

  it("never contains the plaintext or the passphrase", () => {
    const secret = "member@example.com and their password hash";
    const file = encryptBackup(Buffer.from(secret.repeat(50)), PASSPHRASE, META);
    expect(file.includes(Buffer.from("member@example.com"))).toBe(false);
    expect(file.includes(Buffer.from(PASSPHRASE))).toBe(false);
  }, 60_000);

  it("refuses a wrong passphrase", () => {
    const file = encryptBackup(Buffer.from("rows"), PASSPHRASE, META);
    expect(() => decryptBackup(file, "not the passphrase")).toThrow(/Wrong passphrase/);
  }, 60_000);

  it("refuses a file whose header was altered, even though the header is not secret", () => {
    const file = encryptBackup(Buffer.from("rows"), PASSPHRASE, META);
    const altered = Buffer.from(file);
    const text = altered.toString("latin1");
    const at = text.indexOf("0123456789abcdef");
    altered.write("f", at, "latin1");
    expect(readBackupHeader(altered).target).toBe("f123456789abcdef");
    expect(() => decryptBackup(altered, PASSPHRASE)).toThrow(
      /Wrong passphrase, or the backup file is damaged/,
    );
  }, 60_000);

  it("refuses a flipped bit, a truncated file, a dropped chunk and swapped chunks", () => {
    const file = encryptBackup(randomBytes(2 * CHUNK + 10), PASSPHRASE, META);
    const start = bodyOffset(file);
    const frame = 5 + CHUNK + 16;

    const flipped = Buffer.from(file);
    flipped.writeUInt8(flipped.readUInt8(start + 100) ^ 1, start + 100);
    expect(() => decryptBackup(flipped, PASSPHRASE)).toThrow(/damaged/);

    expect(() => decryptBackup(file.subarray(0, file.length - 1), PASSPHRASE)).toThrow(/cut short/);
    expect(() => decryptBackup(file.subarray(0, start + 2 * frame), PASSPHRASE)).toThrow(
      /cut short/,
    );

    const dropped = Buffer.concat([file.subarray(0, start), file.subarray(start + frame)]);
    expect(() => decryptBackup(dropped, PASSPHRASE)).toThrow(/damaged/);

    const swapped = Buffer.concat([
      file.subarray(0, start),
      file.subarray(start + frame, start + 2 * frame),
      file.subarray(start, start + frame),
      file.subarray(start + 2 * frame),
    ]);
    expect(() => decryptBackup(swapped, PASSPHRASE)).toThrow(/damaged/);
  }, 120_000);

  it("refuses data appended after the last chunk", () => {
    const file = encryptBackup(Buffer.from("rows"), PASSPHRASE, META);
    expect(() => decryptBackup(Buffer.concat([file, Buffer.from("extra")]), PASSPHRASE)).toThrow(
      /damaged/,
    );
  }, 60_000);

  it("rejects files that are not backups, and versions it does not know", () => {
    expect(() => readBackupHeader(Buffer.from("hello"))).toThrow(/not a ZeroCorps backup/);
    expect(() => readBackupHeader(Buffer.alloc(0))).toThrow(/not a ZeroCorps backup/);
    const future = Buffer.from(encryptBackup(Buffer.from("x"), PASSPHRASE, META));
    future.writeUInt8(2, 5);
    expect(() => readBackupHeader(future)).toThrow(/format version 2/);
  }, 60_000);

  it("refuses absurd key-derivation parameters instead of trying them", () => {
    const file = encryptBackup(Buffer.from("x"), PASSPHRASE, META);
    const header = {
      ...readBackupHeader(file),
      kdf: { ...readBackupHeader(file).kdf, N: 2 ** 30 },
    };
    const headerBytes = Buffer.from(JSON.stringify(header));
    const length = Buffer.alloc(4);
    length.writeUInt32BE(headerBytes.length, 0);
    const forged = Buffer.concat([
      file.subarray(0, 6),
      length,
      headerBytes,
      file.subarray(bodyOffset(file)),
    ]);
    expect(() => decryptBackup(forged, PASSPHRASE)).toThrow(/header is not valid/);
  }, 60_000);
});

describe("targetFingerprint", () => {
  const url = (user: string, password: string, port: number) =>
    `postgresql://${user}:${password}@aws-0-eu-example-1.pooler.supabase.com:${port}/postgres`;

  it("is the same for the app URL and the migrations URL of one database", () => {
    expect(targetFingerprint(url("zerocorps_app.exampleref", "one", 6543))).toBe(
      targetFingerprint(url("postgres.exampleref", "two", 5432)),
    );
  });

  it("differs between projects, and reveals neither the project nor the password", () => {
    const fingerprint = targetFingerprint(url("postgres.exampleref", "S3cretPassw0rd", 5432));
    expect(fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprint).not.toBe(
      targetFingerprint(url("postgres.otherref", "S3cretPassw0rd", 5432)),
    );
  });
});
