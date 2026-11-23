import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountHeader } from "@/components/AccountHeader";
import { BuyButton } from "@/components/BuyButton";
import { SiteFooter } from "@/components/chrome";
import { FindingCard, pageLabel } from "@/components/FindingCard";
import { FULL_STEPS, LiveProgress } from "@/components/LiveProgress";
import { RecheckForm } from "@/components/RecheckForm";
import type { InstantSummary, RecheckItem, RecheckSummary } from "@/engine/summary";
import { db } from "@/lib/db";
import { priceOf, rupees } from "@/lib/payments";
import { creditsFor } from "@/lib/runs";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your First Look", robots: { index: false } };

const WORKING = ["QUEUED", "CRAWLING", "CRAWLED", "CHECKED"];

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/account/runs/${id}`);
  const run = await db.run.findFirst({
    where: { id, userId: user.id, kind: { in: ["FULL", "RECHECK"] } },
    include: { pages: { select: { kind: true, url: true, finalUrl: true, mobileShot: true, desktopShot: true, mobileHeight: true, desktopHeight: true } } },
  });
  if (!run) notFound();

  const [credits, journey] = await Promise.all([
    creditsFor(user.id),
    db.purchase.findFirst({ where: { userId: user.id, product: "JOURNEY", status: "PAID", domain: run.domain } }),
  ]);
  const working = WORKING.includes(run.status);
  const reviewed = ["PUBLISHED", "DELIVERED"].includes(run.status);
  const done = !working && run.status !== "CRAWL_FAILED" && run.status !== "REJECTED";
  const pageFor = (kind?: string) => run.pages.find((p) => p.kind === kind) ?? null;
  const journeyPrice = priceOf("JOURNEY");
  const recheckPrice = priceOf("RECHECK");

  return (
    <>
      <AccountHeader email={user.email} />
      <main className="wrap" style={{ paddingTop: 40, maxWidth: 1000 }}>
        <p className="small"><Link href="/account">← Your stores</Link></p>
        <p className="eyebrow brass" style={{ marginTop: 16 }}>{run.kind === "RECHECK" ? "Re-check" : "First Look"} · {run.domain}</p>

        {working ? (
          <>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", margin: "10px 0 24px" }}>{run.kind === "RECHECK" ? "Walking your store again." : "Walking your whole store."}</h1>
            <LiveProgress token={run.publicToken} steps={FULL_STEPS} />
          </>
        ) : null}

        {run.status === "CRAWL_FAILED" ? (
          <div className="stack" style={{ marginTop: 10 }}>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>We couldn&apos;t finish this walk.</h1>
            <div className="card card-pad stack">
              <p className="muted">
                {run.failureCode === "BLOCKED" ? "Your store's bot protection stopped our browser." : run.failureCode === "TIMEOUT" ? "Your store took longer than our limit allows." : "Something stopped our browser partway through."}{" "}
                {run.kind === "RECHECK" ? "Your re-check credit has been returned." : "A QUARR Expert will do your First Look by hand instead and email you, at no cost."}
              </p>
            </div>
          </div>
        ) : null}

        {run.kind === "FULL" && done ? <FullView run={run} reviewed={reviewed} pageFor={pageFor} /> : null}
        {run.kind === "RECHECK" && run.status === "READY" ? <RecheckView sum={run.summary as unknown as RecheckSummary} /> : null}

        {done ? (
          <div className="split" style={{ marginTop: 40 }}>
            <div className="card card-pad stack">
              <p className="eyebrow brass">Fixed something?</p>
              <h3>Re-check your store</h3>
              <p className="muted small">We walk it again and show you, check by check, what&apos;s fixed, what&apos;s still open, and anything new.</p>
              {credits > 0 ? <RecheckForm runId={run.id} credits={credits} /> : <BuyButton product="RECHECK" label={`Buy a re-check · ${rupees(recheckPrice.basePaise)} + GST`} />}
            </div>
            <div className="card card-pad stack" style={{ borderColor: "var(--navy-100)" }}>
              <p className="eyebrow brass">Go deeper</p>
              <h3>The full first-purchase journey</h3>
              {journey ? (
                <p className="muted small">Booked. We&apos;ll email you within one working day to confirm the scope. If it doesn&apos;t fit what you need, we refund in full.</p>
              ) : (
                <>
                  <p className="muted small">A QUARR Expert walks your whole path to a first order and gives you a prioritised action guide. If the scope doesn&apos;t fit after we talk, full refund.</p>
                  <BuyButton product="JOURNEY" runId={run.id} label={`Book the journey · ${rupees(journeyPrice.basePaise)} + GST`} className="btn btn-ghost" />
                  <Link href="/journey" className="small">What&apos;s included</Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}

type RunWithPages = { publicToken: string; domain: string; summary: unknown; otherIssues: number; pages: { kind: string }[] };

function FullView({ run, reviewed, pageFor }: { run: RunWithPages; reviewed: boolean; pageFor: (k?: string) => Parameters<typeof FindingCard>[0]["page"] }) {
  const sum = run.summary as InstantSummary | null;
  return (
    <div className="stack" style={{ ["--stack" as string]: "24px", marginTop: 10 }}>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", maxWidth: "24ch" }}>
        {reviewed ? "Your reviewed First Look is ready." : sum?.issues ? `We found ${sum.issues} things a first-time buyer may question.` : "Your store held up well."}
      </h1>
      {reviewed ? (
        <div className="card card-pad stack">
          <p className="muted">A QUARR Expert has read every finding and picked the three most likely to cost you a first order, each with its screenshot.</p>
          <Link href={`/r/${run.publicToken}`} className="btn btn-primary" style={{ justifySelf: "start" }}>Read your First Look</Link>
        </div>
      ) : (
        <div className="card card-pad row" style={{ gap: 14, alignItems: "flex-start" }}>
          <span className="chip brass">Expert review in progress</span>
          <p className="small muted" style={{ flex: 1, minWidth: 240 }}>
            Below is what we can show you right away. A QUARR Expert is reading the other {sum?.heldForReview ?? 0} findings now. Your reviewed First Look arrives by email within 12 hours, usually much sooner.
          </p>
        </div>
      )}
      {sum?.byLens.length ? (
        <div className="row" style={{ gap: 8 }}>{sum.byLens.map((l) => <span key={l.lens} className="chip fail status">{l.name}: {l.n} possible {l.n === 1 ? "problem" : "problems"}</span>)}</div>
      ) : null}
      {!reviewed && sum?.findings.length
        ? sum.findings.map((f, i) => <FindingCard key={f.checkId} index={i + 1} {...f} page={pageFor(f.citation?.pageKind)} />)
        : null}
      {sum ? <p className="small muted">{sum.passed} checks passed.</p> : null}
    </div>
  );
}

function RecheckView({ sum }: { sum: RecheckSummary }) {
  const hidden = sum.hidden ?? { fixed: 0, stillOpen: 0, appeared: 0, unverified: 0 };
  const block = (title: string, items: RecheckItem[], tone: string, empty: string, more = 0) => (
    <div className="card card-pad stack">
      <div className="spread"><h3>{title}</h3><span className={`chip status ${tone}`}>{items.length + more} {tone === "pass" ? "fixed" : tone === "fail" ? (items.length + more === 1 ? "problem" : "problems") : "not assessed"}</span></div>
      {more ? <p className="small muted">{items.length ? `Plus ${more} more` : `${more}`} from checks a QUARR Expert hasn&apos;t reviewed with you yet. They&apos;re named in your reviewed First Look or journey.</p> : null}
      {items.length ? (
        <ul className="list-clean small">
          {items.map((i) => (
            <li key={i.checkId} className={tone === "pass" ? "tick" : tone === "fail" ? "problem" : "not-assessed"}>
              <span><strong style={{ color: "var(--navy-900)" }}>{i.title}</strong>{i.citation ? <span className="muted"> · {pageLabel(i.citation.pageKind)}</span> : null}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">{empty}</p>
      )}
    </div>
  );
  return (
    <div className="stack" style={{ ["--stack" as string]: "18px", marginTop: 10 }}>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{sum.fixed.length + hidden.fixed} fixed · {sum.stillOpen.length + hidden.stillOpen} still open · {sum.appeared.length + hidden.appeared} new</h1>
      <p className="muted small">&quot;Fixed&quot; means a check that failed last time now passes on your live store. Nothing more is assumed.</p>
      {block("Fixed", sum.fixed, "pass", "Nothing from last time is fixed yet.", hidden.fixed)}
      {block("Still open", sum.stillOpen, "fail", "Nothing from last time is still open.", hidden.stillOpen)}
      {block("New since last time", sum.appeared, "fail", "Nothing new appeared.", hidden.appeared)}
      {sum.unverified.length + hidden.unverified ? block("Not assessed this time", sum.unverified, "unseen", "We could not see these pages on this walk, so we can't say whether they are fixed.", hidden.unverified) : null}
    </div>
  );
}
