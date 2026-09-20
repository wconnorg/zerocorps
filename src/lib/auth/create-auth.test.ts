import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestClient } from "../../test/auth-client.ts";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import { createAuth, type Auth } from "./create-auth.ts";

/**
 * Proves the migrations in `drizzle/` against Better Auth itself, on a Postgres
 * inside this process. Migrations are additive forever, so a wrong column has to be
 * caught here, before it ever reaches the one real database.
 */

const BASE_URL = "http://localhost:3000";
const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "a different long passphrase";

let database: TestDatabase;
let auth: Auth;
const resetLinks: { to: string; url: string }[] = [];
const passwordChanged: string[] = [];

beforeAll(async () => {
  database = await createTestDatabase();
  auth = createAuth({
    db: database.db,
    baseUrl: BASE_URL,
    secret: "fixture-better-auth-secret-0000000000",
    trustedIpHeader: "x-forwarded-for",
    mailer: {
      sendPasswordReset: async (message) => void resetLinks.push(message),
      sendPasswordChanged: async ({ to }) => void passwordChanged.push(to),
    },
  });
}, 180_000);

afterAll(async () => {
  await database?.close();
});

/** Creates an account the way the email-code plugin will: already verified, with a credential. */
async function createVerifiedUser(email: string, password = PASSWORD) {
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser(
    {
      email,
      name: "",
      emailVerified: true,
      termsAcceptedAt: new Date(),
      termsVersion: "test-1",
    },
    // The same provisioning source the stock email sign-up declares.
    { method: "email-password" },
  );
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await context.password.hash(password),
  });
  return user;
}

const tokenFrom = (url: string) => new URL(url).searchParams.get("token") ?? "";

