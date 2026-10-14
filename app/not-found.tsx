import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap narrow" style={{ paddingTop: 80 }}>
        <p className="eyebrow brass">Not found</p>
        <h1 style={{ fontSize: 40, margin: "12px 0" }}>This page isn&apos;t here.</h1>
        <p className="muted">If you followed a report link, it may not be published yet.</p>
        <p style={{ marginTop: 20 }}><Link href="/" className="btn btn-ghost">Back to QUARR</Link></p>
      </main>
      <SiteFooter />
    </>
  );
}
