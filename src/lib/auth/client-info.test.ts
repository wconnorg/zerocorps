import { describe, expect, it } from "vitest";
import { clientIp, coarseIpPrefix, userAgentFamily } from "./client-info";
import { keyedHash, randomToken, safeEqual, sha256 } from "./keyed-hash";

const headers = (entries: Record<string, string>) => new Headers(entries);

describe("clientIp", () => {
  it("reads only the trusted header, and takes the first address of a list", () => {
    expect(
      clientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), "x-forwarded-for"),
    ).toBe("203.0.113.7");
    expect(clientIp(headers({ "x-real-ip": "203.0.113.7" }), "x-forwarded-for")).toBeNull();
    expect(clientIp(headers({ "x-real-ip": "203.0.113.7" }), "x-real-ip")).toBe("203.0.113.7");
  });

  it("accepts IPv6, brackets and ports", () => {
    expect(clientIp(headers({ "x-forwarded-for": "2001:DB8::1" }), "x-forwarded-for")).toBe(
      "2001:db8::1",
    );
    expect(clientIp(headers({ "x-forwarded-for": "[2001:db8::1]:443" }), "x-forwarded-for")).toBe(
      "2001:db8::1",
    );
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7:51234" }), "x-forwarded-for")).toBe(
      "203.0.113.7",
    );
  });

  it("returns null for anything that is not an address", () => {
    for (const value of ["", "unknown", "<script>", "999.1.1.1", "203.0.113.7; DROP TABLE users"]) {
      expect(clientIp(headers({ "x-forwarded-for": value }), "x-forwarded-for")).toBeNull();
    }
    expect(clientIp(undefined, "x-forwarded-for")).toBeNull();
  });
});

describe("coarseIpPrefix", () => {
  it("keeps a /24 of IPv4 and a /48 of IPv6", () => {
    expect(coarseIpPrefix("203.0.113.77")).toBe("203.0.113.0/24");
    expect(coarseIpPrefix("2001:db8:abcd:1234:5678:9abc:def0:1")).toBe("2001:db8:abcd::/48");
    expect(coarseIpPrefix("2001:db8::1")).toBe("2001:db8:0::/48");
    expect(coarseIpPrefix("::1")).toBe("0:0:0::/48");
    expect(coarseIpPrefix("::ffff:203.0.113.77")).toBe("203.0.113.0/24");
  });

  it("returns null for nothing or nonsense", () => {
    expect(coarseIpPrefix(null)).toBeNull();
    expect(coarseIpPrefix("not an ip")).toBeNull();
  });
});

describe("userAgentFamily", () => {
  const cases: [string, string][] = [
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "Chrome on Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      "Edge on Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      "Safari on macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari on iOS",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0", "Firefox on Linux"],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      "Chrome on Android",
    ],
    ["curl/8.9.1", "Unknown browser"],
  ];
  it.each(cases)("%s", (userAgent, family) => {
    expect(userAgentFamily(userAgent)).toBe(family);
  });

  it("never lets any part of the header through", () => {
    const hostile =
      'Chrome/1 <img src=x onerror=alert(1)> \r\nX-Injected: yes Windows NT "; DROP TABLE users;--';
    expect(userAgentFamily(hostile)).toBe("Chrome on Windows");
    expect(userAgentFamily(null)).toBeNull();
    expect(userAgentFamily("x".repeat(100_000))).toBe("Unknown browser");
  });
});

describe("keyed hashes", () => {
  it("separates purposes and secrets, and is stable", () => {
    const a = keyedHash("secret-one", "signup-code", "value");
    expect(a).toBe(keyedHash("secret-one", "signup-code", "value"));
    expect(a).not.toBe(keyedHash("secret-one", "limit", "value"));
    expect(a).not.toBe(keyedHash("secret-two", "signup-code", "value"));
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toContain("value");
  });

  it("compares in constant time and treats different lengths as unequal", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });

  it("makes long random tokens and hashes them", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(token);
    expect(sha256(token)).not.toBe(token);
    expect(sha256(token)).toBe(sha256(token));
  });
});
