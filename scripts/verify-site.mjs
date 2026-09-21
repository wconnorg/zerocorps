// Drives the site in headless Microsoft Edge and checks what a visitor would see:
// response headers, both themes, no flash on reload, navigation, horizontal
// overflow on desktop and phone sizes, and browser console errors. It also saves
// full-page screenshots to look at afterwards.
//
//   node scripts/verify-site.mjs                           # http://localhost:3000
//   node scripts/verify-site.mjs https://zerocorps.org live
//
// The second argument is a label: screenshots go to .verify/<label>/ (gitignored).
// Start the server first for local runs. Exits non-zero if any check fails.
// Uses the installed Edge through playwright-core, so no browser is downloaded.
// Extend the checks whenever a milestone adds pages or flows.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const label = process.argv[3] ?? "local";
const shots = join(import.meta.dirname, "..", ".verify", label);
mkdirSync(shots, { recursive: true });

const MISSING_PAGE = "/this-page-does-not-exist";
const problems = [];
const note = (ok, message) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${message}`);
  if (!ok) problems.push(message);
};

const browser = await chromium.launch({ channel: "msedge", headless: true });

/** Reports console errors, page errors and failed requests as problems. */
function watch(page, tag) {
  page.on("console", (message) => {
    // Visiting a missing page on purpose logs the 404 for the document itself.
    if (page.url().endsWith(MISSING_PAGE) && message.text().includes("404")) return;
    if (message.type() !== "error" && message.type() !== "warning") return;
    console.log(`  [console.${message.type()}] (${tag}) ${message.text().slice(0, 300)}`);
    if (message.type() === "error") {
      problems.push(`console error on ${tag}: ${message.text().slice(0, 200)}`);
    }
  });
  page.on("pageerror", (error) => {
    console.log(`  [pageerror] (${tag}) ${error.message}`);
    problems.push(`page error on ${tag}: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText;
    // A signed-out visitor who CLICKS a protected link: the server answers the router's
    // request with a redirect to sign-in, and the browser drops that request to follow it.
    // That is how it should work. The same failure at any other moment is still a problem
    // (it would mean the link is being pre-loaded again: a wasted request on every visit).
    const url = new URL(request.url());
    if (
      clickingAProtectedLink &&
      errorText === "net::ERR_ABORTED" &&
      url.pathname === "/dashboard" &&
      url.searchParams.has("_rsc")
    ) {
      return console.log(
        `  [expected] (${tag}) the router's request for /dashboard was redirected`,
      );
    }
    console.log(`  [requestfailed] (${tag}) ${request.url()} ${errorText}`);
    problems.push(`request failed on ${tag}: ${request.url()}`);
  });
}

/** True only while the script itself clicks a protected link as a signed-out visitor. */
let clickingAProtectedLink = false;

// ── 1. Headers and metadata routes ──────────────────────────────────────────
{
  const context = await browser.newContext();
  const headers = (await context.request.get(`${base}/`)).headers();
  console.log("\n== response headers on / ==");
  for (const name of [
    "content-security-policy",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "cross-origin-opener-policy",
    "permissions-policy",
    "strict-transport-security",
    "x-powered-by",
  ]) {
    console.log(`  ${name}: ${headers[name] ?? "(absent)"}`);
  }
  note(Boolean(headers["content-security-policy"]), "CSP header present");
  note(headers["x-powered-by"] === undefined, "X-Powered-By header removed");
  note(headers["x-frame-options"] === "DENY", "X-Frame-Options is DENY");

  for (const path of ["/robots.txt", "/sitemap.xml", "/icon.png"]) {
    const response = await context.request.get(`${base}${path}`);
    note(response.status() === 200, `${path} -> ${response.status()}`);
  }
  const missing = await context.request.get(`${base}${MISSING_PAGE}`);
  note(missing.status() === 404, `unknown path -> ${missing.status()}`);
  await context.close();
}

