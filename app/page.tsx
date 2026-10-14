import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { FindingCard } from "@/components/FindingCard";
import { SubmitForm } from "@/components/SubmitForm";
import { SAMPLE_FINDING } from "@/components/sample";
import { CHECKS } from "@/engine/checks";
import { LENS_NAMES } from "@/engine/types";

const lensCount = new Set(CHECKS.map((c) => c.lens)).size;

export default function Home() {
  return (
    <>
      <SiteHeader dark />
      <section className="hero" style={{ marginTop: -64, paddingTop: "calc(64px + clamp(56px, 9vw, 112px))" }}>
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Free First Look · for Indian D2C brands</p>
            <h1 style={{ marginTop: 18 }}>See your store the way a first-time buyer does.</h1>
            <p className="lede">
              Paste your store link. QUARR walks it on a phone and a laptop, from homepage to product to cart to the first screen of checkout, and shows you what a new buyer is likely to trust, question or abandon.
            </p>
            <ul className="hero-points">
              <li>Up to three findings, each traced to a screenshot of your live store</li>
              <li>No call, no sales pitch. Results arrive by email</li>
              <li>Checked by a QUARR Expert before it reaches you</li>
            </ul>
          </div>
          <div className="submit-card" id="start">
            <p className="eyebrow brass">Free · takes 30 seconds</p>
            <h2 style={{ margin: "8px 0 20px" }}>Get your First Look</h2>
            <SubmitForm />
          </div>
        </div>
      </section>

      <section className="wrap lift" id="how">
        <div className="steps">
          {[
            ["01", "Paste your link", "Just your store address and an email. No login, no Shopify app, no access to your admin."],
            ["02", "We walk it like a buyer", `QUARR's engine runs ${CHECKS.length} checks across ${lensCount} areas: pricing, delivery, returns, trust, checkout and more, on a 390 px phone and a desktop screen.`],
            ["03", "You read what matters", "The three findings most likely to cost you a first order. What we saw, what it likely does to a buyer, and what we couldn't prove."],
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
              <li className="cross">Visit your store more than once a day</li>
            </ul>
            <Link href="/crawler" className="small">How our browser behaves →</Link>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <div className="offer">
          <div className="stack">
            <p className="eyebrow" style={{ color: "#c9b28a" }}>When three findings aren&apos;t enough</p>
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
          ["Is it really free?", "Yes. The First Look is free, with no card and no call. If it's useful, there's a deeper paid journey. If not, you keep the findings anyway."],
          ["How fast is it?", "We promise within 12 hours, and most arrive much sooner. Every report is read by a QUARR Expert before it's sent, which is why we don't promise instant."],
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
