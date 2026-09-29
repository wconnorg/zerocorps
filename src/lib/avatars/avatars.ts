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
 * Refused before any work: anything but JPEG, PNG or WebP (no SVG, which can carry
 * script), and images over 40 megapixels, which is how a small file is made to take a
 * server's memory ("decompression bombs").
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

/** Turns an upload into the one thing ever stored: a 256x256 WebP with nothing but pixels. */
export async function processAvatar(upload: Buffer): Promise<Buffer> {
  if (upload.length === 0) throw new AvatarError("not-an-image");
  if (upload.length > MAX_UPLOAD_BYTES) throw new AvatarError("too-large");
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
 * already has this version; 404 when there is none, and the page shows the grey default.
 * Private: never kept by a shared cache.
 */
export async function serveAvatar(
  db: AuthDatabase,
  member: { id: string; avatar: string | null } | null,
  ifNoneMatch: string | null,
): Promise<Response> {
  const headers = { "cache-control": "private, no-cache", "x-content-type-options": "nosniff" };
  if (!member) return new Response(null, { status: 401, headers });
  if (!member.avatar) return new Response(null, { status: 404, headers });
  const etag = `"${member.avatar}"`;
  if (ifNoneMatch === etag)
    return new Response(null, { status: 304, headers: { ...headers, etag } });

  const [row] = await db
    .select({ image: avatars.image })
    .from(avatars)
    .where(eq(avatars.userId, member.id))
    .limit(1);
  if (!row) return new Response(null, { status: 404, headers });
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
