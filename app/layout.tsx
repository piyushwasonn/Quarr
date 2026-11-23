import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "QUARR — See what the customer will see", template: "%s · QUARR" },
  description: "Every founder has blind spots. QUARR, a customer perspective consultancy, helps you find the gaps in your customer experience before they cost you sales. Free store check for Indian D2C brands.",
};

export const viewport: Viewport = { themeColor: "#f7f9fc", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
