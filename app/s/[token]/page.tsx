import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your First Look", robots: { index: false } };

const FAILURE: Record<string, string> = {
  BLOCKED: "Your store's bot protection stopped our browser at the door, so we couldn't walk it the way a buyer would.",
  PASSWORD: "Your store is behind a password page, so there's nothing a buyer can see yet.",
  NOT_STORE: "We couldn't find products on this site, so it doesn't look like a store we can review.",
  UNREACHABLE: "We couldn't load the address you gave us. Please check it and try again.",
  TIMEOUT: "Your store took longer to walk than our limit allows. We stopped rather than send you half a report.",
  ERROR: "Something went wrong on our side.",
};

export default async function Status({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const run = await db.run.findUnique({ where: { publicToken: token } });
  if (!run) notFound();

  const ready = ["PUBLISHED", "DELIVERED"].includes(run.status);
  const failed = run.status === "CRAWL_FAILED" || run.status === "REJECTED";
  const stage = ready ? 3 : ["QUEUED"].includes(run.status) ? 1 : 2;
  const steps = [
    ["Received", `We have ${run.domain} in the queue.`],
    ["Being prepared", "Walking your store on a phone and a laptop, then a QUARR Expert reads every finding."],
    ["Ready", "Your First Look is ready to read. We've also emailed it to you."],
  ];

  return (
    <>
      {!ready && !failed ? <meta httpEquiv="refresh" content="20" /> : null}
      <SiteHeader />
      <main className="wrap narrow" style={{ paddingTop: 56 }}>
        <p className="eyebrow brass">First Look · {run.domain}</p>
        <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)", margin: "12px 0 28px" }}>
          {ready ? "Your First Look is ready." : failed ? "We couldn't finish this one." : "We're walking your store."}
        </h1>

        {failed ? (
          <div className="card card-pad stack">
            <p>{FAILURE[run.failureCode ?? "ERROR"] ?? FAILURE.ERROR}</p>
            <p className="muted">
              Reply to the email we sent to <strong>{run.email}</strong> and a QUARR Expert will do your First Look by hand instead, at no cost.
            </p>
            <Link href="/" className="btn btn-ghost" style={{ justifySelf: "start" }}>Back to QUARR</Link>
          </div>
        ) : (
          <div className="card card-pad">
            <ol className="timeline">
              {steps.map(([t, d], i) => (
                <li key={t} className={i + 1 < stage || (ready && i + 1 === stage) ? "done" : i + 1 === stage ? "now" : ""}>
                  <span className="dot">{i + 1 < stage || (ready && i + 1 === stage) ? "✓" : ""}</span>
                  <div>
                    <strong>{t}</strong>
                    <span className="muted small">{d}</span>
                  </div>
                </li>
              ))}
            </ol>
            {ready ? (
              <Link href={`/r/${run.publicToken}`} className="btn btn-primary">Read your First Look</Link>
            ) : (
              <p className="small muted">
                You can close this page. We&apos;ll email <strong>{run.email}</strong> when it&apos;s ready, within 12 hours and usually much sooner. This page updates by itself.
              </p>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
