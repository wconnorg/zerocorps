import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { avatars, users } from "../../db/schema.ts";
import type { AuthDatabase } from "../auth/create-auth.ts";

/**
 * Profile pictures (milestone 3), stored in the database (owner, 2026-09-21).
 *
 * The upload is never stored as it came. It is decoded by sharp (libvips, the library
 * Next.js itself uses for images), checked, turned upright, cropped to a square, resized
 * to 256 by 256 and re-encoded as WebP. Re-encoding keeps only the pixels, so a phone's GPS
 * position, the camera's details and anything hidden inside the original file are gone,
 * and a file that only pretends to be an image is refused because it does not decode.
 *
 * Refused before any work: anything that does not START like a JPEG, a PNG or a WebP, so no
 * other decoder in the image library ever reads a member's upload (no SVG, which can carry
 * script; no TIFF, HEIF, AVIF, JPEG 2000 or PDF, whose parsers are where the library's
 * security fixes keep landing), and images over 40 megapixels, which is how a small file is
 * made to take a server's memory ("decompression bombs").
 */

export const AVATAR_SIZE = 256;
/**
 * The largest upload accepted, in bytes, before decoding. The browser shrinks a picture to
 * at most 1024 pixels a side first, which comes to a few hundred kilobytes.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** What the table's check allows: a 256x256 WebP is normally 10 to 40 kilobytes. */
export const MAX_STORED_BYTES = 128 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export class AvatarError extends Error {
  // A plain property, not a parameter property: Node's type stripping has no room for those.
  readonly reason: "too-large" | "not-an-image" | "unsupported";

  constructor(reason: "too-large" | "not-an-image" | "unsupported") {
    super(reason);
    this.name = "AvatarError";
    this.reason = reason;
  }
}

const startsWith = (upload: Buffer, prefix: string | number[], offset = 0) => {
  const bytes = typeof prefix === "string" ? Buffer.from(prefix, "latin1") : Buffer.from(prefix);
  return (
    upload.length >= offset + bytes.length &&
    upload.subarray(offset, offset + bytes.length).equals(bytes)
  );
};

/**
 * The format an upload's first bytes announce, for the three formats accepted; null for
 * anything else, which is then never handed to the image library at all.
 */