// ── 2. Theme: default, toggle, persistence, no flash ────────────────────────
{
  console.log("\n== theme behaviour ==");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watch(page, "theme-flow");

  const firstResponse = await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const tls = await firstResponse.securityDetails();
  // Plain http has no certificate, but some browser builds still return an empty object.
  if (base.startsWith("https:") && tls?.validTo) {
    const days = Math.round((tls.validTo - Date.now() / 1000) / 86400);
    console.log(`  certificate: "${tls.subjectName}", ${tls.protocol}, ${days} days left`);
    note(days > 0, "certificate is valid");
  }

  const theme = () => page.getAttribute("html", "data-theme");
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  note((await theme()) === "dark", "first visit renders the dark theme");
  const darkBackground = await background();

  await page.getByRole("button", { name: "Switch colour theme" }).click();
  note((await theme()) === "light", "toggle switches to light");
  note(darkBackground !== (await background()), "the background actually changes");

  const cookie = (await context.cookies()).find((entry) => entry.name === "zc-theme");
  note(cookie?.value === "light", `cookie zc-theme=${cookie?.value}, sameSite=${cookie?.sameSite}`);

  // Reload. Record the attribute the instant the DOM is parsed, before React
  // hydrates, and again once everything has settled.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      window.__themeAtParse = document.documentElement.getAttribute("data-theme");
    });
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const atParse = await page.evaluate(() => window.__themeAtParse);
  note(atParse === "light", `saved theme applied before hydration (at parse: ${atParse})`);
  note((await theme()) === "light", "saved theme survives hydration");

  // The HTML the server sends must stay the static dark default.
  const html = await (await context.request.get(`${base}/`)).text();
  note(/<html[^>]*data-theme="dark"/.test(html), "server HTML carries the dark default (static)");

  await page.getByRole("link", { name: "Terms", exact: true }).first().click();
  await page.waitForURL("**/terms");
  note((await theme()) === "light", "theme persists across client-side navigation");
  await context.close();
}

