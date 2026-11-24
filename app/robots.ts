import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// Public pages are indexable. Private ones (the Bench, accounts, reports, scans, sign-in,
// evidence files, APIs) are not: they belong to one founder or to us.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/bench", "/account", "/r/", "/s/", "/scan/", "/e/", "/api/", "/auth/", "/signin"] }],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
