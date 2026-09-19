import type { MetadataRoute } from "next";
import { env } from "@/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${env.NEXT_PUBLIC_APP_URL}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    {
      url: `${env.NEXT_PUBLIC_APP_URL}/academy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
