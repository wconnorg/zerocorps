import type { NextConfig } from "next";
// Importing the env module validates every environment variable before Next.js
// does anything else, for `next dev`, `next build` and `next start` alike.
import "./src/env.ts";
import { securityHeaders } from "./src/lib/security-headers.ts";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders({ isDev }) }];
  },
};

export default nextConfig;
