import { randomBytes } from "node:crypto";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient, type TestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL, type TestAuth } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { LIMITS } from "../auth/limits.ts";
import {
  AVATAR_SIZE,
  AvatarError,
  MAX_STORED_BYTES,
  MAX_UPLOAD_BYTES,
  processAvatar,
  serveAvatar,
  sniffUpload,
} from "./avatars.ts";

/**
 * Profile pictures: what an upload is turned into, what is refused, and the endpoints that
 * store and serve it, through the real auth configuration. Tested for the files an
 * attacker would send, not only for a holiday photo.
 */

const PASSWORD = "a long enough passphrase";

const photo = (width = 400, height = 300, format: "png" | "jpeg" | "webp" = "png") =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } } })
    [format]()
    .toBuffer();

async function reasonOf(upload: Buffer): Promise<string> {
  try {
    await processAvatar(upload);
    return "accepted";
  } catch (error) {
    if (error instanceof AvatarError) return error.reason;
    throw error;
  }
}

/** A PNG that is only a header claiming 20000 x 20000 pixels: a decompression-bomb shape. */
function bombHeader(): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(20_000, 0);
  ihdr.writeUInt32BE(20_000, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", Buffer.alloc(64)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("processAvatar", () => {
  it("turns a picture into a 256x256 WebP", async () => {
    for (const format of ["png", "jpeg", "webp"] as const) {
      const out = await sharp(await processAvatar(await photo(400, 300, format))).metadata();
      expect(out).toMatchObject({ format: "webp", width: AVATAR_SIZE, height: AVATAR_SIZE });
    }
  });

  it("keeps nothing but pixels: the camera's details and position are gone", async () => {
    const withExif = await sharp(await photo(300, 300, "jpeg"))
      .withExif({ IFD0: { Copyright: "fixture-owner", ImageDescription: "fixture-place" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const out = await processAvatar(withExif);
    const meta = await sharp(out).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(out.includes(Buffer.from("fixture-owner"))).toBe(false);
  });

  it("refuses what is not a JPEG, PNG or WebP picture", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );
    const gif = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#000000" },
    })
      .gif()
      .toBuffer();
    expect(await reasonOf(svg)).toBe("unsupported");
    expect(await reasonOf(gif)).toBe("unsupported");
    expect(await reasonOf(Buffer.from("<html><script>alert(1)</script></html>"))).toBe(
      "not-an-image",
    );
    expect(await reasonOf(randomBytes(4096))).toBe("not-an-image");
    expect(await reasonOf(Buffer.alloc(0))).toBe("not-an-image");
  });

  it("hands the image library only what starts like a JPEG, a PNG or a WebP", async () => {
    expect(sniffUpload(await photo(10, 10, "jpeg"))).toBe("jpeg");
    expect(sniffUpload(await photo(10, 10, "png"))).toBe("png");
    expect(sniffUpload(await photo(10, 10, "webp"))).toBe("webp");
    const tile = { create: { width: 16, height: 16, channels: 3, background: "#204060" } } as const;
    // Formats whose parsers sit in the same library, and whose header code an attacker
    // would aim at: refused before the library reads a byte of them.
    const tiff = await sharp(tile).tiff().toBuffer();
    const avif = await sharp(tile).avif().toBuffer();
    const heifShape = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic")]);
    for (const other of [tiff, avif, heifShape]) {
      expect(sniffUpload(other)).toBeNull();
      expect(await reasonOf(other)).toBe("unsupported");
    }
    expect(sniffUpload(Buffer.from("%PDF-1.7\n"))).toBeNull();
    expect(await reasonOf(Buffer.from("%PDF-1.7\n"))).toBe("unsupported");
    // A file that starts like a PNG but is not one is not a picture.
    expect(
      await reasonOf(
        Buffer.concat([
          await photo(10, 10, "png").then((png) => png.subarray(0, 8)),
          randomBytes(64),
        ]),
      ),
    ).toBe("not-an-image");
  });

  it("refuses a damaged picture", async () => {
    const whole = await photo(300, 300, "jpeg");
    expect(await reasonOf(whole.subarray(0, Math.floor(whole.length / 2)))).toBe("not-an-image");
  });

  it("refuses a huge picture before decoding it, and an oversized upload unread", async () => {
    expect(await reasonOf(bombHeader())).toBe("too-large");
    expect(await reasonOf(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).toBe("too-large");
  });

  it("stays within the table's size limit even for pure noise", async () => {
    const noise = await sharp(randomBytes(700 * 700 * 3), {
      raw: { width: 700, height: 700, channels: 3 },
    })
      .png()
      .toBuffer();
    expect((await processAvatar(noise)).length).toBeLessThanOrEqual(MAX_STORED_BYTES);
  });
});

