import type { Metadata } from "next";

// Search and social metadata for public pages. One place, so every page gets a canonical
// URL, a description and the same share card.

export function siteUrl(path = "") {
  return `${(process.env.APP_URL || "https://quarr.in").replace(/\/$/, "")}${path}`;
}

export const SITE_NAME = "QUARR";

// The founder, as shown on the homepage and the About page. Facts come from Piyush's own CV
// (Drive, Aug 2026); keep them to what it states.
export const FOUNDER = { name: "Piyush Wason", linkedin: "https://www.linkedin.com/in/piyushwason", city: "Gurugram, Haryana, India" };
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "QUARR: see what a first-time buyer sees on your store. Free store check for Indian D2C brands." };

export function pageMetadata(path: string, title: string | { absolute: string }, description: string): Metadata {
  const plain = typeof title === "string" ? title : title.absolute;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", url: path, title: plain, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: plain, description, images: [OG_IMAGE.url] },
  };
}

// Structured data as a <script type="application/ld+json"> body. "<" is escaped so page
// text can never close the script tag.
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
