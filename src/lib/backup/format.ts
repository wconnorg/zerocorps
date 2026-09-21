import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

/**
 * The encrypted backup file. Standard parts only, all from Node's own crypto:
 * scrypt turns the passphrase into a key, AES-256-GCM encrypts and authenticates.
 *
 * Layout, version 1:
 *
 *   "ZCBAK"            5 bytes   magic
 *   version            1 byte    = 1
 *   header length      4 bytes   big-endian
 *   header             JSON      readable WITHOUT the passphrase: key-derivation
 *                                parameters, salt, creation time, target fingerprint
 *   chunk, repeated:
 *     plaintext length 4 bytes   big-endian
 *     flags            1 byte    1 = this is the last chunk
 *     ciphertext       n bytes
 *     tag              16 bytes  GCM authentication tag
 *
 * Why chunks: one GCM message must stay under about 64 GB, and chunks keep memory
 * flat if the database grows. Every chunk is authenticated together with a hash of
 * the header, its own index and its flags, so a changed header, a swapped or dropped
 * chunk, or a truncated file fails to decrypt instead of restoring silently wrong.
 *
 * Nonces are never reused: the key is fresh for every file (random salt), and inside
 * a file the nonce is the chunk counter.
 *
 * This module imports nothing but node:crypto, so the scripts in `scripts/` can load it.
 */

const MAGIC = Buffer.from("ZCBAK", "ascii");
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_EXTENSION = ".zcbak";

const CHUNK_SIZE = 1024 * 1024;
const TAG_LENGTH = 16;
const FLAG_LAST = 1;
const MAX_HEADER_LENGTH = 64 * 1024;

/** scrypt at the strength OWASP recommends (N = 2^17, r = 8, p = 1): about 128 MB and a second or so. */
const KDF = { N: 2 ** 17, r: 8, p: 1 } as const;
const MAX_KDF_N = 2 ** 20;
const SCRYPT_MAXMEM = 1024 * 1024 * 1024;

export type BackupHeader = {
  v: number;
  app: "zerocorps";
  cipher: "aes-256-gcm";
  kdf: { name: "scrypt"; N: number; r: number; p: number; salt: string };
  chunkSize: number;
  /** ISO 8601. */
  createdAt: string;
  /** A short, non-secret fingerprint of the database the backup came from. */
  target: string;
};

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

function deriveKey(passphrase: string, kdf: BackupHeader["kdf"]): Buffer {
  return scryptSync(passphrase.normalize("NFKC"), Buffer.from(kdf.salt, "base64"), 32, {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    maxmem: SCRYPT_MAXMEM,
  });
}

function nonceFor(index: number): Buffer {
  const nonce = Buffer.alloc(12);
  nonce.writeBigUInt64BE(BigInt(index), 4);
  return nonce;
}

function associatedData(prefixHash: Buffer, index: number, flags: number): Buffer {
  const counter = Buffer.alloc(9);
  counter.writeBigUInt64BE(BigInt(index), 0);
  counter.writeUInt8(flags, 8);
  return Buffer.concat([prefixHash, counter]);
}

