// npm run env:handoff
//
// Carries the values the host needs from this laptop to the host's settings page,
// one at a time, on the CLIPBOARD. No value is ever shown, written to a file or put in a
// command line: it goes to the clipboard program through its standard input, and the
// clipboard is cleared again as soon as you say you have pasted it.
//
//   BETTER_AUTH_SECRET, HMAC_SECRET, CRON_SECRET   NEW random values, made here. Never
//                                                  the laptop's: the host gets its own.
//   DATABASE_URL                                   the app's URL, and only if its role is
//                                                  zerocorps_app. Never the migrations URL.
//
// It changes nothing on this laptop. Run it with the host's settings page open.
//
//   npm run env:handoff                  all four, in order
//   npm run env:handoff -- CRON_SECRET   one of them again

import { spawn, spawnSync } from "node:child_process";
import { HANDOFF_KEYS, NEVER_ON_THE_HOST, valueForHost } from "../src/lib/env-handoff.ts";
import { readEnvFile } from "./lib/env-file.mjs";
import { ask, requireTerminal } from "./lib/prompt.mjs";

requireTerminal("npm run env:handoff");

const CLIPBOARD = {
  win32: ["clip.exe", []],
  darwin: ["pbcopy", []],
  linux: ["xclip", ["-selection", "clipboard"]],
}[process.platform];

if (!CLIPBOARD) {
  console.error("This command does not know the clipboard program on this system.");
  process.exit(1);
}

let valueOnClipboard = false;

/** Puts text on the clipboard through the program's standard input. "" clears it. */
function toClipboard(text) {
  // Marked before the copy starts, and unmarked only once a clear has succeeded.
  if (text !== "") valueOnClipboard = true;
  return new Promise((resolve, reject) => {
    const [command, args] = CLIPBOARD;
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`the clipboard program exited with code ${code}`));
      if (text === "") valueOnClipboard = false;
      resolve();
    });
    child.stdin.end(text);
  });
}

// However this ends (Ctrl+C at a question included), a value never stays on the clipboard.
// An exit handler cannot wait, so this one clears it synchronously.
process.on("exit", () => {
  if (valueOnClipboard) spawnSync(CLIPBOARD[0], CLIPBOARD[1], { input: "", stdio: "pipe" });
});
process.on("SIGINT", () => process.exit(130));

/** Windows keeps a clipboard HISTORY (Win+V) when it is switched on. Best effort. */
function clearWindowsClipboardHistory() {
  if (process.platform !== "win32") return Promise.resolve(null);
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "[Windows.ApplicationModel.DataTransfer.Clipboard, Windows.ApplicationModel.DataTransfer, ContentType=WindowsRuntime]::ClearHistory()",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.on("error", () => resolve(false));
    child.on("close", () => resolve(/true/i.test(output)));
  });
}

const env = readEnvFile();
const wanted = process.argv.slice(2);
const keys = wanted.length > 0 ? wanted : [...HANDOFF_KEYS];

console.log("Have the host's Environment Variables page open (Production, Sensitive).");
console.log("Nothing is shown here. Each value waits on the clipboard until you press Enter.\n");

let copied = 0;
try {
  for (const key of keys) {
    const handoff = valueForHost(key, env.get);
    if (!handoff.ok) {
      console.log(`SKIPPED  ${handoff.reason}\n`);
      continue;
    }
    await toClipboard(handoff.value);
    copied += 1;
    console.log(`${key} is on the clipboard: ${handoff.what}`);
    console.log(`  1. In the host's settings, add the key  ${key}`);
    console.log(
      "  2. Click into the value box and paste (Ctrl+V). Production only. Sensitive ON. Save.",
    );
    await ask("  3. Press Enter here once it is saved: ");
    await toClipboard("");
    console.log("  The clipboard is empty again.\n");
  }
} finally {
  // Whatever happened, including Ctrl+C, nothing is left behind.
  await toClipboard("").catch(() => {});
  const cleared = copied > 0 ? await clearWindowsClipboardHistory() : null;
  if (cleared === true) console.log("The Windows clipboard history (Win+V) was cleared as well.");
  if (cleared === false) {
    console.log(
      "Could not clear the Windows clipboard history. If you use Win+V, open it and press 'Clear all'.",
    );
  }
}

console.log(`Left on the laptop on purpose: ${NEVER_ON_THE_HOST.join(", ")}.`);
console.log("No value was shown or written anywhere. Nothing on this laptop was changed.");