describe("the core schema, against Better Auth 1.7.5", () => {
  it("passes Better Auth's own schema check on the first request", async () => {
    const client = createTestClient(auth, { baseUrl: BASE_URL });
    expect((await client.get("/ok")).status).toBe(200);
  }, 60_000);

  it("stores a user with a native uuid, the mapped columns and the terms fields", async () => {
    const user = await createVerifiedUser("stored@example.com");
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const { rows } = await database.client.query<Record<string, unknown>>(
      "SELECT * FROM users WHERE email = $1",
      ["stored@example.com"],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email_verified: true,
      display_name: "",
      avatar_url: null,
      terms_version: "test-1",
    });
    expect(rows[0]?.terms_accepted_at).toBeInstanceOf(Date);
  }, 60_000);

  it("refuses an address that is not in the normalised form, at the database", async () => {
    await expect(
      database.client.query("INSERT INTO users (email) VALUES ($1)", [" Mixed@Example.com "]),
    ).rejects.toThrow(/users_email_normalised/);
  });

  it("signs in, reads the session, and signs out", async () => {
    await createVerifiedUser("signin@example.com");
    const client = createTestClient(auth, { baseUrl: BASE_URL, ip: "203.0.113.20" });

    const signIn = await client.post("/sign-in/email", {
      email: "signin@example.com",
      password: PASSWORD,
    });
    expect(signIn.status).toBe(200);
    expect([...client.cookies.keys()]).toContain("zc.session_token");
    const cookie = signIn.setCookies.find((line) => line.startsWith("zc.session_token=")) ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Domain=/i);

    const session = await client.get("/get-session");
    expect(session.json).toMatchObject({
      user: { email: "signin@example.com", emailVerified: true },
    });

    expect((await client.post("/sign-out")).status).toBe(200);
    expect((await client.get("/get-session")).json).toBeNull();
  }, 60_000);

  it("gives one answer for an unknown address and for a wrong password", async () => {
    await createVerifiedUser("known@example.com");
    const client = createTestClient(auth, { baseUrl: BASE_URL, ip: "203.0.113.21" });
    const unknown = await client.post("/sign-in/email", {
      email: "nobody@example.com",
      password: PASSWORD,
    });
    const wrong = await client.post("/sign-in/email", {
      email: "known@example.com",
      password: "not the password",
    });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.json).toEqual(wrong.json);
  }, 60_000);

  it("resets a password with a single-use token, signs out every session and says so by email", async () => {
    await createVerifiedUser("reset@example.com");
    const browser = createTestClient(auth, { baseUrl: BASE_URL, ip: "203.0.113.22" });
    await browser.post("/sign-in/email", { email: "reset@example.com", password: PASSWORD });
    expect((await browser.get("/get-session")).json).not.toBeNull();

    const visitor = createTestClient(auth, { baseUrl: BASE_URL, ip: "203.0.113.23" });
    const known = await visitor.post("/request-password-reset", { email: "reset@example.com" });
    const unknown = await visitor.post("/request-password-reset", { email: "nobody@example.com" });
    expect(known.status).toBe(200);
    expect(unknown.json).toEqual(known.json);

    const link = resetLinks.find((entry) => entry.to === "reset@example.com");
    expect(link?.url.startsWith(`${BASE_URL}/reset-password?token=`)).toBe(true);
    expect(resetLinks.some((entry) => entry.to === "nobody@example.com")).toBe(false);
    const token = tokenFrom(link?.url ?? "");

    expect(
      (await visitor.post("/reset-password", { token, newPassword: "too short" })).status,
    ).toBe(400);
    expect(
      (await visitor.post("/reset-password", { token, newPassword: NEW_PASSWORD })).status,
    ).toBe(200);
    expect(
      (await visitor.post("/reset-password", { token, newPassword: NEW_PASSWORD })).status,
    ).toBe(400);
    expect(passwordChanged).toContain("reset@example.com");

    expect((await browser.get("/get-session")).json).toBeNull();
    expect(
      (await visitor.post("/sign-in/email", { email: "reset@example.com", password: PASSWORD }))
        .status,
    ).toBe(401);
    expect(
      (await visitor.post("/sign-in/email", { email: "reset@example.com", password: NEW_PASSWORD }))
        .status,
    ).toBe(200);
  }, 120_000);

  it("keeps the stock sign-up switched off, over HTTP and for server-side calls", async () => {
    const client = createTestClient(auth, { baseUrl: BASE_URL, ip: "203.0.113.24" });
    const overHttp = await client.post("/sign-up/email", {
      email: "stock@example.com",
      password: PASSWORD,
      name: "",
    });
    expect(overHttp.status).toBe(404);
    await expect(
      auth.api.signUpEmail({ body: { email: "stock@example.com", password: PASSWORD, name: "" } }),
    ).rejects.toThrow(/sign up is not enabled/i);

    const { rows } = await database.client.query("SELECT 1 FROM users WHERE email = $1", [
      "stock@example.com",
    ]);
    expect(rows).toHaveLength(0);
  }, 60_000);

  it("refuses a sign-in posted from another site", async () => {
    await createVerifiedUser("csrf@example.com");
    const attacker = createTestClient(auth, {
      baseUrl: BASE_URL,
      ip: "203.0.113.25",
      origin: "https://evil.example",
    });
    const response = await attacker.post("/sign-in/email", {
      email: "csrf@example.com",
      password: PASSWORD,
    });
    expect(response.status).toBe(403);
    expect(attacker.cookies.size).toBe(0);
  }, 60_000);

  it("never stores a token in the accounts table (hard rule 5)", async () => {
    const { rows } = await database.client.query<{ leaked: number }>(
      `SELECT count(*)::int AS leaked FROM accounts
       WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL OR id_token IS NOT NULL
          OR provider_id <> 'credential'`,
    );
    expect(rows[0]?.leaked).toBe(0);
  });
});

