import Link from "next/link";
import { AccountHeader } from "@/components/AccountHeader";
import { BuyButton } from "@/components/BuyButton";
import { SiteFooter } from "@/components/chrome";
import { db } from "@/lib/db";
import { priceOf, rupees } from "@/lib/payments";
import { creditsFor } from "@/lib/runs";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your stores", robots: { index: false } };

const STATUS: Record<string, [string, string]> = {
  QUEUED: ["Starting", ""],
  CRAWLING: ["Walking your store", ""],
  CRAWLED: ["Checking", ""],
  CHECKED: ["Checking", ""],
  DRAFTED: ["First findings ready · Expert reviewing", "brass"],
  IN_REVIEW: ["First findings ready · Expert reviewing", "brass"],
  APPROVED: ["Reviewed", "pass"],
  PUBLISHED: ["Reviewed First Look ready", "pass"],
  DELIVERED: ["Reviewed First Look ready", "pass"],
  READY: ["Ready", "pass"],
  CRAWL_FAILED: ["Couldn't walk the store", "fail"],
  REJECTED: ["Closed", "unseen"],
};

export default async function Account({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const user = await requireUser("/account");
  const { notice } = await searchParams;
  const [runs, credits, purchases] = await Promise.all([
    db.run.findMany({ where: { userId: user.id, kind: { in: ["FULL", "RECHECK"] } }, orderBy: { createdAt: "desc" }, take: 100 }),
    creditsFor(user.id),
    db.purchase.findMany({ where: { userId: user.id, status: { in: ["PAID", "REFUNDED"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const domains = [...new Set(runs.map((r) => r.domain))];
  const recheckPrice = priceOf("RECHECK");

  return (
    <>
      <AccountHeader email={user.email} />
      <main className="wrap" style={{ paddingTop: 40, maxWidth: 960 }}>
        <div className="spread">
          <div className="stack" style={{ ["--stack" as string]: "6px" }}>
            <p className="eyebrow brass">Your account</p>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>Your stores</h1>
          </div>
          <Link href="/#start" className="btn btn-ghost">Scan another store</Link>
        </div>

        {notice === "claimed" ? <p className="alert" style={{ marginTop: 20 }}>That store already had its full walk today, so we couldn&apos;t start another. Try again tomorrow, or write to us.</p> : null}

        <div className="summary-tiles" style={{ marginTop: 24 }}>
          <div className="card tile"><div className="n">{domains.length}</div><div className="t">{domains.length === 1 ? "store" : "stores"} walked</div></div>
          <div className="card tile"><div className="n">{credits}</div><div className="t">re-check {credits === 1 ? "credit" : "credits"} left</div></div>
          <div className="card tile stack" style={{ ["--stack" as string]: "8px" }}>
            <div className="t" style={{ marginTop: 0 }}>Made changes? Re-check your store and see what you fixed.</div>
            <BuyButton product="RECHECK" label={`Buy a re-check · ${rupees(recheckPrice.basePaise)} + GST`} className="btn btn-ghost btn-sm" />
          </div>
        </div>

        <div className="stack" style={{ ["--stack" as string]: "12px", marginTop: 32 }}>
          {runs.length ? (
            runs.map((r) => {
              const [label, tone] = STATUS[r.status] ?? [r.status, ""];
              return (
                <Link key={r.id} href={`/account/runs/${r.id}`} className="card card-pad spread" style={{ textDecoration: "none", color: "inherit", padding: "18px 22px" }}>
                  <div className="stack" style={{ ["--stack" as string]: "4px" }}>
                    <strong style={{ fontSize: 17, color: "var(--navy-900)" }}>{r.domain}</strong>
                    <span className="small muted">{r.kind === "RECHECK" ? "Re-check" : "First Look"} · {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <span className={`chip ${tone === "pass" || tone === "fail" ? `status ${tone}` : tone}`}>{label}</span>
                </Link>
              );
            })
          ) : (
            <div className="card card-pad stack">
              <h3>No stores yet</h3>
              <p className="muted">Scan your store from the homepage. It takes about a minute.</p>
              <Link href="/#start" className="btn btn-primary" style={{ justifySelf: "start" }}>Scan my store</Link>
            </div>
          )}
        </div>

        {purchases.length ? (
          <div className="card card-pad stack" style={{ marginTop: 32 }}>
            <h3>Purchases</h3>
            <ul className="list-clean small">
              {purchases.map((p) => (
                <li key={p.id} style={{ justifyContent: "space-between" }}>
                  <span>{p.product === "JOURNEY" ? "First-purchase journey" : "Re-check credit"}{p.domain ? ` · ${p.domain}` : ""}</span>
                  <span className="muted">{rupees(p.amountPaise)} · {p.status === "REFUNDED" ? "refunded" : p.paidAt?.toLocaleDateString("en-IN")}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
