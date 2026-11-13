import type { MetadataRoute } from "next";

const siteUrl = "https://locked-in2.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing"],
      disallow: ["/analyses", "/api/", "/auth", "/checkout", "/dashboard", "/profile"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
