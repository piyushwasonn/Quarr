import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { CHECKS } from "@/engine/checks";

export const metadata = { title: "The first-purchase journey" };

export default async function Journey({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const pay = process.env.RAZORPAY_PAYMENT_LINK;
  const contact = process.env.CONTACT_EMAIL || "hello@quarr.in";
  return (
    <>
      <SiteHeader />
      <main className="wrap" style={{ paddingTop: 56 }}>
        <div className="section-head">
          <p className="eyebrow brass">Paid · founding customers</p>
          <h1 style={{ fontSize: "clamp(32px, 4.6vw, 48px)" }}>The full first-purchase journey</h1>
          <p className="lede">
            The First Look shows you three things. The journey walks every step between a stranger seeing your ad and receiving their first order, and tells you what to fix first.
          </p>
        </div>
        <div className="split">
          <div className="card card-pad stack">
            <h3>What&apos;s included</h3>
            <ul className="list-clean">
              <li className="tick">All {"≈"}35 checks, plus an Expert walking the journey by hand on real devices</li>
              <li className="tick">Discovery → product → cart → checkout → delivery promise → returns</li>
              <li className="tick">A detailed assessment: every finding with its evidence, likely effect and confidence</li>
              <li className="tick">A founder action guide: what to change first, and why</li>
              <li className="tick">A 30-minute walkthrough call, if you want one (optional)</li>
            </ul>
          </div>
          <div className="card card-pad stack">
            <h3>How it works</h3>
            <ol className="small" style={{ paddingLeft: 18, display: "grid", gap: 8, color: "var(--ink-2)", margin: 0 }}>
              <li>Tell us which journey matters most (usually the first purchase from an Instagram or Meta ad).</li>
              <li>We confirm the scope with you by email before any payment.</li>
              <li>You pay ₹5,000 + GST through Razorpay.</li>
              <li>Your assessment arrives within 5 working days.</li>
            </ol>
            <p style={{ fontFamily: "var(--serif)", fontSize: 34, color: "var(--navy-900)" }}>
              ₹5,000 <span className="small muted" style={{ fontFamily: "var(--sans)" }}>+ GST per journey</span>
            </p>
            <div className="row">
              <a className="btn btn-primary" href={`mailto:${contact}?subject=${encodeURIComponent("QUARR journey" + (from ? ` (First Look ${from})` : ""))}`}>Ask for a scope</a>
              {pay ? <a className="btn btn-ghost" href={pay}>Pay with Razorpay</a> : null}
            </div>
            <p className="tiny muted">Founding-customer price for our first clients. Payment happens only after we agree the scope.</p>
          </div>
        </div>
        {from ? (
          <p className="small" style={{ marginTop: 24 }}>
            <Link href={`/r/${from}`}>← Back to your First Look</Link>
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
