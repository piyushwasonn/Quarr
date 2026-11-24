import type { PageKind, StoredPage } from "../types";
import { buildEvidence } from "./evidence";
import { judgeChecks, type JudgedVerdict } from "./judge";
import { addUsage, aiUnavailable, modelFor, NO_USAGE, providers, type Provider, type Usage } from "./model";
import { verifyFails, type AiVerdict, type FailRow } from "./verify";

// QUARR's AI step for one run, between the rules and the founder:
//   1. judge:  answer the AI-judged checks (full First Look and re-checks)
//   2. verify: give every failed rule a second reading
// If AI can't run, the report says so and nothing is shown to a founder without review.

export type AiReport = {
  status: "on" | "partial" | "off";
  provider: Provider | null;
  model: string;
  reason?: string;
  verified: { confirmed: number; refuted: number; unsure: number };
  judged: { pass: number; fail: number; unknown: number };
  quotesRejected: number;
  usage: Usage;
  ms: number;
  at: string;
};

export async function analyseRun(opts: {
  judge: boolean;
  pages: Partial<Record<PageKind, StoredPage>>;
  firstScreens?: Partial<Record<PageKind, Buffer>>;
  storeName: string | null;
  fails: FailRow[];
  onProgress?: (step: string) => void;
  provider?: Provider | null; // default: the primary provider
  cacheKey?: string;
}): Promise<{ report: AiReport; verdicts: Map<string, AiVerdict>; judged: JudgedVerdict[] }> {
  const provider = opts.provider === undefined ? providers().primary : opts.provider;
  const report: AiReport = { status: "off", provider, model: provider ? (modelFor(provider) ?? "not set") : "none", verified: { confirmed: 0, refuted: 0, unsure: 0 }, judged: { pass: 0, fail: 0, unknown: 0 }, quotesRejected: 0, usage: NO_USAGE, ms: 0, at: new Date().toISOString() };
  const off = aiUnavailable(provider);
  if (off) return { report: { ...report, reason: off }, verdicts: new Map(), judged: [] };

  const evidence = buildEvidence(opts.pages, opts.firstScreens, opts.storeName);
  // Cache the evidence only when two calls read it (judge, then verify).
  const cacheKey = opts.judge ? opts.cacheKey : undefined;
  const problems: string[] = [];
  let judged: JudgedVerdict[] = [];

  if (opts.judge) {
    opts.onProgress?.("Reading your pages the way a careful buyer would");
    const j = await judgeChecks(evidence, opts.pages, provider!, cacheKey);
    report.usage = addUsage(report.usage, j.usage);
    report.ms += j.ms;
    if (j.ok) {
      judged = j.verdicts;
      for (const v of judged) {
        if (v.outcome === "PASS") report.judged.pass++;
        else if (v.outcome === "FAIL") report.judged.fail++;
        else report.judged.unknown++;
        report.quotesRejected += Number((v.detail as { rejectedQuotes?: number } | undefined)?.rejectedQuotes ?? 0);
      }
    } else problems.push(`AI-judged checks: ${j.reason}`);
  }

  opts.onProgress?.("Double-checking every finding against your pages");
  const ruleFails = opts.fails.filter((f) => !f.checkId.startsWith("AI-"));
  const v = await verifyFails(evidence, opts.pages, ruleFails, provider!, cacheKey);
  report.usage = addUsage(report.usage, v.usage);
  report.ms += v.ms;
  if (v.ok) {
    for (const x of v.verdicts.values()) {
      if (x.verdict === "CONFIRMED") report.verified.confirmed++;
      else if (x.verdict === "REFUTED") report.verified.refuted++;
      else report.verified.unsure++;
      report.quotesRejected += x.rejectedQuotes;
    }
  } else problems.push(`Verifier: ${v.reason}`);

  const verifierOk = v.ok;
  report.status = verifierOk && !problems.length ? "on" : verifierOk || judged.length ? "partial" : "off";
  if (problems.length) report.reason = problems.join(" · ").slice(0, 500);
  return { report, verdicts: v.verdicts, judged };
}

// The second provider's reading, when QUARR_AI_SHADOW is set. Recorded on the run for the
// Bench comparison (/bench/ai); it never changes what a founder sees.
export type ShadowRecord = {
  report: AiReport;
  verdicts: Record<string, { verdict: string; reason: string; quotes: { page: string; text: string }[] }>;
  judged: Record<string, { outcome: string; reason: string; quotes: { page: string; text: string }[] }>;
};

export function toShadow(r: Awaited<ReturnType<typeof analyseRun>>): ShadowRecord {
  const verdicts: ShadowRecord["verdicts"] = {};
  for (const [id, v] of r.verdicts) verdicts[id] = { verdict: v.verdict, reason: v.reason, quotes: v.quotes };
  const judged: ShadowRecord["judged"] = {};
  for (const j of r.judged) {
    const d = (j.detail ?? {}) as { reason?: string; why?: string; quotes?: { page: string; text: string }[] };
    judged[j.checkId] = { outcome: j.outcome, reason: d.reason ?? d.why ?? "", quotes: d.quotes ?? [] };
  }
  return { report: r.report, verdicts, judged };
}

export function aiSummaryLine(r: AiReport) {
  if (r.status === "off") return `AI off${r.provider ? ` (${r.provider})` : ""}: ${r.reason ?? "unknown reason"}. Nothing is shown to the founder without review.`;
  const parts = [`AI ${r.status} (${r.provider ?? "none"}: ${r.model})`, `verified ${r.verified.confirmed} confirmed, ${r.verified.refuted} refuted, ${r.verified.unsure} unsure`];
  if (r.judged.pass + r.judged.fail + r.judged.unknown) parts.push(`AI checks ${r.judged.fail} fail, ${r.judged.pass} pass, ${r.judged.unknown} unknown`);
  if (r.quotesRejected) parts.push(`${r.quotesRejected} quote(s) not found on the page and ignored`);
  if (r.reason) parts.push(r.reason);
  return parts.join(" · ");
}
