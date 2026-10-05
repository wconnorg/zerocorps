// Drives the site in headless Microsoft Edge and checks what a visitor would see:
// response headers, the dark-only look and the way to Discord, navigation, horizontal
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

// ── 2. Dark only, and the way to Discord in the header ──────────────────────
// The site is dark only (owner, 2026-10-04). A visitor who once chose the light theme still
// carries its old cookie, so this visit does too: it must change nothing.
{
  console.log("\n== dark only, and Discord ==");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: "zc-theme", value: "light", domain: new URL(base).hostname, path: "/" },
  ]);
  const page = await context.newPage();
  watch(page, "dark-only");

  const firstResponse = await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const tls = await firstResponse.securityDetails();
  // Plain http has no certificate, but some browser builds still return an empty object.
  if (base.startsWith("https:") && tls?.validTo) {
    const days = Math.round((tls.validTo - Date.now() / 1000) / 86400);
    console.log(`  certificate: "${tls.subjectName}", ${tls.protocol}, ${days} days left`);
    note(days > 0, "certificate is valid");
  }

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  note(
    background === "rgb(5, 5, 5)",
    `the page is dark, even with an old light-theme cookie (${background})`,
  );
  note(
    (await page.getByRole("button", { name: "Switch colour theme" }).count()) === 0,
    "there is no theme switch",
  );
  const html = await (await context.request.get(`${base}/`)).text();
  note(!html.includes("zc-theme"), "the server sends no theme script");

  // The way to Discord, at the header's right. The live site must have it; a server without
  // an invite configured shows none.
  const discordIn = (where) =>
    where.locator("header").getByRole("link", { name: "ZeroCorps on Discord" });
  const links = await discordIn(page).count();
  const href = links > 0 ? await discordIn(page).first().getAttribute("href") : null;
  note(
    links === 0
      ? !base.startsWith("https:")
      : /^https:\/\/(discord\.gg|discord\.com\/invite)\//.test(href ?? ""),
    links === 0
      ? "no Discord link in the header (no invite configured on this server)"
      : `the header links to Discord (${new URL(href).host})`,
  );
  // YouTube and X sit beside Discord (owner, 2026-10-05): links once their addresses are
  // set, "coming soon" marks until then.
  for (const [name, pattern] of [
    ["YouTube", /^https:\/\/(www\.)?youtube\.com\//],
    ["X", /^https:\/\/x\.com\//],
  ]) {
    const link = page.locator("header").getByRole("link", { name: `ZeroCorps on ${name}` });
    if ((await link.count()) > 0) {
      note(
        pattern.test((await link.first().getAttribute("href")) ?? ""),
        `the header links to ${name}`,
      );
    } else {
      const mark = page
        .locator("header")
        .getByRole("img", { name: `ZeroCorps on ${name}: coming soon` });
      note(
        (await mark.count()) > 0 && (await mark.first().isVisible()),
        `the header shows ${name}'s mark, marked coming soon (no address yet)`,
      );
    }
  }
  // The wordmark leads to the dashboard on every page (owner, 2026-10-05).
  const wordmarkHref = () =>
    page
      .locator("header")
      .getByRole("link", { name: "ZeroCorps dashboard" })
      .first()
      .getAttribute("href");
  note((await wordmarkHref()) === "/dashboard", "the header's wordmark leads to the dashboard");
  await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
  note(
    (await discordIn(page).count()) === links,
    "the sign-in pages' header has the same way to Discord",
  );
  note(
    (await wordmarkHref()) === "/dashboard",
    "the sign-in pages' wordmark leads to the dashboard too",
  );
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
      .filter((href) => href !== "/dashboard"),
  );
  note(
    otherLinks.length === 0,
    `every link in the home page body is a way in, to /dashboard (others: ${JSON.stringify(otherLinks)})`,
  );
  note(
    (await page.getByRole("heading", { level: 1 }).textContent())?.trim() === "ZEROCORPS",
    "the home page's heading is the name, not the Academy's",
  );
  note(
    await page.getByRole("link", { name: "Enter the dashboard" }).isVisible(),
    'the hero button is "Enter the dashboard"',
  );

  // Every way in on the home page lands a signed-out visitor on sign-in, with the way back
  // to the dashboard remembered, and sign-in offers to create an account. The Academy's row
  // is a way IN (owner, 2026-09-21), not a link to the page about the Academy.
  for (const name of ["Enter the dashboard", "Enter ZeroCorps Academy"]) {
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
  // The form reads ?next= from the address bar, so it appears a moment after the page does.
  const offersSignUp = await page
    .getByRole("link", { name: "Create an account" })
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  note(offersSignUp, "the sign-in page offers to create an account");

  // A link that tries to leave the site through ?next= ends up on the dashboard road.
  await page.goto(`${base}/sign-in?next=/.//evil.example`, { waitUntil: "networkidle" });
  note(
    await page.getByLabel("Email address").isVisible(),
    "/sign-in?next=/.//evil.example still renders the form (the unsafe path is ignored)",
  );

  // An account is reached through sign-in, which offers to create one.
  await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
  note(
    await page.getByRole("heading", { level: 1, name: "Sign in" }).isVisible(),
    "/sign-in renders",
  );
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.waitForURL("**/sign-up");
  const signUpHeading = (await page.getByRole("heading", { level: 1 }).textContent())?.trim();
  note(
    ["Create your account", "Sign-ups open soon"].includes(signUpHeading ?? ""),
    `/sign-up renders ("${signUpHeading}")`,
  );
  note((await page.title()).includes("ZeroCorps"), `page title: "${await page.title()}"`);

  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  note(focused === "Skip to content", `first Tab focuses the skip link ("${focused}")`);
  await context.close();
}

// ── 3b. The landing page: one screen, the divisions listed once ─────────────
{
  console.log("\n== landing page ==");
  /**
   * What is drawn, measured in the page itself: the two panels, the footer and the rows.
   * Anything missing comes back as null, so a page that is not the landing page (a release
   * that was never built, an error page) reads as FAIL lines and not as a crash.
   */
  const measure = (page) =>
    page.evaluate(() => {
      const box = (element) => {
        if (!element) return null;
        const { top, right, bottom, left, height } = element.getBoundingClientRect();
        return { top, right, bottom, left, height };
      };
      const [name, divisions] = [...document.querySelectorAll("main section")].map(box);
      return {
        name: name ?? null,
        divisions: divisions ?? null,
        footer: box(document.querySelector("footer")),
        windowHeight: window.innerHeight,
        pageHeight: document.documentElement.scrollHeight,
        links: [...document.querySelectorAll("main a")].map((link) => box(link).height),
        rows: [...document.querySelectorAll("main li")].map((row) => {
          const toned = row.querySelector(".tone-text");
          // The words (the name and its line) and, after them, the status.
          const words = row.querySelector("h3")?.parentElement;
          const [wordsBox, statusBox] = [box(words), box(words?.nextElementSibling)];
          return {
            name: row.querySelector("h3")?.textContent ?? null,
            colour: toned ? getComputedStyle(toned).color : null,
            statusBeside: Boolean(
              wordsBox &&
              statusBox &&
              statusBox.left >= wordsBox.right - 1 &&
              statusBox.top < wordsBox.bottom,
            ),
          };
        }),
      };
    });
  /** The name is one word that cannot wrap: its width, and the room its heading has. */
  const nameFits = (page) =>
    page.evaluate(() => {
      const heading = document.querySelector("main h1");
      if (!heading) return { fits: false, name: null, room: null, overflow: null };
      const text = document.createRange();
      text.selectNodeContents(heading);
      const name = Math.round(text.getBoundingClientRect().width);
      const room = Math.round(heading.getBoundingClientRect().width);
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { fits: name <= room && overflow <= 0, name, room, overflow };
    });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watch(page, "landing");
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const wide = await measure(page);

  const drawn = Boolean(wide.name && wide.divisions && wide.footer);
  note(drawn, "the landing page has its two panels and the footer");
  const names = JSON.stringify(wide.rows.map((row) => row.name));
  note(
    names === JSON.stringify(["ZeroCorps Academy", "ZeroBot", "ZeroCharts"]),
    `the three divisions are listed once, the Academy first (${names})`,
  );
  const colours = wide.rows.map((row) => row.colour);
  note(
    new Set(colours).size === 3 && !colours.includes(null),
    `each division's name is in its own tone (${colours.join(" / ")})`,
  );
  note(
    drawn && wide.pageHeight <= wide.windowHeight,
    `on a desktop the page is one screen, with nothing to scroll (${wide.pageHeight}px in a ${wide.windowHeight}px window)`,
  );
  note(
    drawn &&
      wide.divisions.left >= wide.name.right &&
      Math.abs(wide.divisions.top - wide.name.top) <= 1,
    "on a desktop the two panels stand side by side",
  );
  note(
    drawn &&
      Math.abs(wide.name.bottom - wide.footer.top) <= 1 &&
      Math.abs(wide.footer.bottom - wide.windowHeight) <= 1,
    "the panels reach down to the footer, and the footer ends at the bottom of the window",
  );

  // Side by side the name has half the window: least of it where the two columns begin.
  // A classic scrollbar takes about 17px there while the two-column rule still applies, so
  // one is imitated. The name must still fit, and no status may drop under its name while
  // another stays beside it.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => {
    document.body.style.paddingRight = "17px";
  });
  const tightName = await nameFits(page);
  note(
    tightName.fits,
    `at 1024px wide, with a scrollbar's width taken, the name fits its panel (${tightName.name}px of ${tightName.room}px)`,
  );
  const tight = await measure(page);
  note(
    tight.rows.length === 3 && tight.rows.every((row) => row.statusBeside),
    "at 1024px wide every division's status stands beside its name",
  );
  await context.close();

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const phonePage = await phone.newPage();
  watch(phonePage, "landing-phone");
  await phonePage.goto(`${base}/`, { waitUntil: "networkidle" });
  const narrow = await measure(phonePage);
  note(
    Boolean(narrow.name && narrow.divisions) &&
      narrow.divisions.top >= narrow.name.bottom &&
      narrow.divisions.left === narrow.name.left,
    "on a phone the divisions come under the name",
  );
  note(
    narrow.links.length === 2 && narrow.links.every((height) => height >= 44),
    `on a phone both ways in are big enough for a thumb (${narrow.links.map(Math.round).join("px, ")}px tall)`,
  );

  // Stacked, the name has the whole window, and the narrowest phone is where it would stick out.
  await phonePage.setViewportSize({ width: 320, height: 568 });
  const smallest = await nameFits(phonePage);
  note(
    smallest.fits,
    `at 320px wide the name still fits (${smallest.name}px of ${smallest.room}px) and nothing overflows (${smallest.overflow}px)`,
  );
  await phone.close();
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

  // Every signed-in page sends a signed-out visitor to sign in, and remembers where they
  // were going. The dashboard goes last: the checks after the loop look at its sign-in page.
  // /academy itself too (owner, 2026-09-29): the Academy is for members, and every
  // address under it leads a visitor in through sign-in.
  for (const path of [
    "/onboarding",
    "/settings",
    "/academy",
    "/academy/ranks",
    "/academy/how-markets-work",
    "/academy/how-markets-work/orders-and-fills",
    "/dashboard",
  ]) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    note(
      new URL(page.url()).pathname === "/sign-in" &&
        new URL(page.url()).searchParams.get("next") === path,
      `${path} sends a signed-out visitor to sign in (${new URL(page.url()).pathname}${new URL(page.url()).search})`,
    );
  }
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

// ── 5. Screenshots: desktop and phone (the site is dark only) ───────────────
{
  console.log("\n== screenshots ==");
  const devices = [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ];
  const pages = [
    ["home", "/"],
    ["sign-up", "/sign-up"],
    ["sign-up-verify", "/sign-up/verify"],
    ["sign-in", "/sign-in"],
    ["two-factor", "/two-factor"],
    ["forgot-password", "/forgot-password"],
    ["reset-password", "/reset-password"],
    ["terms", "/terms"],
    ["privacy", "/privacy"],
    ["404", MISSING_PAGE],
  ];

  for (const [device, viewport] of devices) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: device === "mobile" ? 2 : 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    watch(page, device);

    for (const [name, path] of pages) {
      await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      note(overflow <= 0, `${device} ${path}: no horizontal overflow (${overflow}px)`);
      await page.screenshot({ path: join(shots, `${name}-${device}.png`), fullPage: true });
    }
    await context.close();
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
