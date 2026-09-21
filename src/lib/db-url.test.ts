import { describe, expect, it } from "vitest";
import { diagnoseDatabaseUrl } from "./db-url";

const HOST = "aws-0-eu-example-1.pooler.supabase.com";
const app = (password: string, user = "zerocorps_app.exampleref", port = 6543) =>
  `postgresql://${user}:${password}@${HOST}:${port}/postgres`;

describe("diagnoseDatabaseUrl", () => {
  it("accepts a well-formed app URL and names the role", () => {
    const result = diagnoseDatabaseUrl(app("Letters0nly"), "app");
    expect(result).toMatchObject({ ok: true, parses: true, problems: [], role: "zerocorps_app" });
  });

  it("accepts a well-formed migrations URL on the session pooler port", () => {
    expect(
      diagnoseDatabaseUrl(app("Letters0nly", "postgres.exampleref", 5432), "migrations").ok,
    ).toBe(true);
  });

  it("reports blank", () => {
    expect(diagnoseDatabaseUrl("  ", "app")).toMatchObject({ ok: false, parses: false });
  });

  it("explains a password that cuts the URL short", () => {
    const result = diagnoseDatabaseUrl(app("pa/ss#word?x"), "app");
    expect(result.parses).toBe(false);
    expect(result.problems.join(" ")).toMatch(/contains \/ \? or #/);
    expect(result.problems.join(" ")).toMatch(/does not parse as a URL/);
    expect(result.problems.join(" ")).toMatch(/letters and numbers only/);
  });

  it("spots the brackets left over from the dashboard placeholder", () => {
    expect(diagnoseDatabaseUrl(app("[Letters0nly]"), "app").problems.join(" ")).toMatch(
      /square brackets/,
    );
    expect(diagnoseDatabaseUrl(app("[YOUR-PASSWORD]"), "app").problems.join(" ")).toMatch(
      /placeholder/,
    );
  });

  it("warns about a $ sign, which Next.js would expand", () => {
    expect(diagnoseDatabaseUrl(app("pa$sword"), "app").problems.join(" ")).toMatch(/\$ sign/);
  });

  it("checks the port for each kind of URL", () => {
    expect(
      diagnoseDatabaseUrl(app("Letters0nly", "zerocorps_app.exampleref", 5432), "app").problems[0],
    ).toMatch(/TRANSACTION pooler, port 6543/);
    expect(
      diagnoseDatabaseUrl(app("Letters0nly", "postgres.exampleref", 6543), "migrations")
        .problems[0],
    ).toMatch(/SESSION pooler, port 5432/);
  });

  it("checks the username form, the host and the database name", () => {
    expect(diagnoseDatabaseUrl(app("Letters0nly", "postgres"), "app").problems.join(" ")).toMatch(
      /role\.projectref/,
    );
    expect(
      diagnoseDatabaseUrl(
        "postgresql://postgres.exampleref:Letters0nly@db.example.com:6543/postgres",
        "app",
      ).problems.join(" "),
    ).toMatch(/not a Supabase pooler host/);
    expect(
      diagnoseDatabaseUrl(
        `postgresql://postgres.exampleref:Letters0nly@${HOST}:6543/other`,
        "app",
      ).problems.join(" "),
    ).toMatch(/not \/postgres/);
  });

  it("never echoes any part of the URL back", () => {
    const secretish = ["S3cretPassw0rd", "exampleref", "zerocorps_app", HOST, "eu-example"];
    const inputs = [
      app("S3cretPassw0rd"),
      app("S3cret/Passw0rd"),
      app("[S3cretPassw0rd]"),
      app("S3cret$Passw0rd"),
      app("S3cretPassw0rd", "zerocorps_app.exampleref", 1234),
      `mysql://zerocorps_app.exampleref:S3cretPassw0rd@${HOST}:6543/postgres`,
      "S3cretPassw0rd",
    ];
    for (const input of inputs) {
      const text = diagnoseDatabaseUrl(input, "app").problems.join(" ");
      for (const fragment of secretish) expect(text).not.toContain(fragment);
    }
  });
});
