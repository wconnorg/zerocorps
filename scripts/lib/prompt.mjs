// Questions for the person at the keyboard. Every command that changes the database
// or handles a passphrase needs a real terminal, which is deliberate: nothing
// automated (an assistant included) can answer these.

import { createInterface } from "node:readline/promises";
import { isInteractive } from "./env-file.mjs";

export function requireTerminal(commandName) {
  if (isInteractive()) return;
  console.error(
    `${commandName} must be run by a person in a terminal: it asks for a typed confirmation or a passphrase.`,
  );
  process.exit(1);
}

/** Asks a question and returns the trimmed answer. */
export async function ask(question) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await readline.question(question)).trim();
  } finally {
    readline.close();
  }
}

/** Reads a line without showing it. Paste works. Ctrl+C cancels. */
export function askHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    let value = "";
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0003") return finish(new Error("Cancelled."));
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    }
    stdin.on("data", onData);
  });
}
