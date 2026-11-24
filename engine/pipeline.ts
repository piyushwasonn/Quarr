import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { putFile } from "@/lib/storage";
import { publishRun, sendFailureEmail, sendRecheckEmail } from "@/lib/deliver";
import { CHECKS, CHECKS_BY_ID } from "./checks";
import { crawlStore } from "./crawl";
import { checkModes } from "./promotion";
import { candidateFrom, scoreOf, selectFindings } from "./select";
import { instantSummary, previewSummary, recheckSummary, type ResultRow } from "./summary";
import type { CheckContext, CheckVerdict, Citation, CrawlSignals, PageData, PageKind, StoredPage } from "./types";
import { draftFindings, lastWriterIssue } from "./write";
import { aiSummaryLine, analyseRun, toShadow } from "./ai/analyse";
import { providers } from "./ai/model";
import { aiCleared, aiVerdictOf } from "./summary";

// Writes the crawler's current step for the founder's live screen, in order.
function progressWriter(runId: string) {
  let chain = Promise.resolve();
  const set = (step: string | null) => {
    chain = chain.then(() => db.run.update({ where: { id: runId }, data: { progress: step } }).then(() => undefined)).catch(() => undefined);
  };
  return { set, flush: () => chain };
}

// PREVIEW: QUEUED → CRAWLING → CRAWLED → READY (teaser)
// FULL:    QUEUED → CRAWLING → CRAWLED → DRAFTED → IN_REVIEW (or auto-publish)
// RECHECK: QUEUED → CRAWLING → CRAWLED → READY (comparison with the earlier run)
export async function processRun(runId: string) {
  const run = await db.run.update({ where: { id: runId }, data: { status: "CRAWLING", lockedAt: new Date(), attempts: { increment: 1 } } });
  const log = (msg: string) => console.log(`[run ${run.id} ${run.kind} ${run.domain}] ${msg}`);
  const progress = progressWriter(run.id);

  log("crawling");
  const crawl = await crawlStore(run.storeUrl, { mode: run.kind === "PREVIEW" ? "preview" : "full", onProgress: progress.set });
  await progress.flush();
  if (!crawl.ok) {
    log(`crawl failed: ${crawl.code} ${crawl.detail}`);
    await db.run.update({ where: { id: run.id }, data: { status: "CRAWL_FAILED", failureCode: crawl.code, failureDetail: crawl.detail, lockedAt: null, progress: null } });
    if (run.kind !== "PREVIEW" && run.source === "PUBLIC" && run.email) await sendFailureEmail(run.id).catch((e) => log(`failure email error: ${e}`));
    return;
  }

  // Evidence first: every finding must be traceable to a stored page.
  const stored: Partial<Record<PageKind, StoredPage>> = {};
  const firstScreens: Partial<Record<PageKind, Buffer>> = {};
  for (const p of crawl.pages) {
    const base = `runs/${run.id}/${p.kind.toLowerCase()}`;
    const mobileShot = p.mobileShot ? await putFile(`${base}-mobile.jpg`, p.mobileShot) : null;
    const desktopShot = p.desktopShot ? await putFile(`${base}-desktop.jpg`, p.desktopShot) : null;
    const row = await db.page.create({
      data: {
        runId: run.id,
        kind: p.kind,
        url: p.url,
        finalUrl: p.finalUrl,
        httpStatus: p.httpStatus,
        title: p.title,
        text: p.text,
        mobileShot,
        desktopShot,
        mobileHeight: p.mobileHeight,
        desktopHeight: p.desktopHeight,
        data: p.data as unknown as Prisma.InputJsonValue,
      },
    });
    stored[p.kind] = { id: row.id, kind: p.kind, url: p.url, finalUrl: p.finalUrl, httpStatus: p.httpStatus, title: p.title, text: p.text, data: p.data };
    if (p.firstScreen) firstScreens[p.kind] = p.firstScreen;
  }
  await db.run.update({
    where: { id: run.id },
    data: { status: "CRAWLED", crawledAt: new Date(), platform: crawl.signals.platform, storeName: crawl.signals.storeName, notes: crawl.signals.isStore ? null : "Partial review: no product pages found." },
  });
  log(`crawled ${crawl.pages.length} pages (${crawl.signals.platform})`);

  progress.set("Running QUARR's checks");
  const first = await runChecks(run.id, { pages: stored, signals: crawl.signals });
  log(`rules: ${first.checked.FAIL} fail, ${first.checked.PASS} pass, ${first.checked.NOT_OBSERVABLE} not observable`);

  // QUARR's AI reads the pages: answers the AI-judged checks and double-checks every failed rule.
  // With QUARR_AI_SHADOW set, the other provider reads the same pages at the same time.
  // Its answers are recorded for the Bench comparison and never change what a founder sees.
  const aiInput = { judge: run.kind !== "PREVIEW", pages: stored, firstScreens, storeName: crawl.signals.storeName, fails: first.results.filter((r) => r.outcome === "FAIL"), cacheKey: `quarr-${run.id}` };
  const { primary, shadow } = providers();
  const [ai, shadowRun] = await Promise.all([
    analyseRun({ ...aiInput, provider: primary, onProgress: progress.set }),
    shadow ? analyseRun({ ...aiInput, provider: shadow }).catch(() => null) : Promise.resolve(null),
  ]);
  for (const v of ai.judged) {
    const row = first.results.find((r) => r.checkId === v.checkId);
    if (!row) continue;
    const citation = v.citation ? { ...v.citation, pageId: stored[v.citation.pageKind]?.id ?? null } : undefined;
    await db.checkResult.update({
      where: { id: row.id },
      data: { outcome: v.outcome, evidenceStrength: v.outcome === "FAIL" ? (v.evidenceStrength ?? 0.65) : v.outcome === "PASS" ? 1 : 0, citation: citation as Prisma.InputJsonValue | undefined, detail: (v.detail ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  }
  for (const [checkId, verdict] of ai.verdicts) {
    const row = first.results.find((r) => r.checkId === checkId);
    if (row) await db.checkResult.update({ where: { id: row.id }, data: { ai: verdict as unknown as Prisma.InputJsonValue } });
  }
  const aiLine = aiSummaryLine(ai.report);
  const before = await db.run.findUnique({ where: { id: run.id }, select: { notes: true } });
  const shadowRecord = shadowRun ? toShadow(shadowRun) : null;
  const shadowLine = shadowRecord ? `Shadow ${aiSummaryLine(shadowRecord.report)}` : null;
  await db.run.update({
    where: { id: run.id },
    data: { ai: { ...ai.report, ...(shadowRecord ? { shadow: shadowRecord } : {}) } as unknown as Prisma.InputJsonValue, notes: [before?.notes, aiLine, shadowLine].filter(Boolean).join(" · ").slice(0, 1200) },
  });
  log(aiLine);
  if (shadowLine) log(shadowLine);

  const results = await db.checkResult.findMany({ where: { runId: run.id } });
  const checked = { PASS: 0, FAIL: 0, NOT_OBSERVABLE: 0 };
  for (const r of results) checked[r.outcome === "FAIL" && aiVerdictOf(r) === "REFUTED" ? "NOT_OBSERVABLE" : r.outcome]++;

  const modes = await checkModes();
  const auto = new Set([...modes].filter(([, m]) => m === "AUTO").map(([id]) => id));
  const rows = results as ResultRow[];
  const counts = { checksPassed: checked.PASS, checksNotSeen: checked.NOT_OBSERVABLE };

  if (run.kind === "PREVIEW") {
    await progress.flush();
    await db.run.update({ where: { id: run.id }, data: { status: "READY", summary: previewSummary(rows, auto) as unknown as Prisma.InputJsonValue, ...counts, progress: null, lockedAt: null } });
    log("preview ready");
    return;
  }

  if (run.kind === "RECHECK") {
    const before = run.parentRunId ? ((await db.checkResult.findMany({ where: { runId: run.parentRunId } })) as ResultRow[]) : [];
    const visible = run.parentRunId ? await visibleChecks(run.parentRunId) : new Set<string>();
    await progress.flush();
    await db.run.update({ where: { id: run.id }, data: { status: "READY", summary: recheckSummary(before, rows, visible, auto) as unknown as Prisma.InputJsonValue, ...counts, progress: null, lockedAt: null } });
    log("re-check ready");
    if (run.email) await sendRecheckEmail(run.id).catch((e) => log(`re-check email error: ${e}`));
    return;
  }
  // Every failed check gets a finding row (the Bench sees all of them, with the AI's verdict),
  // but one the AI refuted with a verified quote is never picked to lead.
  const candidates = results
    .filter((r) => r.outcome === "FAIL" && modes.get(r.checkId) !== "SUSPENDED")
    .map(candidateFrom)
    .filter((c): c is NonNullable<typeof c> => !!c);
  const refuted = new Set(results.filter((r) => aiVerdictOf(r) === "REFUTED").map((r) => r.id));
  const { selected, otherIssues, otherLenses } = selectFindings(candidates.filter((c) => !refuted.has(c.resultId)));
  const selectedIds = new Set(selected.map((s) => s.resultId));

  const drafts = await draftFindings(
    crawl.signals.storeName,
    selected.map((s) => {
      const r = results.find((x) => x.id === s.resultId)!;
      const def = CHECKS_BY_ID[s.checkId];
      const citation = r.citation as unknown as Citation;
      const detail = (r.detail ?? {}) as Record<string, unknown>;
      return { checkId: s.checkId, checkName: def.name, template: def.copy(detail, citation), citation, detail };
    }),
  );

  if (lastWriterIssue && lastWriterIssue !== "No ANTHROPIC_API_KEY") {
    const cur = await db.run.findUnique({ where: { id: run.id }, select: { notes: true } });
    await db.run.update({ where: { id: run.id }, data: { notes: [cur?.notes, `AI wording: ${lastWriterIssue}`].filter(Boolean).join(" · ").slice(0, 500) } });
  }

  for (const c of candidates) {
    const r = results.find((x) => x.id === c.resultId)!;
    const def = CHECKS_BY_ID[c.checkId];
    const position = selected.findIndex((s) => s.resultId === c.resultId);
    const draft = drafts.find((d) => d.checkId === c.checkId && selectedIds.has(c.resultId));
    const copy = draft ?? { ...def.copy((r.detail ?? {}) as Record<string, unknown>, r.citation as unknown as Citation), draftedBy: "template" as const };
    await db.finding.create({
      data: {
        runId: run.id,
        checkResultId: r.id,
        checkId: c.checkId,
        lens: c.lens,
        score: scoreOf(c),
        selected: position >= 0,
        position: position >= 0 ? position : null,
        title: copy.title,
        observed: copy.observed,
        likelyEffect: copy.likelyEffect,
        notYetProven: copy.notYetProven,
        draftedBy: copy.draftedBy,
        original: { title: copy.title, observed: copy.observed, likelyEffect: copy.likelyEffect, notYetProven: copy.notYetProven },
      },
    });
  }

  // Publishing without a person needs AI to have run fully and cleared every finding shown.
  const autoEligible =
    ai.report.status === "on" &&
    selected.length > 0 &&
    selected.every((s) => modes.get(s.checkId) === "AUTO" && aiCleared(results.find((r) => r.id === s.resultId)!));
  await db.run.update({
    where: { id: run.id },
    data: {
      status: "DRAFTED",
      otherIssues,
      otherLenses,
      ...counts,
      summary: instantSummary(rows, auto) as unknown as Prisma.InputJsonValue,
      progress: null,
      lockedAt: null,
    },
  });

  if (autoEligible) {
    log("all selected checks are AUTO: publishing without review");
    await db.run.update({ where: { id: run.id }, data: { autoPublished: true } });
    await publishRun(run.id);
  } else {
    await db.run.update({ where: { id: run.id }, data: { status: "IN_REVIEW" } });
    log(`in review: ${selected.length} findings drafted`);
  }
}

export async function runChecks(runId: string, ctx: CheckContext) {
  const checked = { PASS: 0, FAIL: 0, NOT_OBSERVABLE: 0 };
  const results = [];
  for (const def of CHECKS) {
    let v: CheckVerdict;
    try {
      v = def.run(ctx);
    } catch (err) {
      v = { outcome: "NOT_OBSERVABLE", detail: { why: `Check error: ${err instanceof Error ? err.message : String(err)}` } };
    }
    // No citation, no finding.
    if (v.outcome === "FAIL" && !v.citation) v = { outcome: "NOT_OBSERVABLE", detail: { why: "Fired without a citation" } };
    checked[v.outcome]++;
    const citation = v.citation ? { ...v.citation, pageId: ctx.pages[v.citation.pageKind]?.id ?? null } : null;
    results.push(
      await db.checkResult.create({
        data: {
          runId,
          checkId: def.id,
          lens: def.lens,
          outcome: v.outcome,
          severity: def.severity,
          evidenceStrength: v.outcome === "FAIL" ? (v.evidenceStrength ?? 0.8) : v.outcome === "PASS" ? 1 : 0,
          citation: (citation ?? undefined) as Prisma.InputJsonValue | undefined,
          detail: (v.detail ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      }),
    );
  }
  return { results, checked };
}

// Rebuild a check context from stored evidence (used by tests and re-checks).
export function contextFromRows(pages: { id: string; kind: string; url: string; finalUrl: string | null; httpStatus: number | null; title: string | null; text: string; data: unknown }[], signals: CrawlSignals): CheckContext {
  const out: Partial<Record<PageKind, StoredPage>> = {};
  for (const p of pages) {
    out[p.kind as PageKind] = { id: p.id, kind: p.kind as PageKind, url: p.url, finalUrl: p.finalUrl ?? p.url, httpStatus: p.httpStatus, title: p.title ?? "", text: p.text, data: p.data as PageData };
  }
  return { pages: out, signals };
}

// Checks the founder has already been shown by name on a run: its instant findings,
// the Expert-approved findings once published, or what an earlier re-check named.
async function visibleChecks(runId: string) {
  const run = await db.run.findUnique({ where: { id: runId }, include: { findings: { where: { selected: true, state: { not: "DROPPED" } }, select: { checkId: true } } } });
  const out = new Set<string>();
  if (!run) return out;
  const sum = (run.summary ?? {}) as { findings?: { checkId: string }[]; visible?: string[] };
  for (const f of sum.findings ?? []) out.add(f.checkId);
  for (const id of sum.visible ?? []) out.add(id);
  if (["PUBLISHED", "DELIVERED"].includes(run.status)) for (const f of run.findings) out.add(f.checkId);
  return out;
}