describe("the picture endpoints", () => {
  let database: TestDatabase;
  let t: TestAuth;
  let nextIp = 1;

  const rows = async (text: string, params?: unknown[]) =>
    (await database.client.query<Record<string, unknown>>(text, params)).rows;
  const newClient = () =>
    createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: `198.51.100.${nextIp++}` });
  const idOf = async (email: string) =>
    String((await rows("SELECT id FROM users WHERE email = $1", [email]))[0]?.id ?? "");
  const versionOf = async (userId: string) =>
    ((await rows("SELECT avatar_url FROM users WHERE id = $1::uuid", [userId]))[0]?.avatar_url ??
      null) as string | null;
  const serve = async (userId: string, ifNoneMatch: string | null = null) =>
    serveAvatar(database.db, { id: userId, avatar: await versionOf(userId) }, ifNoneMatch);

  async function signUp(email: string): Promise<TestClient> {
    const client = newClient();
    await client.post("/email-signup/start", { email, password: PASSWORD, acceptTerms: true });
    const verified = await client.post("/email-signup/verify", { code: t.latestCode(email) });
    expect(verified.status, `sign-up of ${email}`).toBe(200);
    return client;
  }

  const upload = async (client: TestClient, image: Buffer) =>
    client.post("/account/avatar", { image: image.toString("base64") });

  beforeAll(async () => {
    database = await createTestDatabase();
    t = createTestAuth(database);
  }, 180_000);
  afterAll(async () => {
    await database?.close();
  });

  it("stores the cleaned picture, and serves it only to its owner", async () => {
    const email = "avatar.ok@example.com";
    const member = await signUp(email);
    expect((await upload(member, await photo())).status).toBe(200);

    const userId = await idOf(email);
    const [row] = await rows(
      "SELECT content_type, octet_length(image) AS size FROM avatars WHERE user_id = $1::uuid",
      [userId],
    );
    expect(row?.content_type).toBe("image/webp");
    const version = await versionOf(userId);
    expect(version).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const served = await serve(userId);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");
    expect(served.headers.get("cache-control")).toBe("private, no-cache");
    expect(served.headers.get("etag")).toBe(`"${version}"`);
    const bytes = Buffer.from(await served.arrayBuffer());
    expect(bytes.length).toBe(Number(row?.size));
    expect((await sharp(bytes).metadata()).width).toBe(AVATAR_SIZE);

    // The browser's copy is current: nothing is read or sent.
    expect((await serve(userId, `"${version}"`)).status).toBe(304);
    // Somebody else has no picture, and can only ever be served their own.
    await signUp("avatar.other@example.com");
    expect((await serve(await idOf("avatar.other@example.com"))).status).toBe(204);
    // Signed out: nothing, and not an error either (an <img> asks, on every page).
    expect((await serveAvatar(database.db, null, null)).status).toBe(204);
  });

  it("a new picture replaces the old one and gets a new version", async () => {
    const email = "avatar.replace@example.com";
    const member = await signUp(email);
    const userId = await idOf(email);
    await upload(member, await photo(400, 300));
    const first = await versionOf(userId);
    const red = await sharp({
      create: { width: 300, height: 300, channels: 3, background: "#c01020" },
    })
      .png()
      .toBuffer();
    expect((await upload(member, red)).status).toBe(200);
    expect(await versionOf(userId)).not.toBe(first);
    expect(await rows("SELECT 1 FROM avatars WHERE user_id = $1::uuid", [userId])).toHaveLength(1);
  });

  it("refuses a file that is not a picture, and stores nothing", async () => {
    const email = "avatar.bad@example.com";
    const member = await signUp(email);
    for (const bad of [
      Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
      randomBytes(512),
    ]) {
      const response = await upload(member, bad);
      expect(response.status).toBe(400);
      expect(response.json).toMatchObject({ code: "BAD_IMAGE" });
    }
    // Not base64 at all, or longer than any upload may be: refused before decoding.
    expect((await member.post("/account/avatar", { image: "not base64!" })).status).toBe(400);
    expect(
      (await member.post("/account/avatar", { image: "A".repeat(MAX_UPLOAD_BYTES * 2) })).status,
    ).toBe(400);
    const userId = await idOf(email);
    expect(await rows("SELECT 1 FROM avatars WHERE user_id = $1::uuid", [userId])).toHaveLength(0);
    expect(await versionOf(userId)).toBeNull();
  });

  it("is refused signed out, and from another website even with the member's cookies", async () => {
    const image = (await photo()).toString("base64");
    expect((await newClient().post("/account/avatar", { image })).status).toBe(401);
    expect((await newClient().post("/account/avatar/remove", {})).status).toBe(401);

    const email = "avatar.forged@example.com";
    const member = await signUp(email);
    const forged = createTestClient(t.auth, {
      baseUrl: TEST_BASE_URL,
      ip: "198.51.100.250",
      origin: "https://evil.example",
    });
    for (const [name, value] of member.cookies) forged.cookies.set(name, value);
    expect((await forged.post("/account/avatar", { image })).status).toBe(403);
    expect((await forged.post("/account/avatar/remove", {})).status).toBe(403);
    expect(
      await rows("SELECT 1 FROM avatars WHERE user_id = $1::uuid", [await idOf(email)]),
    ).toHaveLength(0);
  });

  it("removing it goes back to the default", async () => {
    const email = "avatar.remove@example.com";
    const member = await signUp(email);
    const userId = await idOf(email);
    await upload(member, await photo());
    const response = await member.post("/account/avatar/remove", {});
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({ removed: true });
    expect(await rows("SELECT 1 FROM avatars WHERE user_id = $1::uuid", [userId])).toHaveLength(0);
    expect(await versionOf(userId)).toBeNull();
    expect((await serve(userId)).status).toBe(204);
  });

  it("goes with the account when the account is deleted", async () => {
    const email = "avatar.delete@example.com";
    const member = await signUp(email);
    const userId = await idOf(email);
    await upload(member, await photo());
    expect((await member.post("/delete-user", { password: PASSWORD })).status).toBe(200);
    expect(await rows("SELECT 1 FROM avatars WHERE user_id = $1::uuid", [userId])).toHaveLength(0);
  });

  it("is counted per member", async () => {
    const member = await signUp("avatar.limit@example.com");
    let last = 0;
    for (let i = 0; i < LIMITS.avatarChangePerUser.max + 1; i++) {
      last = (await member.post("/account/avatar/remove", {})).status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  }, 120_000);
});
