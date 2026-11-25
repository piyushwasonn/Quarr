import Link from "next/link";
import { BrandLogo, SiteFooter, SiteHeader } from "@/components/chrome";
import { FindingCard } from "@/components/FindingCard";
import { ScanForm } from "@/components/ScanForm";
import { SAMPLE_FINDING } from "@/components/sample";
import { CHECKS } from "@/engine/checks";
import { LENS_NAMES } from "@/engine/types";
import { priceOf, rupees } from "@/lib/payments";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/seo";

const lensCount = new Set(CHECKS.map((c) => c.lens)).size;

export const metadata = pageMetadata(
  "/",
  { absolute: "QUARR: Free store check for Indian D2C brands" },
  "You paid to bring buyers to your store. QUARR checks it like a first-time buyer and shows you what stops people ordering, and how to fix it. Free for Indian D2C brands.",
);

// Shown on the page and given to search engines as FAQ structured data, so the two never differ.
const FAQ: [string, string][] = [
  ["Is it really free?", "Yes. The scan and the First Look are free, with no card and no call. Re-checks and the journey are paid, one at a time. There's no subscription."],
  ["What do I get?", "For each problem: what a first-time buyer sees, a screenshot from your live store, why it may cost you orders, and what to do about it, with the exact Shopify setting where we know it."],
  ["How fast is it?", "The scan takes about a minute. After you sign up, the first findings appear in minutes, and your full First Look follows by email within 12 hours, usually much sooner."],
  ["Why do I need to sign up?", "So your reports, re-checks and purchases live in one place you can come back to. Google or a one-time email code: no password."],
  ["Will this affect my store or my analytics?", "We behave like one careful shopper: a handful of page views, one add-to-cart, no purchase. Our browser identifies itself as QUARRBot, so you can filter it out of analytics."],
  ["Why only three findings?", "Because three you act on beats thirty you skim. We tell you how many other issues we noticed, and the full journey covers them."],
  ["What happens to my email?", "We use it to send your First Look and, if you reply, to talk to you. No newsletters unless you ask. You can ask us to delete everything at any time."],
];