describe("the app role, zerocorps_app", () => {
  it("can do everything the app does: create an account, sign in, reset, sign out", async () => {
    await database.asAppRole(async () => {
      await createVerifiedUser("role@example.com");
      const client = createTestClient(auth, { baseUrl: BASE_URL, ip: "203.0.113.30" });
      expect(
        (await client.post("/sign-in/email", { email: "role@example.com", password: PASSWORD }))
          .status,
      ).toBe(200);
      expect((await client.get("/get-session")).json).toMatchObject({
        user: { email: "role@example.com" },
      });

      await client.post("/request-password-reset", { email: "role@example.com" });
      const token = tokenFrom(
        resetLinks.find((entry) => entry.to === "role@example.com")?.url ?? "",
      );
      expect(
        (await client.post("/reset-password", { token, newPassword: NEW_PASSWORD })).status,
      ).toBe(200);
      expect(
        (await client.post("/sign-in/email", { email: "role@example.com", password: NEW_PASSWORD }))
          .status,
      ).toBe(200);
      expect((await client.post("/sign-out")).status).toBe(200);
    });
  }, 120_000);

  it("cannot create, alter, drop or truncate anything, or make itself more powerful", async () => {
    await database.asAppRole(async () => {
      const denied = /permission denied|must be owner/i;
      await expect(database.client.exec("CREATE TABLE public.zz_probe (id int)")).rejects.toThrow(
        denied,
      );
      await expect(database.client.exec("CREATE SCHEMA zz_probe")).rejects.toThrow(denied);
      await expect(
        database.client.exec("ALTER TABLE public.users ADD COLUMN zz_probe int"),
      ).rejects.toThrow(denied);
      await expect(database.client.exec("DROP TABLE public.users")).rejects.toThrow(denied);
      await expect(database.client.exec("TRUNCATE public.users")).rejects.toThrow(denied);
      await expect(
        database.client.exec("DROP POLICY zerocorps_app_all ON public.users"),
      ).rejects.toThrow(denied);
      await expect(
        database.client.exec("ALTER TABLE public.users DISABLE ROW LEVEL SECURITY"),
      ).rejects.toThrow(denied);
      await expect(database.client.exec("ALTER ROLE zerocorps_app BYPASSRLS")).rejects.toThrow(
        denied,
      );
      await expect(database.client.exec("CREATE ROLE zz_probe")).rejects.toThrow(denied);
    });
  }, 60_000);

  it("cannot read anything outside the app's tables, such as the migration history", async () => {
    await database.asAppRole(async () => {
      await expect(
        database.client.query("SELECT * FROM drizzle.__drizzle_migrations"),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  it("holds no special attribute and belongs to no other role", async () => {
    const { rows } = await database.client.query<Record<string, unknown>>(
      `SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin,
              (SELECT count(*)::int FROM pg_auth_members WHERE member = r.oid) AS memberships
       FROM pg_roles r WHERE rolname = 'zerocorps_app'`,
    );
    expect(rows[0]).toEqual({
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolbypassrls: false,
      // No password is ever committed: the owner switches login on by hand.
      rolcanlogin: false,
      memberships: 0,
    });
  });
});

describe("schema invariants that every future migration must keep", () => {
  it("has row-level security, the app policy and the four grants on every table", async () => {
    const { rows } = await database.client.query<{
      table_name: string;
      rls: boolean;
      has_policy: boolean;
      can_use: boolean;
      owned_by_app: boolean;
    }>(
      `SELECT c.relname AS table_name,
              c.relrowsecurity AS rls,
              EXISTS (SELECT 1 FROM pg_policies p
                      WHERE p.schemaname = 'public' AND p.tablename = c.relname
                        AND 'zerocorps_app' = ANY (p.roles)) AS has_policy,
              has_table_privilege('zerocorps_app', c.oid, 'SELECT')
                AND has_table_privilege('zerocorps_app', c.oid, 'INSERT')
                AND has_table_privilege('zerocorps_app', c.oid, 'UPDATE')
                AND has_table_privilege('zerocorps_app', c.oid, 'DELETE') AS can_use,
              pg_get_userbyid(c.relowner) = 'zerocorps_app' AS owned_by_app
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       ORDER BY 1`,
    );
    expect(rows.map((row) => row.table_name)).toEqual([
      "accounts",
      "rate_limits",
      "sessions",
      "users",
      "verifications",
    ]);
    for (const row of rows) {
      expect(row, row.table_name).toMatchObject({
        rls: true,
        has_policy: true,
        can_use: true,
        owned_by_app: false,
      });
    }
  });

  it("opens a table through the policy, not through the grant alone", async () => {
    await createVerifiedUser("policy@example.com");
    await database.client.exec(
      "CREATE ROLE zz_granted_only NOLOGIN; GRANT USAGE ON SCHEMA public TO zz_granted_only; GRANT SELECT ON public.users TO zz_granted_only;",
    );
    await database.client.exec("SET ROLE zz_granted_only");
    try {
      const { rows } = await database.client.query<{ visible: number }>(
        "SELECT count(*)::int AS visible FROM users",
      );
      expect(rows[0]?.visible).toBe(0);
    } finally {
      await database.client.exec("RESET ROLE");
    }
    await database.asAppRole(async () => {
      const { rows } = await database.client.query<{ visible: number }>(
        "SELECT count(*)::int AS visible FROM users",
      );
      expect(rows[0]?.visible).toBeGreaterThan(0);
    });
  });
});
