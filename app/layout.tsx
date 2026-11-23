import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "QUARR — See what the customer will see", template: "%s · QUARR" },
  description:
    "Paste your store URL. QUARR walks it like a first-time buyer, on a phone and a laptop, and sends you up to three evidence-backed findings, each traced to a screenshot. Free.",
};

export const viewport: Viewport = { themeColor: "#f7f9fc", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