// What search engines read about QUARR: who it is, what it offers at what price, and the FAQ.
function structuredData() {
  const site = siteUrl();
  const org = `${site}/#organization`;
  const offer = (name: string, paise: number) => ({
    "@type": "Offer",
    name,
    price: (paise / 100).toFixed(2),
    priceCurrency: "INR",
    priceSpecification: { "@type": "PriceSpecification", price: (paise / 100).toFixed(2), priceCurrency: "INR", valueAddedTaxIncluded: false },
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": org, name: "QUARR", url: site, logo: siteUrl("/brand/quarr-logo-on-white.png"), email: process.env.CONTACT_EMAIL || "hello@quarr.in", description: "Customer perspective consultancy for Indian D2C brands.", areaServed: { "@type": "Country", name: "India" } },
      { "@type": "WebSite", "@id": `${site}/#website`, url: site, name: "QUARR", inLanguage: "en-IN", publisher: { "@id": org } },
      {
        "@type": "Service",
        name: "Free store check and First Look",
        serviceType: "Online store customer experience review",
        description: "QUARR walks an online store the way a first-time buyer does and shows, with a screenshot behind every finding, what is likely to cost a first order.",
        provider: { "@id": org },
        areaServed: { "@type": "Country", name: "India" },
        audience: { "@type": "BusinessAudience", name: "Indian D2C brands" },
        offers: [offer("First Look", 0), offer("Re-check", priceOf("RECHECK").basePaise), offer("First-purchase journey", priceOf("JOURNEY").basePaise)],
      },
      { "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structuredData())} />
      <SiteHeader />
      <section className="hero" style={{ marginTop: -64, paddingTop: "calc(64px + clamp(56px, 9vw, 112px))" }}>
        <div className="wrap hero-grid">
          <div>
            <div style={{ marginBottom: 28 }}><BrandLogo width={300} /></div>
            <p className="eyebrow">Customer Perspective Consultancy</p>
            <h1 style={{ marginTop: 18 }}>You paid to bring buyers to your store. Find out what sends them away.</h1>
            <p className="lede">
              QUARR checks your store like a first-time buyer and shows you what stops people ordering, and how to fix it.
            </p>
            <div className="row" style={{ marginTop: 28, gap: 12 }}>
              <a href="#start" className="btn btn-primary">Check my store free</a>
              <a href="#how" className="btn btn-ghost">How it works</a>
            </div>
            <div className="hero-focus">
              <p className="eyebrow brass">Built for Indian D2C brands</p>
              <p>You see the problem, the proof and the fix. You decide what to change.</p>
              <ul className="hero-points">
                <li>See the proof yourself: a screenshot behind every finding</li>
                <li>Every finding is double-checked before you see it</li>
                <li>Free to start. No app, no access to your admin</li>
              </ul>
            </div>
          </div>
          <div className="submit-card" id="start">
            <p className="eyebrow brass">Free · about a minute</p>
            <h2 style={{ margin: "8px 0 20px" }}>Check your store free</h2>
            <ScanForm />
          </div>
        </div>
      </section>

      <section className="wrap lift">
        <div className="steps">
          {[
            ["You pay for every visit", "Ads, influencers and marketplaces bring people to your store. Each one who leaves without ordering is money you've already spent."],
            ["Buyers don't tell you why they left", "They don't write in. They close the tab, and your analytics shows a drop, not a reason."],
            ["You know your store too well", "Every founder has blind spots. You can't see your store the way a stranger does, so you can't see what stops them."],
          ].map(([t, d]) => (
            <div className="card step" key={t}>
              <h3>{t}</h3>
              <p className="muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section wrap" id="how">
        <div className="section-head">
          <p className="eyebrow brass">How it works</p>
          <h2>From your store link to what to fix, in three steps.</h2>
        </div>
        <div className="steps">
          {[
            ["01", "Paste your store link", "No sign-up, no app, no access to your admin. In about a minute you see how many things may stop a first-time buyer ordering."],
            ["02", "Sign up free to see what to fix", `QUARR walks your store on a phone and a desktop and runs ${CHECKS.length} checks across ${lensCount} areas (prices, delivery, returns, trust, checkout). You get each problem with its screenshot and what to do.`],
            ["03", `Fix, then re-check for ${rupees(priceOf("RECHECK").basePaise)}`, "Make the changes. A re-check walks your store again and shows you what you fixed, what's still open and anything new."],
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
          <p className="eyebrow brass">What you get for each problem</p>
          <h2>The problem, the proof, and what to do.</h2>
          <p className="lede">
            Every finding points at the exact place on your store where we saw it, and ends with your next step. If we couldn&apos;t see something, we say so instead of guessing.
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
              A finding only exists when one of QUARR&apos;s checks fires against your live store, and every finding must point at a screenshot and the exact words on your page. QUARR&apos;s AI reads your pages the way a careful buyer would: it answers the questions a simple rule can&apos;t, and double-checks every finding before you see it. It can only point at words that are really on your page, and it can&apos;t add a number that isn&apos;t there.
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
          <h2>Free to start. Pay only when you want more.</h2>
          <p className="lede">No subscription. Buy a re-check after you&apos;ve made changes, or the full journey when you want an expert on your whole path to a first order.</p>
        </div>
        <div className="steps">
          {[
            ["Free", "First Look", "A one-minute scan, then sign up free for the full walk: every finding with its screenshot and what to do.", "Check my store free", "/#start"],
            [`${rupees(priceOf("RECHECK").basePaise)} + GST`, "Re-check", "After you've made changes, see what you fixed, what's still open and anything new.", "Start with a free scan", "/#start"],
            [`${rupees(priceOf("JOURNEY").basePaise)} + GST`, "First-purchase journey", "A QUARR Expert walks your whole path to a first order, and you leave with a ranked action list. Full refund if the scope doesn't fit.", "What's included", "/journey"],
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
            <p className="eyebrow" style={{ color: "rgba(255,255,255,0.7)" }}>When you want every issue, not just the first few</p>
            <h2>Your whole path to a first order, with an expert</h2>
            <p>
              A QUARR Expert walks every step a buyer takes (finding you, the product page, cart, checkout, the delivery promise, returns), and you leave with a ranked action list. Every point is backed by a screenshot, the same way.
            </p>
          </div>
          <div className="stack" style={{ justifySelf: "start" }}>
            <p className="price">{rupees(priceOf("JOURNEY").basePaise)} <span className="small" style={{ fontFamily: "var(--sans)", color: "rgba(255,255,255,0.7)" }}>+ GST per journey</span></p>
            <Link href="/journey" className="btn btn-light">See what&apos;s included</Link>
          </div>
        </div>
      </section>

      <section className="section wrap narrow faq">
        <div className="section-head">
          <p className="eyebrow brass">Questions</p>
          <h2>Before you paste your link</h2>
        </div>
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <section className="section wrap">
        <div className="offer">
          <div className="stack">
            <p className="eyebrow" style={{ color: "rgba(255,255,255,0.7)" }}>Free · about a minute</p>
            <h2>Your next buyer is already on the way. Make sure nothing sends them away.</h2>
          </div>
          <div className="stack" style={{ justifySelf: "start" }}>
            <a href="#start" className="btn btn-light" style={{ padding: "14px 22px" }}>Check my store free</a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
