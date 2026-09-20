import { isIP } from "node:net";

/**
 * What we are willing to know about the machine on the other end: a client IP taken
 * from the ONE header our host is trusted to set, reduced to a coarse prefix before it
 * is stored, and a browser family from a fixed vocabulary.
 *
 * People are never recognised, blocked or trusted by IP. It feeds loose abuse limits
 * and the security event log, nothing else.
 */

/** The client IP from the trusted header, or null. Never from a header a visitor controls. */
export function clientIp(
  headers: Headers | undefined | null,
  trustedHeader: string,
): string | null {
  const raw = headers?.get(trustedHeader);
  if (!raw) return null;
  // A forwarding header may be a list; the host puts the client first.
  let candidate = (raw.split(",")[0] ?? "").trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(candidate);
  if (bracketed?.[1]) candidate = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(candidate))
    candidate = candidate.replace(/:\d+$/, "");
  return isIP(candidate) === 0 ? null : candidate.toLowerCase();
}

function expandIpv6(address: string): string[] | null {
  const [head = "", tail] = address.split("::");
  if (address.split("::").length > 2) return null;
  const headGroups = head === "" ? [] : head.split(":");
  const tailGroups = tail === undefined || tail === "" ? [] : tail.split(":");
  const missing = 8 - headGroups.length - tailGroups.length;
  if (tail === undefined ? headGroups.length !== 8 : missing < 0) return null;
  const groups =
    tail === undefined ? headGroups : [...headGroups, ...Array(missing).fill("0"), ...tailGroups];
  return groups.map((group) => group.replace(/^0+(?=.)/, "").toLowerCase());
}

/**
 * A coarse, readable prefix: /24 for IPv4 and /48 for IPv6. Enough to see "the same
 * network" during an incident, not enough to point at one household.
 */
export function coarseIpPrefix(ip: string | null): string | null {
  if (!ip) return null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  const address = mapped?.[1] ?? ip;
  if (isIP(address) === 4) {
    const octets = address.split(".");
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }
  if (isIP(address) === 6) {
    // A trailing dotted quad (other than the mapped form above) is rare; keep it simple.
    if (address.includes(".")) return null;
    const groups = expandIpv6(address);
    return groups ? `${groups[0]}:${groups[1]}:${groups[2]}::/48` : null;
  }
  return null;
}

const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/\bWindows NT\b/, "Windows"],
  [/\bAndroid\b/, "Android"],
  [/\b(?:iPhone|iPad|iPod)\b/, "iOS"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bLinux\b/, "Linux"],
];

/**
 * "Chrome on Windows". Built only from the fixed words above, so whatever a client
 * sends as its User-Agent, nothing of it can reach a log line, a database row or an
 * email. The raw header is never stored.
 */
export function userAgentFamily(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const sample = userAgent.slice(0, 512);
  const browser = BROWSERS.find(([pattern]) => pattern.test(sample))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(sample))?.[1];
  if (!browser && !system) return "Unknown browser";
  return `${browser ?? "Unknown browser"} on ${system ?? "an unknown system"}`;
}
