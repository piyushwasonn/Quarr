import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo, SiteFooter, SiteHeader } from "@/components/chrome";
import { FindingCard, pageLabel } from "@/components/FindingCard";
import { CHECKS_BY_ID } from "@/engine/checks";
import { whatToDo } from "@/engine/checks/fixes";
import { coverage, lensNameFor, whyBuyersCare } from "@/engine/framework";
import type { Citation } from "@/engine/types";
import { isBenchSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { priceOf, rupees } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "First Look", robots: { index: false, follow: false } };

export default async function Report({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const run = await db.run.findUnique({
    where: { publicToken: token },
    include: {
      findings: { where: { selected: true, state: { not: "DROPPED" } }, orderBy: { position: "asc" }, include: { checkResult: true } },
      pages: { select: { id: true, kind: true, url: true, finalUrl: true, mobileShot: true, desktopShot: true, mobileHeight: true, desktopHeight: true } },
      results: { select: { checkId: true, outcome: true, ai: true } },
    },
  });
  if (!run) notFound();
  const published = ["PUBLISHED", "DELIVERED"].includes(run.status);
  const preview = !published && (await isBenchSession());
  if (!published && !preview) notFound();

  const date = (run.publishedAt ?? run.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const order = ["HOME", "PRODUCT_1", "PRODUCT_2", "CART", "CHECKOUT", "SHIPPING", "RETURNS", "TERMS", "PRIVACY", "CONTACT", "ABOUT"];
  const seen = [...run.pages].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const passedNames = run.results.filter((r) => r.outcome === "PASS").map((r) => CHECKS_BY_ID[r.checkId]?.name).filter(Boolean).slice(0, 8);
  const lenses = coverage(run.results);
  // No product page: QUARR's checks are for stores, so a quiet report must not read as a pass.
  const store = run.pages.some((p) => p.kind.startsWith("PRODUCT"));
  // The founder's next step per finding: as reviewed on the Bench, else the standard step.
  const steps = run.findings.map((f) => f.whatToDo || whatToDo(f.checkId, f.checkResult.detail, run.platform));
  const recheck = `${rupees(priceOf("RECHECK").basePaise)} + GST`;

  return (
    <>
      {preview ? (
        <div style={{ background: "var(--brass)", color: "#fff", textAlign: "center", padding: "8px 16px", fontSize: 14 }}>
          Bench preview: this report is not published yet. <Link href={`/bench/runs/${run.id}`} style={{ color: "#fff" }}>Back to review</Link>
        </div>
      ) : null}
      <SiteHeader />
      <section className="report-head" style={{ marginTop: -64, paddingTop: "calc(64px + clamp(40px, 7vw, 72px))" }}>
        <div className="wrap">
          <div style={{ marginBottom: 20 }}><BrandLogo width={200} /></div>
          <p className="eyebrow">First Look · {date}</p>
          <h1 style={{ marginTop: 14 }}>Your store, as a first-time buyer meets it.</h1>
          <p className="meta" style={{ marginTop: 14, maxWidth: 620 }}>
            We opened <strong style={{ color: "var(--navy-900)" }}>{run.storeName || run.domain}</strong> on a phone and a desktop, the way a new buyer does, from the homepage to the first screen of checkout. Below is what may stop people ordering, and what to do about it. The pages we looked at:
          </p>
          <div className="pages-seen">
            {seen.map((p) => (
              <span className="chip" key={p.id}>{pageLabel(p.kind)}</span>
            ))}
          </div>
        </div>
      </section>

      <main className="wrap" style={{ marginTop: -64, position: "relative" }}>
        <div className="summary-tiles">
          <div className="card tile">
            <div className="n">{run.findings.length}</div>
            <div className="t">{run.findings.length === 1 ? "thing" : "things"} to fix first</div>
          </div>
          <div className="card tile">
            <div className="n">{run.otherIssues}</div>
            <div className="t">other issues noticed across {run.otherLenses} {run.otherLenses === 1 ? "area" : "areas"}</div>
          </div>
          <div className="card tile">
            <div className="n">{run.checksPassed}</div>
            <div className="t">checks your store already passes</div>
          </div>
        </div>

        <div className="stack" style={{ ["--stack" as string]: "24px", marginTop: 32 }}>
          {run.findings.length ? (
            run.findings.map((f, i) => {
              const citation = f.checkResult.citation as unknown as Citation | null;
              const page = run.pages.find((p) => p.kind === citation?.pageKind) ?? null;
              return <FindingCard key={f.id} index={i + 1} lens={f.lens} title={f.title} observed={f.observed} likelyEffect={f.likelyEffect} notYetProven={f.notYetProven} whatToDo={steps[i]} citation={citation} page={page} why={whyBuyersCare(f.checkId)} lensName={lensNameFor(f.checkId)} />;
            })
          ) : (
            store ? (
              <div className="card card-pad stack">
                <h2>Nothing serious enough to lead with.</h2>
                <p className="muted">Your store passed the checks that most often cost a first order. That is a credible result, not a gap in our review.</p>
              </div>
            ) : (
              <div className="card card-pad stack">
                <h2>We couldn&apos;t find anything to buy here.</h2>
                <p className="muted">QUARR checks online stores. We found no product pages on {run.domain}, so the checks about products, prices, the cart and checkout couldn&apos;t run. Read this as a partial look, not a clean result.</p>
              </div>
            )
          )}
        </div>

        {run.findings.length ? (
          <section className="card card-pad stack next-steps" style={{ marginTop: 40 }} aria-labelledby="next-h">
            <p className="eyebrow">Your next steps</p>
            <h2 id="next-h" style={{ fontSize: "clamp(22px, 3vw, 28px)" }}>What to do now</h2>
            <ol>
              <li>
                <strong>Fix the first one: {run.findings[0].title.replace(/[.]$/, "")}.</strong> {steps[0]}
              </li>
              {run.findings.length > 1 ? (
                <li>
                  <strong>Then {run.findings.length === 2 ? "the second" : "the next two"}:</strong> {run.findings.slice(1).map((f) => f.title.replace(/[.]$/, "")).join("; ")}. Each card above says what to do.
                </li>
              ) : null}

        {run.otherIssues > 0 ? (
          <p className="lede" style={{ marginTop: 32 }}>
            We also noticed <strong>{run.otherIssues} other {run.otherIssues === 1 ? "issue" : "issues"}</strong> across {run.otherLenses} {run.otherLenses === 1 ? "area" : "areas"} of your store. They are saved, and the full journey starts from them.
          </p>
        ) : null}

        <section className="card card-pad stack" style={{ marginTop: 40 }} aria-labelledby="journey-h">
          <p className="eyebrow">The buyer&apos;s journey, question by question</p>
          <h2 id="journey-h" style={{ fontSize: "clamp(22px, 3vw, 28px)" }}>What we could check, and what only you can answer</h2>
          <p className="small muted">QUARR looks at a store through the questions a first-time buyer has to answer before trusting you with an order. Where your website can&apos;t show us the answer, we say so rather than guess.</p>
          <div className="lens-table">
            {lenses.map((c) => (
              <div className="lens-row" key={c.lens.id}>
                <div>
                  <strong>{c.lens.name}</strong>
                  <p className="small muted">{c.lens.buyerQuestion}</p>
                </div>
                <div>
                  {c.status === "unknown" ? (
                    <>
                      <span className="chip unseen">Not visible from your website</span>
                      <p className="small" style={{ marginTop: 6 }}>{c.lens.founderQuestions[0]}</p>
                    </>
                  ) : (
                    <span className={`chip ${c.failed ? "fail" : "pass"} status`}>
                      {c.failed ? `${c.failed} ${c.failed === 1 ? "problem" : "problems"}, ` : ""}{c.passed} passed{c.status === "partly" ? ", partly visible" : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="split" style={{ marginTop: 40 }}>
          <div className="card card-pad stack">
            <p className="eyebrow">What held up</p>
            <ul className="list-clean small">
              {passedNames.map((n) => (
                <li className="tick" key={n}>{n}</li>
              ))}
            </ul>
          </div>
          <div className="card card-pad stack">
            <p className="eyebrow">Limits of this review</p>
            <ul className="list-clean small">
              <li className="cross">We did not pay, log in, enter a pincode or submit any form.</li>
              <li className="cross">This is one visit, at one moment, from an automated browser. Your real visitors&apos; networks and devices vary.</li>
              <li className="cross">We read text, not text inside images.</li>
              {!store ? <li className="cross">We found no product pages, so checks about products, prices, the cart and checkout didn&apos;t run.</li> : null}
              <li className="cross">Findings describe likely buyer behaviour. They are not legal advice.</li>
            </ul>
          </div>
        </div>

              <li>
                <strong>Re-check your store</strong> once you&apos;ve made the changes. QUARR walks it again and shows you what&apos;s fixed, what&apos;s still open and anything new. {recheck}, from <Link href="/account">your account</Link>.
              </li>
            </ol>
          </section>
        ) : null}
        <div className="card card-pad" style={{ marginTop: 40, display: "grid", gap: 14, borderColor: "var(--navy-100)" }}>
          <p className="eyebrow brass">When you want every issue, not just the first few</p>
          <h3>Walk your whole path to a first order with an expert: {rupees(priceOf("JOURNEY").basePaise)} + GST</h3>
          <p className="muted">
            A QUARR Expert covers everything above{run.otherIssues ? ` and the ${run.otherIssues} other ${run.otherIssues === 1 ? "issue" : "issues"}` : ""}, end to end, and you leave with a ranked action list.
          </p>
          <Link href={`/journey?from=${run.publicToken}`} className="btn btn-ghost" style={{ justifySelf: "start" }}>See what&apos;s included</Link>
        </div>

        <p className="small muted" style={{ marginTop: 32, display: "flex", gap: 10, alignItems: "center" }}>
          <span className="brass-rule" aria-hidden />
          {run.autoPublished
            ? "Every finding was checked before it reached you, by QUARR checks that have each held up in 30 expert reviews in a row."
            : "A QUARR Expert checked every finding before it reached you."}
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
