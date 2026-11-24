import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";
import { OG_IMAGE, SITE_NAME, siteUrl } from "@/lib/seo";

const DEFAULT_TITLE = "QUARR: See what the customer will see";
const DEFAULT_DESCRIPTION = "Every founder has blind spots. QUARR, a customer perspective consultancy, helps you find the gaps in your customer experience before they cost you sales. Free store check for Indian D2C brands.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: DEFAULT_TITLE, template: "%s · QUARR" },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  formatDetection: { telephone: false, email: false, address: false },
  // The share card every page falls back to; public pages set their own via pageMetadata().
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, images: [OG_IMAGE.url] },
};

export const viewport: Viewport = { themeColor: "#f7f9fc", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
