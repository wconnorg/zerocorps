import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// There is ONE real database and it is production. Tests run on PGlite, a Postgres
// inside the test process. As a second lock, the test runner never sees the real
// URLs: these names cannot resolve (`.invalid` is reserved for exactly that), so even
// a test that reached for the real client could not connect to anything.
const UNREACHABLE = "postgres://tests.never-connect.invalid:6543/postgres";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Vitest's default is 5 seconds, which suits a pure unit test. Many tests here start a
    // whole Postgres (PGlite) inside the process, and on the owner's laptop that alone can
    // take longer than 5 seconds when anything else is running. Twice on 2026-09-21 a
    // database test timed out during a release check while the laptop was busy, each time
    // with nothing wrong in the code. A slow machine must not read as a broken build. The
    // slowest tests still name their own, longer timeout.
    testTimeout: 60_000,
    env: {
      DATABASE_URL: UNREACHABLE,
      DATABASE_URL_MIGRATIONS: UNREACHABLE,
    },
  },
});