export function encryptBackup(
  plaintext: Buffer,
  passphrase: string,
  meta: { createdAt: string; target: string },
): Buffer {
  const header: BackupHeader = {
    v: BACKUP_FORMAT_VERSION,
    app: "zerocorps",
    cipher: "aes-256-gcm",
    kdf: { name: "scrypt", ...KDF, salt: randomBytes(16).toString("base64") },
    chunkSize: CHUNK_SIZE,
    createdAt: meta.createdAt,
    target: meta.target,
  };
  const headerBytes = Buffer.from(JSON.stringify(header), "utf8");
  const lengthBytes = Buffer.alloc(4);
  lengthBytes.writeUInt32BE(headerBytes.length, 0);
  const prefix = Buffer.concat([
    MAGIC,
    Buffer.from([BACKUP_FORMAT_VERSION]),
    lengthBytes,
    headerBytes,
  ]);
  const prefixHash = createHash("sha256").update(prefix).digest();
  const key = deriveKey(passphrase, header.kdf);

  const parts: Buffer[] = [prefix];
  const chunkCount = Math.max(1, Math.ceil(plaintext.length / CHUNK_SIZE));
  for (let index = 0; index < chunkCount; index++) {
    const chunk = plaintext.subarray(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
    const flags = index === chunkCount - 1 ? FLAG_LAST : 0;
    const cipher = createCipheriv("aes-256-gcm", key, nonceFor(index));
    cipher.setAAD(associatedData(prefixHash, index, flags));
    const ciphertext = Buffer.concat([cipher.update(chunk), cipher.final()]);
    const frame = Buffer.alloc(5);
    frame.writeUInt32BE(chunk.length, 0);
    frame.writeUInt8(flags, 4);
    parts.push(frame, ciphertext, cipher.getAuthTag());
  }
  return Buffer.concat(parts);
}

function parsePrefix(file: Buffer): { header: BackupHeader; prefix: Buffer } {
  if (file.length < MAGIC.length + 5 || !file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new BackupError("This is not a ZeroCorps backup file.");
  }
  const version = file.readUInt8(MAGIC.length);
  if (version !== BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      `This backup uses format version ${version}, which this command cannot read.`,
    );
  }
  const headerLength = file.readUInt32BE(MAGIC.length + 1);
  const headerStart = MAGIC.length + 5;
  if (headerLength > MAX_HEADER_LENGTH || file.length < headerStart + headerLength) {
    throw new BackupError("The backup file is damaged: its header is cut short.");
  }
  let header: BackupHeader;
  try {
    header = JSON.parse(
      file.subarray(headerStart, headerStart + headerLength).toString("utf8"),
    ) as BackupHeader;
  } catch {
    throw new BackupError("The backup file is damaged: its header cannot be read.");
  }
  const kdf = header?.kdf;
  const sane =
    header?.v === BACKUP_FORMAT_VERSION &&
    header.cipher === "aes-256-gcm" &&
    kdf?.name === "scrypt" &&
    Number.isInteger(kdf.N) &&
    kdf.N >= 2 ** 14 &&
    kdf.N <= MAX_KDF_N &&
    Number.isInteger(kdf.r) &&
    kdf.r >= 8 &&
    kdf.r <= 32 &&
    Number.isInteger(kdf.p) &&
    kdf.p >= 1 &&
    kdf.p <= 16 &&
    typeof kdf.salt === "string" &&
    Buffer.from(kdf.salt, "base64").length >= 16 &&
    typeof header.createdAt === "string" &&
    typeof header.target === "string";
  if (!sane) throw new BackupError("The backup file is damaged: its header is not valid.");
  return { header, prefix: file.subarray(0, headerStart + headerLength) };
}

/** Reads the header only. No passphrase needed; used by the migrate guard. */
export function readBackupHeader(file: Buffer): BackupHeader {
  return parsePrefix(file).header;
}

export function decryptBackup(
  file: Buffer,
  passphrase: string,
): { header: BackupHeader; plaintext: Buffer } {
  const { header, prefix } = parsePrefix(file);
  const prefixHash = createHash("sha256").update(prefix).digest();
  const key = deriveKey(passphrase, header.kdf);

  const parts: Buffer[] = [];
  let offset = prefix.length;
  let index = 0;
  let sawLast = false;
  while (offset < file.length) {
    if (sawLast)
      throw new BackupError("The backup file is damaged: there is data after its last chunk.");
    if (file.length < offset + 5)
      throw new BackupError("The backup file is damaged: it is cut short.");
    const length = file.readUInt32BE(offset);
    const flags = file.readUInt8(offset + 4);
    const start = offset + 5;
    const end = start + length;
    if (length > header.chunkSize || file.length < end + TAG_LENGTH) {
      throw new BackupError("The backup file is damaged: it is cut short.");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, nonceFor(index));
    decipher.setAAD(associatedData(prefixHash, index, flags));
    decipher.setAuthTag(file.subarray(end, end + TAG_LENGTH));
    try {
      parts.push(Buffer.concat([decipher.update(file.subarray(start, end)), decipher.final()]));
    } catch {
      throw new BackupError(
        index === 0
          ? "Wrong passphrase, or the backup file is damaged."
          : "The backup file is damaged: part of it fails its integrity check.",
      );
    }
    sawLast = (flags & FLAG_LAST) === FLAG_LAST;
    offset = end + TAG_LENGTH;
    index++;
  }
  if (!sawLast) throw new BackupError("The backup file is damaged: it is cut short.");
  return { header, plaintext: Buffer.concat(parts) };
}

/**
 * A short, non-secret label for a database, so the migrate guard can tell that a
 * backup belongs to the database it is about to change.
 */
export function targetFingerprint(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const projectRef = decodeURIComponent(url.username).split(".").slice(1).join(".");
  return createHash("sha256")
    .update(`${url.hostname}|${projectRef}|${url.pathname}`)
    .digest("hex")
    .slice(0, 16);
}
