import { lensNameFor, whyBuyersCare } from "@/engine/framework";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { FindingCard } from "@/components/FindingCard";
import { LiveProgress, PREVIEW_STEPS } from "@/components/LiveProgress";
import { whatToDo } from "@/engine/checks/fixes";
import type { PreviewSummary } from "@/engine/summary";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your scan", robots: { index: false } };

export default async function Scan({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const run = await db.run.findUnique({
    where: { publicToken: token },
    include: { pages: { select: { kind: true, url: true, finalUrl: true, mobileShot: true, desktopShot: true, mobileHeight: true, desktopHeight: true } } },
  });
  if (!run || run.kind !== "PREVIEW") notFound();
  const user = await currentUser();
  const unlock = user ? `/account/claim/${run.publicToken}` : `/signin?next=${encodeURIComponent(`/account/claim/${run.publicToken}`)}`;
  const ready = run.status === "READY";
  const failed = run.status === "CRAWL_FAILED";
  const sum = (ready ? run.summary : null) as PreviewSummary | null;
  const teaserPage = sum?.teaser?.citation ? run.pages.find((p) => p.kind === sum.teaser!.citation!.pageKind) ?? null : null;
  // No product page: QUARR's checks are for stores, so a quiet result must not read as a pass.
  const store = run.pages.some((p) => p.kind.startsWith("PRODUCT"));

  return (
    <>
      <SiteHeader />
      <main className="wrap" style={{ paddingTop: 48, maxWidth: 960 }}>
        <p className="eyebrow brass">Quick scan · {run.domain}</p>

        {!ready && !failed ? (
          <>
            <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)", margin: "12px 0 24px" }}>Walking your store like a first-time buyer.</h1>
            <LiveProgress token={run.publicToken} steps={PREVIEW_STEPS} />
          </>
        ) : null}

        {failed ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)" }}>We couldn&apos;t walk this store.</h1>
            <div className="card card-pad stack">
              <p>
                {run.failureCode === "BLOCKED"
                  ? "Your store's bot protection stopped our browser at the door."
                  : run.failureCode === "PASSWORD"
                    ? "Your store is behind a password page, so there's nothing a buyer can see yet."
                    : "We couldn't load the address you gave us."}
              </p>
              <p className="muted">Sign up anyway and a QUARR Expert will do your First Look by hand, at no cost.</p>
              <Link href={user ? "/account" : "/signin"} className="btn btn-primary" style={{ justifySelf: "start" }}>Sign up free</Link>
            </div>
          </div>
        ) : null}

        {sum ? (
          <div className="stack" style={{ ["--stack" as string]: "24px", marginTop: 12 }}>
            <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)", maxWidth: "22ch" }}>
              {!store
                ? `We couldn't find anything to buy on ${run.domain}.`
                : sum.issues
                  ? `${sum.issues} ${sum.issues === 1 ? "thing" : "things"} on ${run.domain} may stop a first-time buyer ordering.`
                  : `Nothing obvious stood out in a quick walk of ${run.domain}.`}
            </h1>
            {!store ? (
              <p className="lede">
                QUARR checks online stores: product pages, prices, the cart and the policies a buyer reads before paying. We found no product pages, so most of our checks couldn&apos;t run, and this isn&apos;t a clean bill of health. If it is a store, sign up and a QUARR Expert will look at it by hand.
              </p>
            ) : (
              <p className="lede">
                That&apos;s from a one-minute walk of your homepage, one product page and your policies. Your free First Look also walks your cart, the start of checkout and a second product, on a phone and a desktop, and tells you what to do about each issue.
              </p>
            )}

            {sum.byLens.length ? (
              <div className="row" style={{ gap: 8 }}>
                {sum.byLens.map((l) => (
                  <span key={l.lens} className="chip fail status">{l.name}: {l.n} possible {l.n === 1 ? "problem" : "problems"}</span>
                ))}
              </div>
            ) : null}

            {sum.teaser ? (
              <div className="stack" style={{ ["--stack" as string]: "10px" }}>
                <div className="row"><span className="chip dark">Automated preview</span><span className="small muted">One you can start fixing today. A person checks the rest before you see them.</span></div>
                <FindingCard index={1} {...sum.teaser} whatToDo={sum.teaser.whatToDo || whatToDo(sum.teaser.checkId, null, run.platform)} page={teaserPage} why={whyBuyersCare(sum.teaser.checkId)} lensName={lensNameFor(sum.teaser.checkId)} />
              </div>
            ) : sum.issues ? (
              <p className="card card-pad muted">We only show a finding straight away when the evidence leaves no room for doubt. Yours need a person to check them first, so you&apos;ll see each one, with what to do, in your First Look.</p>
            ) : null}

            <div className="offer">
              <div className="stack">
                <p className="eyebrow" style={{ color: "rgba(255,255,255,0.7)" }}>Free</p>
                <h2>See what to fix, free</h2>
                <p>
                  Sign up with Google or your email and the full walk starts straight away: your cart, the start of checkout, every policy, on a phone and a desktop. You see the first findings in minutes, each with what to do, and your full First Look by email once a person has checked it.
                </p>
              </div>
              <div className="stack" style={{ justifySelf: "start" }}>
                {/* A plain link: the claim route redirects, which needs a full page load. */}
                <a href={unlock} className="btn btn-light" style={{ padding: "14px 22px" }}>{user ? "Start my full First Look" : "Sign up free to see what to fix"}</a>
                <p className="small" style={{ color: "rgba(255,255,255,0.6)" }}>No card. No call.</p>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
