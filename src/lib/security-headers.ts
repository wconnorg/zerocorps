/**
 * Baseline security headers applied to every response by `next.config.ts`.
 *
 * The Content-Security-Policy deliberately does not use nonces. A nonce has to
 * be generated per request, which would force every page to render dynamically
 * and lose static prerendering and CDN caching for the marketing pages. This is
 * the no-nonce policy documented by Next.js. It still blocks third-party
 * scripts, plugins, framing, `<base>` hijacking and cross-origin form posts.
 *
 * When a later milestone needs another origin (for example the avatar storage
 * host in `img-src`), add it to `CSP_DIRECTIVES` here and nowhere else.
 */

type Directives = Record<string, string[]>;

export function contentSecurityPolicyDirectives(options: { isDev: boolean }): Directives {
  const { isDev } = options;
  const directives: Directives = {
    "default-src": ["'self'"],
    // React needs eval in development only, to rebuild server error stacks.
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    // The dev server's hot reload uses a websocket.
    "connect-src": ["'self'", ...(isDev ? ["ws:", "wss:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  // Not in development: the dev server is plain http on localhost.
  if (!isDev) directives["upgrade-insecure-requests"] = [];
  return directives;
}

export function buildContentSecurityPolicy(options: { isDev: boolean }): string {
  return Object.entries(contentSecurityPolicyDirectives(options))
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

export function securityHeaders(options: { isDev: boolean }): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ];
  if (!options.isDev) {
    // No `includeSubDomains` or `preload`: those commit every subdomain to HTTPS
    // and are hard to undo. Add them deliberately once all subdomains are ready.
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000" });
  }
  return headers;
}