// ── 3. Navigation ───────────────────────────────────────────────────────────
{
  console.log("\n== navigation ==");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watch(page, "nav-flow");

  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const otherLinks = await page.evaluate(() =>
    [...document.querySelectorAll("main a")]
      .map((anchor) => anchor.getAttribute("href"))
      .filter((href) => href !== "/dashboard" && href !== "/academy"),
  );
  note(
    otherLinks.length === 0,
    `every link in the home page body goes to /dashboard or /academy (others: ${JSON.stringify(otherLinks)})`,
  );
  note(
    (await page.getByRole("heading", { level: 1 }).textContent())?.trim() === "ZEROCORPS",
    "the home page's heading is the name, not the Academy's",
  );
  note(
    await page.getByRole("link", { name: "Enter the dashboard" }).isVisible(),
    'the hero button is "Enter the dashboard"',
  );

  // A signed-out visitor lands on sign-in, with the way back to the dashboard remembered,
  // and sign-in offers to create an account.
  for (const name of ["Enter the dashboard"]) {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    clickingAProtectedLink = true;
    await page.getByRole("link", { name }).first().click();
    await page.waitForURL("**/sign-in**");
    await page.waitForLoadState("networkidle");
    clickingAProtectedLink = false;
    const landed = new URL(page.url());
    note(
      landed.pathname === "/sign-in" && landed.searchParams.get("next") === "/dashboard",
      `"${name}" sends a signed-out visitor to sign in, then back (${landed.pathname}${landed.search})`,
    );
  }
  note(
    await page.getByRole("link", { name: "Create an account" }).isVisible(),
    "the sign-in page offers to create an account",
  );

  // The public page about the Academy is reachable from the home page without an account.
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Enter here: ZeroCorps Academy" }).first().click();
  await page.waitForURL("**/academy");
  note(await page.getByRole("heading", { level: 1 }).isVisible(), "/academy shows its heading");

  // A link that tries to leave the site through ?next= ends up on the dashboard road.
  await page.goto(`${base}/sign-in?next=/.//evil.example`, { waitUntil: "networkidle" });
  note(
    await page.getByLabel("Email address").isVisible(),
    "/sign-in?next=/.//evil.example still renders the form (the unsafe path is ignored)",
  );
  await page.goto(`${base}/academy`, { waitUntil: "networkidle" });

  await page.getByRole("link", { name: "Sign up" }).click();
  await page.waitForURL("**/sign-up");
  const signUpHeading = (await page.getByRole("heading", { level: 1 }).textContent())?.trim();
  note(
    ["Create your account", "Sign-ups open soon"].includes(signUpHeading ?? ""),
    `/sign-up renders ("${signUpHeading}")`,
  );

  await page.goto(`${base}/academy`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.waitForURL("**/sign-in");
  note(
    await page.getByRole("heading", { level: 1, name: "Sign in" }).isVisible(),
    "/sign-in renders",
  );
  note((await page.title()).includes("ZeroCorps"), `page title: "${await page.title()}"`);

  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  note(focused === "Skip to content", `first Tab focuses the skip link ("${focused}")`);
  await context.close();
}

// ── 3b. The product wheel on the home page ─────────────────────────────────
{
  console.log("\n== product wheel ==");
  const frontOf = (page) =>
    page.evaluate(() =>
      document.querySelector('.wheel-tile[data-pos="0"]')?.getAttribute("aria-label"),
    );

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watch(page, "wheel");
  await page.goto(`${base}/`, { waitUntil: "networkidle" });

  const slides = await page.evaluate(() =>
    [...document.querySelectorAll(".wheel-tile")].map((tile) => tile.getAttribute("aria-label")),
  );
  note(
    JSON.stringify(slides) ===
      JSON.stringify(["1 of 3: ZeroBot", "2 of 3: ZeroCharts", "3 of 3: ZeroCorps Academy"]),
    `the wheel has its three tiles (${JSON.stringify(slides)})`,
  );

  // Left alone, it turns by itself (the timer is 8 seconds).
  const first = await frontOf(page);
  await page.mouse.move(5, 5);
  let turned = first;
  for (let i = 0; i < 48 && turned === first; i++) {
    await page.waitForTimeout(250);
    turned = await frontOf(page);
  }
  note(turned !== first, `the wheel turns by itself (${first} -> ${turned})`);

  // With the pointer resting on it, it holds still; a click at the side brings that tile forward.
  await page.hover(".wheel");
  await page.waitForTimeout(2600);
  const held = await frontOf(page);
  await page.locator(".wheel-hit-right").click();
  await page.waitForTimeout(600);
  const clicked = await frontOf(page);
  note(
    clicked !== held,
    `a click at the side brings that tile to the front (${held} -> ${clicked})`,
  );
  await context.close();

  // A visitor who asked for reduced motion never gets a wheel that turns by itself.
  const calm = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const calmPage = await calm.newPage();
  watch(calmPage, "wheel-reduced-motion");
  await calmPage.goto(`${base}/`, { waitUntil: "networkidle" });
  const before = await frontOf(calmPage);
  await calmPage.waitForTimeout(9500);
  note(
    (await frontOf(calmPage)) === before,
    "with reduced motion the wheel does not turn by itself",
  );
  await calm.close();
}

// ── 4. Accounts: what a signed-out visitor can and cannot reach ─────────────
// Nothing here creates an account or signs anyone in: there is ONE database, shared with
// the live site. The owner tests the sign-up itself by hand.
{
  console.log("\n== accounts ==");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watch(page, "accounts");

  const signInHeaders = (await context.request.get(`${base}/sign-in`)).headers();
  const csp = signInHeaders["content-security-policy"] ?? "";
  note(
    csp.includes("frame-ancestors 'none'"),
    "/sign-in cannot be framed (frame-ancestors 'none')",
  );
  note(
    csp.includes("form-action 'self'"),
    "/sign-in forms can only post to this site (form-action 'self')",
  );

  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  note(
    new URL(page.url()).pathname === "/sign-in" &&
      new URL(page.url()).searchParams.get("next") === "/dashboard",
    `/dashboard sends a signed-out visitor to sign in (${new URL(page.url()).pathname}${new URL(page.url()).search})`,
  );
  note(await page.getByLabel("Email address").isVisible(), "/sign-in shows the form");
  note(
    (await page.getByLabel("Password", { exact: true }).getAttribute("autocomplete")) ===
      "current-password",
    "the password field is marked for password managers",
  );

  await page.goto(`${base}/reset-password`, { waitUntil: "networkidle" });
  note(
    await page.getByText("This reset link is incomplete").isVisible(),
    "/reset-password without a token explains itself",
  );

  await page.goto(`${base}/sign-up/verify`, { waitUntil: "networkidle" });
  note(
    await page.getByRole("link", { name: "Start again" }).isVisible(),
    "/sign-up/verify without a sign-up in progress offers to start again",
  );

  for (const path of ["/terms", "/privacy"]) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    note(
      await page.getByText("Draft.", { exact: true }).isVisible(),
      `${path} is marked as a draft`,
    );
  }

  const cron = await context.request.get(`${base}/api/cron/cleanup`);
  note(
    cron.status() === 401,
    `the cleanup route refuses a caller without the secret (${cron.status()})`,
  );
  const wrongSecret = await context.request.get(`${base}/api/cron/cleanup`, {
    headers: { authorization: "Bearer not-the-secret" },
  });
  note(wrongSecret.status() === 401, `...and one with the wrong secret (${wrongSecret.status()})`);

  const securityTxt = await context.request.get(`${base}/.well-known/security.txt`);
  note(
    [200, 404].includes(securityTxt.status()),
    `security.txt answers (${securityTxt.status()}: ${securityTxt.status() === 200 ? "published" : "no SECURITY_CONTACT set here"})`,
  );
  if (securityTxt.status() === 200) {
    const body = await securityTxt.text();
    note(
      /^Contact: /m.test(body) && /^Expires: /m.test(body),
      "security.txt has Contact and Expires",
    );
  }
  await context.close();
}

