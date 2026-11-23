import Link from "next/link";
import { BrandLogo, SiteFooter, SiteHeader } from "@/components/chrome";
import { FindingCard } from "@/components/FindingCard";
import { ScanForm } from "@/components/ScanForm";
import { SAMPLE_FINDING } from "@/components/sample";
import { CHECKS } from "@/engine/checks";
import { LENS_NAMES } from "@/engine/types";
import { priceOf, rupees } from "@/lib/payments";

const lensCount = new Set(CHECKS.map((c) => c.lens)).size;

export default function Home() {
  return (
    <>
      <SiteHeader />
      <section className="hero" style={{ marginTop: -64, paddingTop: "calc(64px + clamp(56px, 9vw, 112px))" }}>
        <div className="wrap hero-grid">
          <div>
            <div style={{ marginBottom: 28 }}><BrandLogo width={300} /></div>
            <p className="eyebrow">Customer Perspective Consultancy</p>
            <h1 style={{ marginTop: 18 }}>Every founder has blind spots.</h1>
            <p className="lede">
              Your customers see what you might miss. QUARR helps you uncover the gaps in your customer experience before they cost you sales.
            </p>
            <div className="row" style={{ marginTop: 28, gap: 12 }}>
              <a href="#start" className="btn btn-primary">Get your free store check</a>
              <Link href="/approach" className="btn btn-ghost">How QUARR works</Link>
            </div>
            <div className="hero-focus">
              <p className="eyebrow brass">Starting with Indian D2C brands</p>
              <p>A guided review of the customer journey, from first impression to purchase.</p>
              <ul className="hero-points">
                <li>A first result in about a minute, before you sign up</li>
                <li>Every finding traced to a screenshot of your live store</li>
                <li>The full review is read by a QUARR Expert before it&apos;s final</li>
              </ul>
            </div>
          </div>
          <div className="submit-card" id="start">
            <p className="eyebrow brass">Free · about a minute</p>
            <h2 style={{ margin: "8px 0 20px" }}>Your free store check</h2>
            <ScanForm />
          </div>
        </div>
      </section>

      <section className="wrap lift" id="how">
        <div className="steps">
          {[
            ["01", "Scan in a minute", "Paste your store address. No sign-up, no Shopify app, no access to your admin. See how many things a new buyer may question, and one finding in full."],
            ["02", "Unlock the full walk, free", `Sign up with Google or email. QUARR runs ${CHECKS.length} checks across ${lensCount} areas (pricing, delivery, returns, trust, checkout) on a phone and a desktop.`],
            ["03", "Fix, then re-check", "Read the three findings most likely to cost you a first order. Fix them, then re-check and see exactly what changed."],
          ].map(([n, t, d]) => (
            <div className="card step" key={n}>
              <span className="num">{n}</span>
              <h3>{t}</h3>
              <p className="muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section wrap" id="sample">
        <div className="section-head">
          <p className="eyebrow brass">What a finding looks like</p>
          <h2>Evidence first. Opinion never.</h2>
          <p className="lede">
            Every finding points at the exact place on your store where it was seen. If we couldn&apos;t see something, we say so instead of guessing.
          </p>
        </div>
        <FindingCard index={1} {...SAMPLE_FINDING} />
        <p className="small muted" style={{ marginTop: 12 }}>From a demonstration store built for testing. Real First Looks use your live pages.</p>
      </section>

      <section className="section wrap">
        <div className="split">
          <div className="card card-pad stack">
            <p className="eyebrow brass">Built on a framework, not a prompt</p>
            <h3>Why this isn&apos;t a chatbot&apos;s opinion</h3>
            <p className="muted">
              A finding only exists when one of QUARR&apos;s checks fires against your live store, and every check must point at a screenshot. AI helps us word a finding clearly, but it can&apos;t create one, and it can&apos;t add a number that isn&apos;t in the evidence.
            </p>
            <div className="row" style={{ gap: 8 }}>
              {Object.values(LENS_NAMES).map((l) => (
                <span className="chip" key={l}>{l}</span>
              ))}
            </div>
          </div>
          <div className="card card-pad stack">
            <p className="eyebrow brass">On your store</p>
            <h3>What we do, and what we never do</h3>
            <ul className="list-clean small">
              <li className="tick">Visit like a shopper on a phone and a desktop</li>
              <li className="tick">Add one item to the cart and open the first checkout screen</li>
              <li className="tick">Read your shipping, returns, terms and contact pages</li>
              <li className="cross">Pay, log in, request an OTP or submit any form</li>
              <li className="cross">Visit your store more than twice a day (a quick scan, then the full walk)</li>
            </ul>
            <Link href="/crawler" className="small">How our browser behaves →</Link>
          </div>
        </div>
      </section>

      <section className="section wrap" id="pricing">
        <div className="section-head">
          <p className="eyebrow brass">Pricing</p>
          <h2>Free to start. Pay only for what you use.</h2>
          <p className="lede">No subscription. Buy a re-check when you&apos;ve fixed something, or the full journey when you want an Expert on your whole path to a first order.</p>
        </div>
        <div className="steps">
          {[
            ["Free", "First Look", "Start with a free store check: a one-minute scan, then the full walk and an Expert-reviewed First Look when you sign up.", "Get your free store check", "/#start"],
            [`${rupees(priceOf("RECHECK").basePaise)} + GST`, "Re-check", "Walk your store again after fixes and see, check by check, what's fixed, still open or new.", "Start with a free scan", "/#start"],
            [`${rupees(priceOf("JOURNEY").basePaise)} + GST`, "First-purchase journey", "A QUARR Expert walks your whole path to a first order and gives you a prioritised action guide. Full refund if the scope doesn't fit.", "What's included", "/journey"],
          ].map(([price, name, desc, cta, href]) => (
            <div className="card step stack" key={name} style={{ ["--stack" as string]: "10px" }}>
              <span className="num">{name}</span>
              <h3 style={{ margin: 0 }}>{price}</h3>
              <p className="muted small">{desc}</p>
              <Link href={href} className="small">{cta} →</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="section wrap">
        <div className="offer">
          <div className="stack">
            <p className="eyebrow" style={{ color: "rgba(255,255,255,0.7)" }}>When three findings aren&apos;t enough</p>
            <h2>The full first-purchase journey</h2>
            <p>
              A QUARR Expert walks your whole path to a first order (discovery, product, cart, checkout, delivery promise, returns) and gives you a prioritised action guide. Every point is backed by evidence, the same way.
            </p>
          </div>
          <div className="stack" style={{ justifySelf: "start" }}>
            <p className="price">₹5,000 <span className="small" style={{ fontFamily: "var(--sans)", color: "rgba(255,255,255,0.7)" }}>+ GST per journey</span></p>
            <Link href="/journey" className="btn btn-light">See what&apos;s included</Link>
          </div>
        </div>
      </section>

      <section className="section wrap narrow faq">
        <div className="section-head">
          <p className="eyebrow brass">Questions</p>
          <h2>Before you paste your link</h2>
        </div>
        {[
          ["Is it really free?", "Yes. The scan and the First Look are free, with no card and no call. Re-checks and the journey are paid, one at a time. There's no subscription."],
          ["How fast is it?", "The scan takes about a minute. After you sign up, the first findings appear in minutes. The Expert-reviewed First Look follows by email within 12 hours, usually much sooner."],
          ["Why do I need to sign up?", "So your reports, re-checks and purchases live in one place you can come back to. Google or a one-time email code: no password."],
          ["Will this affect my store or my analytics?", "We behave like one careful shopper: a handful of page views, one add-to-cart, no purchase. Our browser identifies itself as QUARRBot, so you can filter it out of analytics."],
          ["Why only three findings?", "Because three you act on beats thirty you skim. We tell you how many other issues we noticed, and the full journey covers them."],
          ["What happens to my email?", "We use it to send your First Look and, if you reply, to talk to you. No newsletters unless you ask. You can ask us to delete everything at any time."],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <SiteFooter />
    </>
  );
}
