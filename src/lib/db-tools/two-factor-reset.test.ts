import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient } from "../../test/auth-client.ts";
import { createTestAuth, TEST_BASE_URL, type TestAuth } from "../../test/test-auth.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import type { Query } from "../backup/dump.ts";
import { TRUST_DEVICE_PREFIX as PLUGIN_TRUST_PREFIX } from "../auth/two-factor.ts";
import { findResetCandidate, resetTwoFactor, TRUST_DEVICE_PREFIX } from "./two-factor-reset.ts";

/**
 * `npm run 2fa:reset`, on a Postgres inside this process and as the app's own role, the
 * way the command connects. It must reach exactly one member, by their exact username, and
 * leave them able to sign in with the password alone.
 */

const PASSWORD = "a long enough passphrase";

let database: TestDatabase;
let t: TestAuth;
let nextIp = 1;

const queryOf =
  (client: Pick<TestDatabase["client"], "query">): Query =>
  async (text, params) =>
    (await client.query<Record<string, unknown>>(text, params)).rows;
const rows = (text: string, params?: unknown[]) => queryOf(database.client)(text, params);
const newClient = () =>
  createTestClient(t.auth, { baseUrl: TEST_BASE_URL, ip: `192.0.2.${nextIp++}` });

/** A member with a username, two-factor switched on and a browser trusted to skip it. */
async function memberWithTwoFactor(email: string, username: string) {
  const client = newClient();
  await client.post("/email-signup/start", { email, password: PASSWORD, acceptTerms: true });
  await client.post("/email-signup/verify", { code: t.latestCode(email) });
  const [user] = await rows("SELECT id::text AS id FROM users WHERE email = $1", [email]);
  const userId = String(user?.id);
  await rows("UPDATE users SET username = $1 WHERE id = $2::uuid", [username, userId]);
  await rows(
    `INSERT INTO two_factors (user_id, secret, backup_codes) VALUES ($1::uuid, 'sealed', 'sealed')`,
    [userId],
  );
  await rows("UPDATE users SET two_factor_enabled = true WHERE id = $1::uuid", [userId]);
  await rows(
    `INSERT INTO verifications (identifier, value, expires_at)
     VALUES ($1, $2, now() + interval '30 days')`,
    [`${TRUST_DEVICE_PREFIX}fixture-${username}`, userId],
  );
  return userId;
}

beforeAll(async () => {
  database = await createTestDatabase();
  t = createTestAuth(database);
}, 180_000);
afterAll(async () => {
  await database?.close();
});

describe("npm run 2fa:reset", () => {
  it("names the account by its exact username only, and shows no full address", async () => {
    await memberWithTwoFactor("reset.find@example.com", "finder_1");
    const query = queryOf(database.client);

    const found = await findResetCandidate(query, " @Finder_1 ");
    expect(found).toMatchObject({
      username: "finder_1",
      maskedEmail: "r***@example.com",
      twoFactorEnabled: true,
      discordUsername: null,
    });
    expect(found?.memberSince).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Never a pattern: nothing that is not a whole, valid username finds anyone.
    for (const input of ["finder", "finder_%", "%", "finder_1' OR '1'='1", "", "fi"]) {
      expect(await findResetCandidate(query, input), input).toBeNull();
    }
  }, 120_000);

  it("switches two-factor off for that member alone, signs them out, and records it", async () => {
    const target = await memberWithTwoFactor("reset.target@example.com", "target_1");
    const bystander = await memberWithTwoFactor("reset.other@example.com", "bystander_1");

    const result = await database.asAppRole(() =>
      database.client.transaction((transaction) => resetTwoFactor(queryOf(transaction), target)),
    );
    expect(result).toEqual({ secrets: 1, trustedBrowsers: 1, sessions: 1 });

    expect(
      await rows("SELECT two_factor_enabled FROM users WHERE id = $1::uuid", [target]),
    ).toEqual([{ two_factor_enabled: false }]);
    expect(
      await rows("SELECT type, detail FROM auth_events WHERE user_id = $1::uuid AND type = $2", [
        target,
        "two_factor_reset",
      ]),
    ).toEqual([{ type: "two_factor_reset", detail: "owner_command" }]);

    // The other member is untouched.
    expect(
      await rows("SELECT two_factor_enabled FROM users WHERE id = $1::uuid", [bystander]),
    ).toEqual([{ two_factor_enabled: true }]);
    expect(
      await rows("SELECT id FROM two_factors WHERE user_id = $1::uuid", [bystander]),
    ).toHaveLength(1);
    expect(
      await rows("SELECT id FROM sessions WHERE user_id = $1::uuid", [bystander]),
    ).toHaveLength(1);

    // The member signs in with the password alone, and can switch two-factor on again.
    const back = newClient();
    const signIn = await back.post("/sign-in/email", {
      email: "reset.target@example.com",
      password: PASSWORD,
    });
    expect(signIn.json).toHaveProperty("token");
    expect((await back.post("/two-factor/enable", { password: PASSWORD })).json).toHaveProperty(
      "totpURI",
    );
  }, 120_000);

  it("forgets trusted browsers by the same name Better Auth gives them", () => {
    expect(TRUST_DEVICE_PREFIX).toBe(PLUGIN_TRUST_PREFIX);
  });
});
