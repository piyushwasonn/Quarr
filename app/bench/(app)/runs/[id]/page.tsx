import Link from "next/link";
import { notFound } from "next/navigation";
import { markFunnel, rejectRun, requeueRun } from "@/app/bench/actions";
import { ReviewWorkspace, type WFinding } from "@/components/bench/ReviewWorkspace";
import { aiSummaryLine, type AiReport } from "@/engine/ai/analyse";
import { costUsd } from "@/engine/ai/compare";
import { CHECKS_BY_ID } from "@/engine/checks";
import { coverage } from "@/engine/framework";
import { FRAMEWORK_LENS_BY_ID, FRAMEWORK_LENSES, type FrameworkLensId } from "@/engine/framework/lenses";
import { isStoreRun } from "@/engine/learn";
import { MissedForm } from "@/components/bench/MissedForm";
import { checkModes } from "@/engine/promotion";
import type { Citation } from "@/engine/types";
import { appUrl } from "@/lib/email";
import { db } from "@/lib/db";

type RunAi = AiReport & { shadow?: { report: AiReport } };

// What QUARR's AI did on this run, as a status card rather than an alert.
function AiCard({ report }: { report: RunAi }) {
  const on = report.status !== "off";
  const cost = costUsd(report.model, report.usage);
  const inr = Number(process.env.INR_PER_USD ?? 90);
  const costText = cost !== null ? `, about $${cost.toFixed(3)} (₹${Math.round(cost * inr)})` : "";
  const quotesText = report.quotesRejected ? ` ${report.quotesRejected} quote(s) didn't match the page and were ignored.` : "";
  const sh = report.shadow?.report;
  const label = report.status === "on" ? "ran" : report.status === "partial" ? "partly ran" : "off";
  const tone = report.status === "on" ? "pass" : report.status === "partial" ? "unseen" : "fail";
  return (
    <div className="card card-pad stack" style={{ ["--stack" as string]: "6px", boxShadow: "none" }}>
      <div className="row" style={{ gap: 8 }}>
        <span className={`chip status ${tone}`}>QUARR AI {label}</span>
        <span className="small">{report.provider ?? "no provider"} · {report.model}</span>
      </div>
      {on ? (
        <p className="small">
          Rule findings: <strong>{report.verified.confirmed}</strong> confirmed, <strong>{report.verified.refuted}</strong> overturned, <strong>{report.verified.unsure}</strong> unsure. AI checks: <strong>{report.judged.fail}</strong> with a problem, {report.judged.pass} passed, {report.judged.unknown} couldn&apos;t tell.{quotesText} Took {Math.round(report.ms / 1000)} s{costText}.{report.reason ? ` Problem: ${report.reason}` : ""}
        </p>
      ) : (
        <p className="small">Off: {report.reason ?? "unknown reason"}. Nothing from this run was shown to the founder without your review.</p>
      )}
      {sh ? <p className="mini muted">Comparison model ({sh.provider}): {sh.status === "off" ? `not running (${sh.reason ?? "unknown reason"})` : "ran; see Bench → AI"}.</p> : null}
    </div>
  );
}

// Older runs wrote the AI summary into their notes; leave those lines out now that the card shows it.
function notesWithoutAi(notes: string | null, report: RunAi | null) {
  let out = notes ?? "";
  if (report) {
    const lines = [aiSummaryLine(report), report.shadow ? `Shadow ${aiSummaryLine(report.shadow.report)}` : ""];
    for (const line of lines) if (line) out = out.replace(line, "");
    out = out.split(" · ").map((s) => s.trim()).filter(Boolean).join(" · ");
  }
  return out;
}

type Q = { page: string; text: string };
type ShadowView = { report?: { provider?: string; model?: string }; verdicts?: Record<string, { verdict: string; reason: string }>; judged?: Record<string, { outcome: string; reason: string }> } | undefined;
function aiView(checkId: string, ai: unknown, detail: unknown, shadow: ShadowView): WFinding["ai"] {
  const other = shadow
    ? checkId.startsWith("AI-")
      ? shadow.judged?.[checkId] && { provider: `${shadow.report?.provider}: ${shadow.report?.model}`, verdict: shadow.judged[checkId].outcome === "FAIL" ? "ALSO FAILS" : shadow.judged[checkId].outcome === "PASS" ? "PASSES" : "UNKNOWN", reason: shadow.judged[checkId].reason }
      : shadow.verdicts?.[checkId] && { provider: `${shadow.report?.provider}: ${shadow.report?.model}`, verdict: shadow.verdicts[checkId].verdict, reason: shadow.verdicts[checkId].reason }
    : undefined;
  if (checkId.startsWith("AI-")) {
    const d = (detail ?? {}) as { reason?: string; quotes?: Q[]; judgedBy?: string };
    return { kind: "judged", verdict: "JUDGED", reason: d.reason ?? "", quotes: d.quotes ?? [], by: d.judgedBy, other: other || undefined };
  }
  const v = ai as { verdict?: string; reason?: string; quotes?: Q[] } | null;
  return v?.verdict ? { kind: "verified", verdict: v.verdict, reason: v.reason ?? "", quotes: v.quotes ?? [], other: other || undefined } : null;
}

