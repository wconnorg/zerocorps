import { PGlite } from "@electric-sql/pglite";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generatePassword, SCRAM_ITERATIONS, scramKeys, scramSecret } from "./scram.ts";

/**
 * The SCRAM-SHA-256 secret `npm run brain:setup` sends instead of a password. Checked
 * against the worked example in RFC 7677, section 3, and against Postgres itself: a
 * string Postgres did not recognise as a secret would be hashed again, as a password.
 */

// RFC 7677, section 3: user "user", password "pencil".
const RFC = {
  password: "pencil",
  salt: "W22ZaJ0SNY7soEsUEjb6gQ==",
  clientFirstBare: "n=user,r=rOprNGfwEbeRWgbNEkqO",
  serverFirst:
    "r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096",
  clientFinalWithoutProof: "c=biws,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0",
  proof: "dHzbZapWIk4jUhN+Ute9ytag9zjfMHgsqmmiz7AndVQ=",
  serverSignature: "6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4=",
};

// A bare Postgres is enough to see how it stores a role's password: no schema needed.
let database: { client: PGlite };

beforeAll(async () => {
  database = { client: new PGlite() };
  await database.client.exec("CREATE ROLE brain_reader NOLOGIN");
}, 180_000);
afterAll(async () => {
  await database?.client.close();
});

describe("scramKeys", () => {
  it("gives the keys of RFC 7677's worked example", () => {
    const { clientKey, storedKey, serverKey } = scramKeys(
      RFC.password,
      Buffer.from(RFC.salt, "base64"),
      4096,
    );
    const authMessage = `${RFC.clientFirstBare},${RFC.serverFirst},${RFC.clientFinalWithoutProof}`;
    const clientSignature = createHmac("sha256", storedKey).update(authMessage).digest();
    const proof = Buffer.from(clientKey.map((byte, index) => byte ^ (clientSignature[index] ?? 0)));
    expect(proof.toString("base64")).toBe(RFC.proof);
    expect(createHmac("sha256", serverKey).update(authMessage).digest("base64")).toBe(
      RFC.serverSignature,
    );
  });

  it("refuses anything but letters and digits, which would need SASLprep", () => {
    for (const password of ["pässword", "with space", "semi;colon", "quote'd", ""]) {
      expect(() => scramKeys(password, Buffer.alloc(16))).toThrow(/letters and digits/);
    }
  });
});

describe("scramSecret", () => {
  it("has Postgres's form, and a fresh salt every time", () => {
    const secret = scramSecret("abcDEF123");
    expect(secret).toMatch(
      new RegExp(
        `^SCRAM-SHA-256\\$${SCRAM_ITERATIONS}:[A-Za-z0-9+/]{22}==\\$[A-Za-z0-9+/]{43}=:[A-Za-z0-9+/]{43}=$`,
      ),
    );
    expect(scramSecret("abcDEF123")).not.toBe(secret);
  });

  it("is stored by Postgres exactly as sent, so the password itself never reaches it", async () => {
    const secret = scramSecret(generatePassword());
    await database.client.exec(`ALTER ROLE brain_reader PASSWORD '${secret}'`);
    const stored = async () =>
      (
        await database.client.query<{ rolpassword: string }>(
          "SELECT rolpassword FROM pg_authid WHERE rolname = 'brain_reader'",
        )
      ).rows[0]?.rolpassword;
    expect(await stored()).toBe(secret);

    // For contrast: a plain password is hashed by Postgres, so what it stores differs.
    await database.client.exec("ALTER ROLE brain_reader PASSWORD 'plainletters123'");
    expect(await stored()).toMatch(/^SCRAM-SHA-256\$/);
    expect(await stored()).not.toContain("plainletters123");
    await database.client.exec("ALTER ROLE brain_reader PASSWORD NULL");
  });
});

describe("generatePassword", () => {
  it("gives 40 letters and digits, different every time", () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(passwords.size).toBe(50);
    for (const password of passwords) expect(password).toMatch(/^[A-Za-z0-9]{40}$/);
  });
});
