import Link from "next/link";
import { notFound } from "next/navigation";
import { markFunnel, rejectRun, requeueRun } from "@/app/bench/actions";
import { ReviewWorkspace, type WFinding } from "@/components/bench/ReviewWorkspace";
import { CHECKS_BY_ID } from "@/engine/checks";
import { coverage } from "@/engine/framework";
import { checkModes } from "@/engine/promotion";
import type { Citation } from "@/engine/types";
import { appUrl } from "@/lib/email";
import { db } from "@/lib/db";

export default async function RunReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let run = await db.run.findUnique({
    where: { id },
    include: {
      pages: { select: { id: true, kind: true, url: true, finalUrl: true, httpStatus: true, mobileShot: true, desktopShot: true, mobileHeight: true, desktopHeight: true } },
      findings: { include: { checkResult: { select: { citation: true, detail: true, evidenceStrength: true } } }, orderBy: [{ selected: "desc" }, { position: "asc" }, { score: "desc" }] },
      results: { select: { checkId: true, outcome: true, detail: true } },
    },
  });
  if (!run) notFound();
  if (run.status === "IN_REVIEW" && !run.reviewStartAt) {
    await db.run.update({ where: { id }, data: { reviewStartAt: new Date() } });
  }
  const modes = await checkModes();

  const toW = (f: (typeof run)["findings"][number]): WFinding => ({
    id: f.id,
    checkId: f.checkId,
    checkName: CHECKS_BY_ID[f.checkId]?.name ?? f.checkId,
    lens: f.lens,
    title: f.title,
    observed: f.observed,
    likelyEffect: f.likelyEffect,
    notYetProven: f.notYetProven,
    state: f.state,
    editReason: f.editReason,
    draftedBy: f.draftedBy,
    score: f.score,
    selected: f.selected,
    mode: modes.get(f.checkId) ?? "REVIEW",
    citation: f.checkResult.citation as unknown as Citation | null,
  });
  const shown = run.findings.filter((f) => f.selected && f.state !== "DROPPED").map(toW);
  const others = run.findings.filter((f) => !f.selected || f.state === "DROPPED").map(toW);
  const passes = run.results.filter((r) => r.outcome === "PASS").map((r) => CHECKS_BY_ID[r.checkId]?.name ?? r.checkId);
  const unseen = run.results.filter((r) => r.outcome === "NOT_OBSERVABLE").map((r) => ({ id: r.checkId, name: CHECKS_BY_ID[r.checkId]?.name ?? r.checkId, why: String((r.detail as { why?: string } | null)?.why ?? "") }));
  const published = ["PUBLISHED", "DELIVERED"].includes(run.status);
  const reportLink = appUrl(`/r/${run.publicToken}`);

  return (
    <div className="stack" style={{ ["--stack" as string]: "16px" }}>
      <div className="spread">
        <div className="stack" style={{ ["--stack" as string]: "6px" }}>
          <p className="mini"><Link href="/bench">← Queue</Link></p>
          <h1>{run.domain}</h1>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip">{run.status.replace("_", " ").toLowerCase()}</span>
            <span className={`chip ${run.source === "PUBLIC" ? "brass" : ""}`}>{run.source === "PUBLIC" ? `Founder · ${run.email}` : "Outreach"}</span>
            {run.platform ? <span className="chip unseen">{run.platform}</span> : null}
            {run.autoPublished ? <span className="chip pass">auto-published</span> : null}
            {run.reviewSeconds ? <span className="chip unseen">reviewed in {(run.reviewSeconds / 60).toFixed(1)} min</span> : null}
            <a className="mini" href={run.storeUrl} target="_blank" rel="noreferrer">Open store ↗</a>
          </div>
        </div>
        <div className="row">
          <Link href={`/r/${run.publicToken}`} className="btn btn-ghost btn-sm" target="_blank">{published ? "Open report ↗" : "Preview report ↗"}</Link>
          {run.status === "CRAWL_FAILED" || run.status === "REJECTED" || run.status === "IN_REVIEW" ? (
            <form action={requeueRun}><input type="hidden" name="runId" value={run.id} /><button className="btn btn-ghost btn-sm">Re-run crawl</button></form>
          ) : null}
          {!published && run.status !== "REJECTED" ? (
            <form action={rejectRun}><input type="hidden" name="runId" value={run.id} /><button className="btn btn-danger btn-sm">Reject</button></form>
          ) : null}
        </div>
      </div>

      {run.status === "CRAWL_FAILED" ? (
        <p className="alert">Crawl failed: <strong>{run.failureCode}</strong>, {run.failureDetail}. {run.source === "PUBLIC" ? "The founder was emailed and offered a manual First Look." : ""}</p>
      ) : null}
      {run.notes ? <p className="alert">{run.notes}</p> : null}
      <details className="card card-pad">
        <summary className="small"><strong>Framework coverage</strong>: what this walk could and couldn&apos;t answer</summary>
        <ul className="list-clean small" style={{ marginTop: 8 }}>
          {coverage(run.results).map((c) => (
            <li key={c.lens.id} style={{ marginBottom: 6 }}>
              <strong>{c.lens.name}</strong>: {c.status === "unknown" ? <span className="muted">Unknown. Ask: {c.lens.founderQuestions.join(" ")}</span> : `${c.failed} fail, ${c.passed} pass, ${c.unseen} not seen`}
            </li>
          ))}
        </ul>
      </details>

      {published ? (
        <div className="card card-pad stack" style={{ boxShadow: "none" }}>
          <p className="mini">Report link{run.source === "BENCH" ? " (send this in your outreach message)" : ""}</p>
          <code style={{ overflowWrap: "anywhere", fontSize: 14 }}>{reportLink}</code>
          <div className="row">
            {run.source === "BENCH" && run.status !== "DELIVERED" ? (
              <form action={markFunnel}><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="field" value="delivered" /><button className="btn btn-ghost btn-sm">Mark as sent</button></form>
            ) : null}
            <form action={markFunnel}><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="field" value="replied" /><button className="btn btn-ghost btn-sm" disabled={!!run.repliedAt}>{run.repliedAt ? "Replied ✓" : "Owner replied"}</button></form>
            <form action={markFunnel}><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="field" value="paid" /><button className="btn btn-ghost btn-sm" disabled={!!run.paidAt}>{run.paidAt ? "Paid ✓" : "Owner paid"}</button></form>
          </div>
        </div>
      ) : null}

      {run.pages.length ? (
        <ReviewWorkspace
          runId={run.id}
          canPublish={["IN_REVIEW", "DRAFTED", "APPROVED"].includes(run.status)}
          pages={run.pages.map((p) => ({ kind: p.kind, url: p.finalUrl ?? p.url, httpStatus: p.httpStatus, mobileShot: p.mobileShot, desktopShot: p.desktopShot, mobileHeight: p.mobileHeight, desktopHeight: p.desktopHeight }))}
          shown={shown}
          others={others}
          passes={passes}
          unseen={unseen}
        />
      ) : run.status === "QUEUED" || run.status === "CRAWLING" ? (
        <p className="card card-pad muted">Waiting for the worker. Refresh in a minute.</p>
      ) : null}
    </div>
  );
}
