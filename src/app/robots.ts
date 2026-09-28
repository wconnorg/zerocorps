import type { MetadataRoute } from "next";
import { env } from "@/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Account and app areas are private; keep crawlers on the public pages.
      disallow: [
        "/api/",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
        "/onboarding",
        // The Academy's own pages are for members; `/academy` itself stays public.
        "/academy/",
        "/dashboard",
        "/settings",
        "/profile",
      ],
    },
    sitemap: `${env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
