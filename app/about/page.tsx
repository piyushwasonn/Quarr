import Link from "next/link";
import { BrandLogo, SiteFooter, SiteHeader } from "@/components/chrome";
import { FOUNDER, jsonLd, pageMetadata, siteUrl } from "@/lib/seo";

export const metadata = pageMetadata(
  "/about",
  "About QUARR",
  "QUARR was founded by Piyush Wason after more than 15 years in customer support and customer experience. Who we are, why QUARR exists and the rules we work by.",
);
export const dynamic = "force-dynamic";

// Every fact about the founder is from the founder's CV (Drive, Aug 2026). Review language follows the
// CLAUDE.md rule: only person-reviewed work says a QUARR Expert reviewed it.
const CAREER = [
  "Built a customer support organisation from 5 to 50 people over seven years at Condeco.",
  "As Global Director of Customer Support at Aircall, ran support across six locations in three regions, and redesigned the end-to-end customer journey: customer satisfaction rose from 85% to 95% for business customers and from 74% to 87% for consumers.",
  "Led technical consultancy and managed services across India and the US at Eptura.",
  "Certified Scrum Master and Scrum Product Owner, and a LinkedIn Top Voice.",
];

const RULES: [string, string][] = [
  ["Evidence before opinion", "A finding exists only when one of our checks fires on your live store, and every finding points to a screenshot and the exact words on your page."],
  ["Unknown is an answer", "If your website can't show us something, we say so and tell you what would answer it, instead of guessing."],
  ["Every finding leads to action", "Each one ends with what to do next, and where to change it if your store runs on Shopify."],
  ["Checked before it reaches you", "A QUARR Expert reviews the findings before your First Look is final, unless every finding comes from a check that has held up in 30 expert reviews in a row. The first-purchase journey is always led by a QUARR Expert."],
  ["Careful on your store", "We visit like one shopper. We never pay, log in or submit a form, beyond adding one item to the cart."],
];

export default function About() {
  const email = process.env.CONTACT_EMAIL || "hello@quarr.in";
  const business = process.env.BUSINESS_NAME;
  const address = process.env.BUSINESS_ADDRESS;
  const person = { "@context": "https://schema.org", "@type": "AboutPage", url: siteUrl("/about"), about: { "@id": `${siteUrl()}/#organization` }, mainEntity: { "@type": "Person", name: FOUNDER.name, jobTitle: "Founder, QUARR", sameAs: [FOUNDER.linkedin], worksFor: { "@id": `${siteUrl()}/#organization` } } };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(person)} />
      <SiteHeader />
      <main className="wrap" style={{ paddingTop: 56, maxWidth: 900 }}>
        <div className="section-head">
          <BrandLogo width={240} />
          <p className="eyebrow brass" style={{ marginTop: 12 }}>About QUARR</p>
          <h1>We help founders see their store the way a first-time buyer does.</h1>
          <p className="lede">
            QUARR is a customer perspective consultancy for Indian D2C brands, based in Gurugram. We look at your store through 19 lenses, show you what may stop people ordering, and tell you what to do about it.
          </p>
        </div>

        <section className="card card-pad stack" aria-labelledby="founder-h">
          <p className="eyebrow brass">The founder</p>
          <h2 id="founder-h">{FOUNDER.name}</h2>
          <p>
            {FOUNDER.name.split(" ")[0]} has spent more than 15 years in customer support and customer experience at global software companies, on the side of the business that hears from customers when something goes wrong.
          </p>
          <ul className="list-clean">
            {CAREER.map((c) => (
              <li key={c} className="tick">{c}</li>
            ))}
          </ul>
          <p>
            The rule from that work is the one QUARR runs on: understand before you optimise. Most teams speed up their replies and never touch what causes the problem. QUARR starts with what your buyer actually meets.
          </p>
          <a href={FOUNDER.linkedin} target="_blank" rel="noreferrer" className="small" style={{ justifySelf: "start" }}>{FOUNDER.name.split(" ")[0]} on LinkedIn →</a>
        </section>

        <section className="stack" style={{ marginTop: 40 }} aria-labelledby="why-h">
          <h2 id="why-h">Why QUARR exists</h2>
          <p className="lede">
            Founders pay to bring buyers to their store, then lose many of them to things that are hard to see from the inside: a delivery charge that appears at checkout, a returns policy nobody can find, a claim with nothing behind it. Buyers rarely say why they left. QUARR shows you, with the screenshot, and tells you what to do.
          </p>
        </section>

        <section className="stack" style={{ marginTop: 40 }} aria-labelledby="rules-h">
          <h2 id="rules-h">How we work</h2>
          <div className="steps">
            {RULES.map(([t, d]) => (
              <div className="card step" key={t}>
                <h3>{t}</h3>
                <p className="muted">{d}</p>
              </div>
            ))}
          </div>
          <p className="small"><Link href="/approach">The QUARR framework →</Link> · <Link href="/#lenses">The 19 lenses →</Link></p>
        </section>

        <section className="card card-pad stack" style={{ marginTop: 40 }} aria-labelledby="biz-h">
          <h2 id="biz-h">The business</h2>
          {business ? <p>{business}</p> : null}
          <p style={{ whiteSpace: "pre-line" }}>{address || FOUNDER.city}</p>
          <p>Email: <a href={`mailto:${email}`}>{email}</a> · <Link href="/contact">All contact details</Link></p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
