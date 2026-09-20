/**
 * Says what is wrong with a database URL without ever revealing it.
 *
 * The owner keeps connection strings in `.env.local` and they are never printed.
 * When one is malformed the owner still needs to know why, so this module answers
 * in fixed sentences only: no part of the URL is ever echoed back.
 *
 * This module has no imports on purpose: the scripts in `scripts/` load it directly.
 */

export type DatabaseUrlKind = "app" | "migrations";

export type DatabaseUrlDiagnosis = {
  /** True when the URL parses and nothing below needs fixing. */
  ok: boolean;
  /** True when `new URL()` accepts it, so a connection can at least be attempted. */
  parses: boolean;
  /** Fixed sentences. They never contain any part of the URL. */
  problems: string[];
  /** The role name in front of the project ref, for example `postgres`. Not a secret. */
  role: string | null;
};

const EXPECTED_PORT: Record<DatabaseUrlKind, string> = { app: "6543", migrations: "5432" };

export const PASSWORD_ADVICE =
  "Simplest fix: reset the database password to letters and numbers only (24 or more), then paste it " +
  "into the URL with nothing around it. Otherwise percent-encode each special character: " +
  "/ is %2F, ? is %3F, # is %23, @ is %40, : is %3A, % is %25, & is %26, + is %2B, = is %3D, " +
  "[ is %5B, ] is %5D, $ is %24, and a space is %20.";

export function diagnoseDatabaseUrl(raw: string, kind: DatabaseUrlKind): DatabaseUrlDiagnosis {
  const value = raw.trim();
  const problems: string[] = [];
  let role: string | null = null;

  if (value === "") return { ok: false, parses: false, problems: ["It is blank."], role };

  if (!/^postgres(ql)?:\/\//.test(value)) {
    problems.push("It does not start with postgres:// or postgresql://.");
  }
  if (/YOUR-PASSWORD|\[password\]/i.test(value)) {
    problems.push("It still contains the dashboard's password placeholder.");
  }
  if (/[[\]]/.test(value)) {
    problems.push(
      "It contains square brackets. Supabase shows the placeholder as [YOUR-PASSWORD]: the brackets " +
        "must go too, not only the words.",
    );
  }
  if (/\s/.test(value)) problems.push("It contains a space or a line break.");
  if (value.includes("$")) {
    problems.push(
      "It contains a $ sign, which Next.js reads as the start of a variable name and silently changes.",
    );
  }

  // Look at the password structurally: between the first colon of the userinfo and the last @.
  const schemeEnd = value.indexOf("://");
  const lastAt = value.lastIndexOf("@");
  if (schemeEnd >= 0 && lastAt > schemeEnd) {
    const userinfo = value.slice(schemeEnd + 3, lastAt);
    const colon = userinfo.indexOf(":");
    if (colon <= 0) {
      problems.push("It has no user:password pair before the @.");
    } else {
      const user = userinfo.slice(0, colon);
      const password = userinfo.slice(colon + 1);
      role = user.split(".")[0] ?? null;
      if (!/^[a-z_][a-z0-9_]*\.[a-z0-9]+$/i.test(user)) {
        problems.push(
          "The username is not in the pooler form role.projectref (for example postgres.abcd1234).",
        );
      }
      if (password === "") problems.push("The password is empty.");
      if (/[/?#]/.test(password)) {
        problems.push(
          "The password contains / ? or #, which cut the URL short so it cannot be parsed.",
        );
      } else if (/%(?![0-9a-fA-F]{2})/.test(password)) {
        problems.push("The password contains a % that is not part of a percent-encoding.");
      } else if (/[@: ]/.test(password)) {
        problems.push("The password contains @ : or a space, which must be percent-encoded.");
      }
    }
  } else {
    problems.push("It does not have the user:password@host shape.");
  }

  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    problems.push("It does not parse as a URL.");
  }

  if (url) {
    if (url.hostname === "") problems.push("It has no host.");
    else if (!/\.pooler\.supabase\.com$/.test(url.hostname)) {
      problems.push(
        "The host is not a Supabase pooler host (it should end in .pooler.supabase.com).",
      );
    }
    const wanted = EXPECTED_PORT[kind];
    if (url.port !== wanted) {
      problems.push(
        kind === "app"
          ? `The port is not ${wanted}. The app needs the TRANSACTION pooler, port ${wanted}.`
          : `The port is not ${wanted}. Migrations and backups need the SESSION pooler, port ${wanted}.`,
      );
    }
    if (url.pathname !== "/postgres")
      problems.push("The database name at the end is not /postgres.");
  }

  const needsPasswordAdvice = problems.some((problem) =>
    /password|\$ sign|brackets|does not parse/.test(problem),
  );
  if (needsPasswordAdvice) problems.push(PASSWORD_ADVICE);

  return { ok: problems.length === 0, parses: url !== null, problems, role };
}