export default async function RunReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let run = await db.run.findUnique({
    where: { id },
    include: {
      pages: { select: { id: true, kind: true, url: true, finalUrl: true, httpStatus: true, mobileShot: true, desktopShot: true, mobileHeight: true, desktopHeight: true } },
      findings: { include: { checkResult: { select: { citation: true, detail: true, evidenceStrength: true, ai: true } } }, orderBy: [{ selected: "desc" }, { position: "asc" }, { score: "desc" }] },
      results: { select: { checkId: true, outcome: true, detail: true } },
      learnings: { orderBy: { createdAt: "desc" } },
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
    ai: aiView(f.checkId, f.checkResult.ai, f.checkResult.detail, (run.ai as { shadow?: ShadowView } | null)?.shadow),
  });
  const shown = run.findings.filter((f) => f.selected && f.state !== "DROPPED").map(toW);
  const others = run.findings.filter((f) => !f.selected || f.state === "DROPPED").map(toW);
  const passes = run.results.filter((r) => r.outcome === "PASS").map((r) => CHECKS_BY_ID[r.checkId]?.name ?? r.checkId);
  const unseen = run.results.filter((r) => r.outcome === "NOT_OBSERVABLE").map((r) => ({ id: r.checkId, name: CHECKS_BY_ID[r.checkId]?.name ?? r.checkId, why: String((r.detail as { why?: string } | null)?.why ?? "") }));
  const published = ["PUBLISHED", "DELIVERED"].includes(run.status);
  const reportLink = appUrl(`/r/${run.publicToken}`);
  const working = ["QUEUED", "CRAWLING", "CRAWLED"].includes(run.status);
  const store = isStoreRun(run);

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
      {working ? (
        <p className="card card-pad small" style={{ boxShadow: "none" }}>
          <span className="chip unseen">Still working</span> {run.progress ?? (run.status === "CRAWLED" ? "Running checks and the AI, then drafting findings." : "Waiting for the crawler.")} Findings appear when it finishes; refresh in a minute.
        </p>
      ) : null}
      {!working && run.pages.length && !store ? (
        <p className="card card-pad small" style={{ boxShadow: "none" }}>
          <span className="chip fail">Not an online store</span> QUARR found no product pages on {run.domain}, so most checks couldn&apos;t run and a clean result here means little. If it is a store, the crawler couldn&apos;t find its products: note that below. Publishing tells the founder plainly that this isn&apos;t a store check.
        </p>
      ) : null}
      {run.ai ? <AiCard report={run.ai as unknown as RunAi} /> : null}
      {notesWithoutAi(run.notes, run.ai as unknown as RunAi | null) ? <p className="alert">{notesWithoutAi(run.notes, run.ai as unknown as RunAi | null)}</p> : null}
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
          <p className="mini muted">Outreach tracking: mark when you&apos;ve sent this link to the store&apos;s founder, when they reply, and when they pay. It feeds the funnel numbers on the queue.</p>
          <div className="row">
            {run.source === "BENCH" && run.status !== "DELIVERED" ? (
              <form action={markFunnel}><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="field" value="delivered" /><button className="btn btn-ghost btn-sm">Mark as sent</button></form>
            ) : null}
            <form action={markFunnel}><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="field" value="replied" /><button className="btn btn-ghost btn-sm" disabled={!!run.repliedAt}>{run.repliedAt ? "Founder replied ✓" : "Founder replied"}</button></form>
            <form action={markFunnel}><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="field" value="paid" /><button className="btn btn-ghost btn-sm" disabled={!!run.paidAt}>{run.paidAt ? "Founder paid ✓" : "Founder paid"}</button></form>
          </div>
        </div>
      ) : null}

      {run.pages.length ? (
        <ReviewWorkspace
          runId={run.id}
          canPublish={["IN_REVIEW", "DRAFTED", "APPROVED"].includes(run.status)}
          emailsFounder={run.source === "PUBLIC" && !!run.email}
          pages={run.pages.map((p) => ({ kind: p.kind, url: p.finalUrl ?? p.url, httpStatus: p.httpStatus, mobileShot: p.mobileShot, desktopShot: p.desktopShot, mobileHeight: p.mobileHeight, desktopHeight: p.desktopHeight }))}
          shown={shown}
          others={others}
          passes={passes}
          unseen={unseen}
        />
      ) : run.status === "QUEUED" || run.status === "CRAWLING" ? (
        <p className="card card-pad muted">Waiting for the worker. Refresh in a minute.</p>
      ) : null}

      {!working ? (
        <section className="card card-pad stack" style={{ boxShadow: "none" }}>
          <h3 style={{ margin: 0 }}>What did QUARR miss?</h3>
          <p className="small muted">Anything a first-time buyer would trip over that no finding covers. Each note goes to <Link href="/bench/learnings">Learnings</Link> as a candidate for a new check.</p>
          {run.learnings.length ? (
            <ul className="list-clean small">
              {run.learnings.map((l) => (
                <li key={l.id}><div><span className="mini">{l.kind === "NOTE" ? "Note" : "Missed"}{l.lens ? ` · ${FRAMEWORK_LENS_BY_ID[l.lens as FrameworkLensId]?.name ?? l.lens}` : ""} · {l.status.toLowerCase()}</span><br />{l.note}</div></li>
              ))}
            </ul>
          ) : null}
          <MissedForm runId={run.id} lenses={FRAMEWORK_LENSES.map((l) => ({ id: l.id, name: l.name }))} />
        </section>
      ) : null}
    </div>
  );
}
