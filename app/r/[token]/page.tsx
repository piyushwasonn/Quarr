import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo, SiteFooter, SiteHeader } from "@/components/chrome";
import { FindingCard, pageLabel } from "@/components/FindingCard";
import { CHECKS_BY_ID } from "@/engine/checks";
import type { Citation } from "@/engine/types";
import { isBenchSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "First Look", robots: { index: false, follow: false } };

export default async function Report({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const run = await db.run.findUnique({
    where: { publicToken: token },
    include: {
      findings: { where: { selected: true, state: { not: "DROPPED" } }, orderBy: { position: "asc" }, include: { checkResult: true } },
      pages: { select: { id: true, kind: true, url: true, finalUrl: true, mobileShot: true, desktopShot: true, mobileHeight: true, desktopHeight: true } },
      results: { where: { outcome: "PASS" }, select: { checkId: true } },
    },
  });
  if (!run) notFound();
  const published = ["PUBLISHED", "DELIVERED"].includes(run.status);
  const preview = !published && (await isBenchSession());
  if (!published && !preview) notFound();

  const date = (run.publishedAt ?? run.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const order = ["HOME", "PRODUCT_1", "PRODUCT_2", "CART", "CHECKOUT", "SHIPPING", "RETURNS", "TERMS", "PRIVACY", "CONTACT", "ABOUT"];
  const seen = [...run.pages].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const passedNames = run.results.map((r) => CHECKS_BY_ID[r.checkId]?.name).filter(Boolean).slice(0, 8);

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
          <h1 style={{ marginTop: 14 }}>What a first-time buyer meets on {run.storeName ? `${run.storeName}` : run.domain}.</h1>
          <p className="meta" style={{ marginTop: 14, maxWidth: 620 }}>
            We walked <strong style={{ color: "#fff" }}>{run.domain}</strong> on a 390 px phone and a desktop screen, from the homepage to the first screen of checkout. These are the pages we looked at:
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
            <div className="t">{run.findings.length === 1 ? "finding" : "findings"} worth your attention first</div>
          </div>
          <div className="card tile">
            <div className="n">{run.otherIssues}</div>
            <div className="t">other issues noticed across {run.otherLenses} {run.otherLenses === 1 ? "area" : "areas"}</div>
          </div>
          <div className="card tile">
            <div className="n">{run.checksPassed}</div>
            <div className="t">checks your store passed</div>
          </div>
        </div>

        <div className="stack" style={{ ["--stack" as string]: "24px", marginTop: 32 }}>
          {run.findings.length ? (
            run.findings.map((f, i) => {
              const citation = f.checkResult.citation as unknown as Citation | null;
              const page = run.pages.find((p) => p.kind === citation?.pageKind) ?? null;
              return <FindingCard key={f.id} index={i + 1} lens={f.lens} title={f.title} observed={f.observed} likelyEffect={f.likelyEffect} notYetProven={f.notYetProven} citation={citation} page={page} />;
            })
          ) : (
            <div className="card card-pad stack">
              <h2>Nothing serious enough to lead with.</h2>
              <p className="muted">Your store passed the checks that most often cost a first order. That is a credible result, not a gap in our review.</p>
            </div>
          )}
        </div>

        {run.otherIssues > 0 ? (
          <p className="lede" style={{ marginTop: 32 }}>
            We also observed <strong>{run.otherIssues} other {run.otherIssues === 1 ? "issue" : "issues"}</strong> across {run.otherLenses} {run.otherLenses === 1 ? "area" : "areas"} of your store. They are recorded, and the full journey starts from them.
          </p>
        ) : null}

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
              <li className="cross">Findings describe likely buyer behaviour. They are not legal advice.</li>
            </ul>
          </div>
        </div>

        <div className="card card-pad" style={{ marginTop: 40, display: "grid", gap: 14, borderColor: "var(--navy-100)" }}>
          <p className="eyebrow brass">If you want to go further</p>
          <h3>Walk the full first-purchase journey with QUARR: ₹5,000 + GST</h3>
          <p className="muted">
            A QUARR Expert covers everything above and the {run.otherIssues} other issues, end to end, and gives you a prioritised action guide.
          </p>
          <Link href={`/journey?from=${run.publicToken}`} className="btn btn-ghost" style={{ justifySelf: "start" }}>See what&apos;s included</Link>
        </div>

        <p className="small muted" style={{ marginTop: 32, display: "flex", gap: 10, alignItems: "center" }}>
          <span className="brass-rule" aria-hidden />
          {run.autoPublished
            ? "Prepared by QUARR's engine using checks that have each passed 30 consecutive expert reviews."
            : "Reviewed by a QUARR Expert before it was sent."}
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
