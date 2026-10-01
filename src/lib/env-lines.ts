/**
 * Sets keys in the text of an env file, for the owner's commands that write `.env.local`
 * (`npm run brain:setup`), so nobody edits it by hand. A key already there is replaced
 * where it stands and any later copy of it is removed, because the last copy would
 * otherwise win; a new key goes at the end. Comments and every other line stay as they are.
 *
 * This module imports nothing, so the scripts in `scripts/` can load it.
 */
export function setEnvValues(text: string, values: Record<string, string>): string {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  let lines = text.split(/\r?\n/);
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error("Not an environment variable name.");
    if (/[\r\n]/.test(value)) throw new Error("A value cannot hold a line break.");
    const isKey = (line: string) => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line);
    const first = lines.findIndex(isKey);
    if (first === -1) {
      if (lines.at(-1) === "") lines.pop();
      lines.push(`${key}=${value}`, "");
      continue;
    }
    lines = lines.filter((line, index) => index === first || !isKey(line));
    lines[first] = `${key}=${value}`;
  }
  return lines.join(newline);
}

/**
 * A value in single quotes, which Node's env parser and Next's (dotenv) both read
 * literally: a Windows path's backslashes stay backslashes. Refused if it cannot be.
 */
export function singleQuoted(value: string): string {
  if (/['\r\n]/.test(value)) throw new Error("This value cannot be single-quoted safely.");
  return `'${value}'`;
}
