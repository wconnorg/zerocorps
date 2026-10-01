// npm run brain:watch             keeps the brain up to date: now, then every 5 minutes
// npm run brain:watch -- 15       every 15 minutes
// npm run brain:watch -- 5 --academy   also passes --academy to each export
//
// Leave it running in a terminal while Obsidian is open: each round is one
// `npm run brain:export`, which rewrites only the notes that changed, and Obsidian shows
// the change at once. Press Ctrl+C to stop. A round that fails (no internet, say) is
// reported and tried again at the next one; nothing is ever shown but the export's counts.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const arguments_ = process.argv.slice(2);
const asked = Number(arguments_.find((argument) => /^\d+$/.test(argument)));
const minutes = Math.min(24 * 60, Math.max(1, Number.isFinite(asked) && asked > 0 ? asked : 5));
const flags = arguments_.filter((argument) => argument.startsWith("--"));
const exportScript = fileURLToPath(new URL("./brain-export.mjs", import.meta.url));

const runOnce = () =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", exportScript, ...flags],
      { stdio: "inherit" },
    );
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });

console.log(`Keeping the brain up to date every ${minutes} minute(s). Press Ctrl+C to stop.\n`);
for (;;) {
  const code = await runOnce();
  const time = new Date().toTimeString().slice(0, 5);
  console.log(
    code === 0
      ? `[${time}] Next refresh in ${minutes} minute(s).\n`
      : `[${time}] That refresh did not work; trying again in ${minutes} minute(s).\n`,
  );
  await new Promise((resolve) => setTimeout(resolve, minutes * 60_000));
}