// ── 5. Screenshots: both themes, desktop and phone ──────────────────────────
{
  console.log("\n== screenshots ==");
  const { hostname } = new URL(base);
  const devices = [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ];
  const pages = [
    ["home", "/"],
    ["academy", "/academy"],
    ["sign-up", "/sign-up"],
    ["sign-up-verify", "/sign-up/verify"],
    ["sign-in", "/sign-in"],
    ["forgot-password", "/forgot-password"],
    ["reset-password", "/reset-password"],
    ["terms", "/terms"],
    ["privacy", "/privacy"],
    ["404", MISSING_PAGE],
  ];

  for (const [device, viewport] of devices) {
    for (const theme of ["dark", "light"]) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: device === "mobile" ? 2 : 1,
        reducedMotion: "reduce",
      });
      await context.addCookies([{ name: "zc-theme", value: theme, domain: hostname, path: "/" }]);
      const page = await context.newPage();
      watch(page, `${device}-${theme}`);

      for (const [name, path] of pages) {
        await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        note(overflow <= 0, `${device}/${theme} ${path}: no horizontal overflow (${overflow}px)`);
        await page.screenshot({
          path: join(shots, `${name}-${device}-${theme}.png`),
          fullPage: true,
        });
      }
      await context.close();
    }
  }
}

await browser.close();
console.log(
  problems.length === 0
    ? "\nALL CHECKS PASSED"
    : `\n${problems.length} PROBLEM(S):\n - ${problems.join("\n - ")}`,
);
console.log(`screenshots: ${shots}`);
process.exit(problems.length === 0 ? 0 : 1);