export function sniffUpload(upload: Buffer): "jpeg" | "png" | "webp" | null {
  if (startsWith(upload, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(upload, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(upload, "RIFF") && startsWith(upload, "WEBP", 8)) return "webp";
  return null;
}

/**
 * Other kinds of picture, by their first bytes, only so the member is told to use one of the
 * three formats rather than that the file is not a picture. Never used to decide what is read.
 */
function looksLikeAnotherPicture(upload: Buffer): boolean {
  const signatures: [string | number[], number][] = [
    ["GIF87a", 0],
    ["GIF89a", 0],
    [[0x49, 0x49, 0x2a, 0x00], 0], // TIFF, little-endian
    [[0x4d, 0x4d, 0x00, 0x2a], 0], // TIFF, big-endian
    [[0x00, 0x00, 0x01, 0x00], 0], // ICO
    ["ftyp", 4], // HEIF, HEIC, AVIF
    [[0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20], 0], // JPEG XL
    [[0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20], 0], // JPEG 2000
    ["%PDF", 0],
  ];
  return (
    signatures.some(([prefix, offset]) => startsWith(upload, prefix, offset)) ||
    // BMP: "BM", then the size, then four reserved bytes that are always zero.
    (startsWith(upload, "BM") && startsWith(upload, [0, 0, 0, 0], 6)) ||
    /<svg[\s>]/i.test(upload.toString("latin1", 0, Math.min(upload.length, 1024)))
  );
}

/** Turns an upload into the one thing ever stored: a 256x256 WebP with nothing but pixels. */
export async function processAvatar(upload: Buffer): Promise<Buffer> {
  if (upload.length === 0) throw new AvatarError("not-an-image");
  if (upload.length > MAX_UPLOAD_BYTES) throw new AvatarError("too-large");
  const sniffed = sniffUpload(upload);
  if (sniffed === null) {
    throw new AvatarError(looksLikeAnotherPicture(upload) ? "unsupported" : "not-an-image");
  }
  // Loaded here, not at the top: every auth request shares this code, and only a picture
  // upload needs the image library.
  const { default: sharp } = await import("sharp");

  let format: string | undefined;
  try {
    // Only the header is read here, never the pixels, so the size is checked by us first.
    const meta = await sharp(upload, { limitInputPixels: false }).metadata();
    format = meta.format;
    if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS)
      throw new AvatarError("too-large");
  } catch (error) {
    if (error instanceof AvatarError) throw error;
    throw new AvatarError("not-an-image");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) throw new AvatarError("unsupported");
  // The library must read it as the format its first bytes announced; anything else is a
  // file pretending to be a picture.
  if (format !== sniffed) throw new AvatarError("not-an-image");

  // A picture that is mostly noise encodes large: try once more at a lower quality.
  for (const quality of [82, 60]) {
    let image: Buffer;
    try {
      // sharp's default `failOn: "warning"`: a damaged or truncated file is refused.
      image = await sharp(upload, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate() // upright, from the camera's orientation tag, which is then dropped
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
        .webp({ quality })
        .toBuffer();
    } catch {
      throw new AvatarError("not-an-image");
    }
    if (image.length <= MAX_STORED_BYTES) return image;
  }
  throw new AvatarError("too-large");
}

/**
 * A picture's version: a short hash of the stored bytes. It is kept in the member's
 * `avatar_url` column (Better Auth's `image`, which no endpoint lets a member write), so a
 * request from a browser that already has this version is answered without reading the
 * picture, and a new picture gets a new version.
 */
export const avatarVersion = (image: Buffer) =>
  createHash("sha256").update(image).digest("base64url").slice(0, 22);

export async function saveAvatar(db: AuthDatabase, userId: string, image: Buffer, now: Date) {
  const version = avatarVersion(image);
  await db.transaction(async (tx) => {
    await tx
      .insert(avatars)
      .values({ userId, image, contentType: "image/webp", updatedAt: now })
      .onConflictDoUpdate({ target: avatars.userId, set: { image, updatedAt: now } });
    await tx.update(users).set({ avatarUrl: version }).where(eq(users.id, userId));
  });
  return version;
}

export async function removeAvatar(db: AuthDatabase, userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(avatars)
      .where(eq(avatars.userId, userId))
      .returning({ userId: avatars.userId });
    await tx.update(users).set({ avatarUrl: null }).where(eq(users.id, userId));
    return removed.length > 0;
  });
}

/**
 * GET /api/avatar: the signed-in member's OWN picture, and nobody else's (there is no id
 * to ask for, so there is nothing to enumerate). 200 with the image; 304 when the browser
 * already has this version; 204 (nothing) when there is no picture, or nobody is signed
 * in, and the page keeps the grey default. Only an `<img>` ever asks, and an error status
 * there is logged as an error in the browser's console on every page, so "nothing" is an
 * empty answer, not a refusal. Private: never kept by a shared cache.
 */
export async function serveAvatar(
  db: AuthDatabase,
  member: { id: string; avatar: string | null } | null,
  ifNoneMatch: string | null,
): Promise<Response> {
  const headers = { "cache-control": "private, no-cache", "x-content-type-options": "nosniff" };
  const nothing = () => new Response(null, { status: 204, headers });
  if (!member || !member.avatar) return nothing();
  const etag = `"${member.avatar}"`;
  if (ifNoneMatch === etag)
    return new Response(null, { status: 304, headers: { ...headers, etag } });

  const [row] = await db
    .select({ image: avatars.image })
    .from(avatars)
    .where(eq(avatars.userId, member.id))
    .limit(1);
  if (!row) return nothing();
  return new Response(new Uint8Array(row.image), {
    status: 200,
    headers: {
      ...headers,
      "content-type": "image/webp",
      "content-length": String(row.image.length),
      etag: `"${avatarVersion(row.image)}"`,
    },
  });
}
