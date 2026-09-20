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
    env: {
      DATABASE_URL: UNREACHABLE,
      DATABASE_URL_MIGRATIONS: UNREACHABLE,
    },
  },
});
