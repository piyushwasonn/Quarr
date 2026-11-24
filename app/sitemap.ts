import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// The public pages search engines should know about. Reports and scans are private.
const PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/approach", priority: 0.8, changeFrequency: "monthly" },
  { path: "/journey", priority: 0.8, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/crawler", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/refunds", priority: 0.2, changeFrequency: "yearly" },
  { path: "/removal", priority: 0.1, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map((p) => ({ url: siteUrl(p.path), lastModified, changeFrequency: p.changeFrequency, priority: p.priority }));
}
