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
        // The Academy is for members; visitors are sent to sign in.
        "/academy",
        "/dashboard",
        "/settings",
        "/profile",
      ],
    },
    sitemap: `${env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
