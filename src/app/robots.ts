import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/api", "/auth", "/onboarding", "/login", "/signup", "/reset-password", "/forgot-password"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
