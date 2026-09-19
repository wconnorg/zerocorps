---
name: verify-site
description: Launch the zerocorps.org app (or target the live site) and drive it in headless Edge - response headers, both themes, navigation, phone-width overflow, console errors and full-page screenshots. Use to run, start or screenshot the app, or to confirm a change works in the real app before finishing a milestone.
---

# Verify the site in a real browser

Unit tests and a green build do not prove the pages work. At the end of every
milestone, and after any change to layout, theming, headers or routing, drive the
real app and **look at the screenshots**.

## 1. Start a server (skip this for the live site)

Development server, which also exercises the dev-only CSP allowances and React
Strict Mode:

```powershell
npx next dev --port 3000          # run in the background
```

Production build, which is what Vercel serves:

```powershell
npm run build
npx next start --port 3000        # run in the background
```

Wait for it by polling, never by sleeping a fixed time:

```powershell
foreach ($i in 1..120) { try { if ((Invoke-WebRequest -UseBasicParsing http://localhost:3000/ -TimeoutSec 30).StatusCode -eq 200) { break } } catch { Start-Sleep -Milliseconds 1500 } }
```

The dev server compiles each route on first request, which is slow on this
machine. Request `/academy`, `/sign-in` and `/sign-up` once before running the
checks so compile time does not skew them.

## 2. Drive it

```powershell
node scripts/verify-site.mjs http://localhost:3000 dev
node scripts/verify-site.mjs https://zerocorps.org live
```

Every line is `PASS` or `FAIL`, and the exit code is non-zero on any failure.
Screenshots land in `.verify/<label>/` (gitignored), as
`<page>-<desktop|mobile>-<dark|light>.png`. Open a few with the Read tool:
always a phone one, and always the light theme, because that is where problems
hide.

The script uses the installed Microsoft Edge through `playwright-core`
(`channel: "msedge"`), so no browser download is needed.

## 3. Stop the server

```powershell
$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($c) { Stop-Process -Id $c.OwningProcess -Force -Confirm:$false }
```

A background server stopped this way reports "failed, exit code 255". That is
the stop, not an error.

## Extending it

When a milestone adds pages or flows, add them to `scripts/verify-site.mjs`: new
pages to the screenshot list, new flows as their own numbered section. Sign-in
flows need a test account; create it through the app in the script rather than
hard-coding credentials.

## Things that went wrong here before

- The Bash tool on this machine has no `curl` or `mkdir`. Use PowerShell.
  `curl.exe` exists at `$env:SystemRoot\System32\curl.exe`.
- PowerShell's safety check can misread a command that combines `Remove-Item`
  with quoted paths or arguments. Put `Remove-Item` in its own command, and clear
  an environment variable with `$env:NAME = $null` instead.
- A visit to a missing page logs a 404 in the browser console. The script ignores
  that one on purpose.
- In development, Next.js shows a round "N" badge in a corner of screenshots. It
  is the dev indicator, not part of the site.
- To test a domain before DNS caches catch up, use
  `curl.exe --resolve "zerocorps.org:443:<ip>" https://zerocorps.org/`.
