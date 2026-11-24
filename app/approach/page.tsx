import Link from "next/link";
import { BrandLogo, SiteFooter, SiteHeader } from "@/components/chrome";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/approach", "Our approach", "Question, Understand, Anticipate, Refine, Remember: how QUARR helps founders see their store the way a first-time buyer does.");

// Framework wording is from the QUARR Brand Guidelines v1.0 (Notion 08). Keep it verbatim.
const FRAMEWORK: [string, string, string][] = [
  ["Q", "Question", "Challenge assumptions before they become expensive decisions."],
  ["U", "Understand", "Understand the customer's needs, expectations, motivations and concerns."],
  ["A", "Anticipate", "Identify where customers may accept, hesitate, question or reject an experience."],
  ["R", "Refine", "Improve the product, proposition and touchpoints using customer insights."],
  ["R", "Remember", "Create memorable experiences and capture learning for future decisions."],
];

export default function Approach() {
  return (
    <>
      <SiteHeader />
      <main className="wrap" style={{ paddingTop: 56 }}>
        <div className="section-head">
          <BrandLogo width={260} />
          <p className="eyebrow brass" style={{ marginTop: 12 }}>Our approach</p>
          <h1>Every founder has blind spots.</h1>
          <p className="lede">QUARR helps you find them before your customers do. The QUARR framework is how we deliver that promise.</p>
        </div>

        <ol className="approach" aria-label="The QUARR framework">
          {FRAMEWORK.map(([letter, word, line], i) => (
            <li key={i} className="card approach-step">
              <span className="approach-letter" aria-hidden>{letter}</span>
              <div>
                <h2>{word}</h2>
                <p className="muted">{line}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="small muted" style={{ marginTop: 16 }}>Question · Understand · Anticipate · Refine · Remember</p>

        <div className="card card-pad stack" style={{ marginTop: 40 }}>
          <h3>What we will and won&apos;t claim</h3>
          <p className="muted">
            QUARR never claims to know exactly how customers will behave without testing. Our expertise helps anticipate reactions, identify risks and guide validation. That&apos;s why every finding separates what we saw from its likely effect, and says what is not yet proven.
          </p>
          <Link href="/#start" className="btn btn-primary" style={{ justifySelf: "start" }}>Scan my store</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
