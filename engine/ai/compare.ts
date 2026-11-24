// Scores each AI provider against the best ground truth QUARR has: your decisions on the
// Bench. A finding you approved or edited is real; one you dropped as FALSE_POSITIVE or
// EVIDENCE_WRONG is not. Other decisions (wording, severity, unsafe) say nothing about
// whether the finding was true, so they are left out.

export type ReviewedFinding = { checkId: string; state: string; editReason: string | null; ai: unknown; detail: unknown };
export type RunForCompare = {
  ai: unknown; // AiReport, with .shadow when a second provider ran
  findings: ReviewedFinding[];
  results: { checkId: string; outcome: string }[];
};

export type ProviderScore = {
  provider: string;
  model: string;
  role: "primary" | "shadow";
  runs: number;
  ran: number; // runs where it was on or partial
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  ms: number;
  // Second readings of rule findings you reviewed
  reviewed: number;
  agreed: number; // confirmed a real one, or refuted a wrong one
  hidReal: number; // refuted a finding you kept: the costly mistake
  letWrong: number; // confirmed a finding you dropped as wrong
  unsure: number;
  // AI-judged checks you reviewed
  judgedReviewed: number;
  judgedAgreed: number;
  // AI-judged failures only the shadow raised (no one has reviewed these)
  shadowOnlyFails: number;
};

const truthOf = (f: ReviewedFinding): boolean | null => {
  if (f.state === "APPROVED" || f.state === "EDITED") return true;
  if (f.state === "DROPPED" && (f.editReason === "FALSE_POSITIVE" || f.editReason === "EVIDENCE_WRONG")) return false;
  return null;
};

type Report = { status?: string; provider?: string | null; model?: string; usage?: ProviderScore["usage"]; ms?: number; shadow?: Shadow };
type Shadow = { report: Report; verdicts?: Record<string, { verdict: string }>; judged?: Record<string, { outcome: string }> };

function blank(provider: string, model: string, role: ProviderScore["role"]): ProviderScore {
  return { provider, model, role, runs: 0, ran: 0, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, ms: 0, reviewed: 0, agreed: 0, hidReal: 0, letWrong: 0, unsure: 0, judgedReviewed: 0, judgedAgreed: 0, shadowOnlyFails: 0 };
}

function tally(s: ProviderScore, verdict: string | undefined, real: boolean) {
  if (!verdict) return;
  s.reviewed++;
  if (verdict === "UNSURE") s.unsure++;
  else if ((verdict === "CONFIRMED" && real) || (verdict === "REFUTED" && !real)) s.agreed++;
  else if (verdict === "REFUTED" && real) s.hidReal++;
  else if (verdict === "CONFIRMED" && !real) s.letWrong++;
}

export function compareProviders(runs: RunForCompare[]): ProviderScore[] {
  const scores = new Map<string, ProviderScore>();
  const get = (r: Report, role: ProviderScore["role"]) => {
    const key = `${role}|${r.provider ?? "none"}|${r.model ?? ""}`;
    if (!scores.has(key)) scores.set(key, blank(r.provider ?? "none", r.model ?? "", role));
    return scores.get(key)!;
  };
  const addRun = (s: ProviderScore, r: Report) => {
    s.runs++;
    if (r.status === "on" || r.status === "partial") s.ran++;
    if (r.usage) for (const k of ["input", "output", "cacheRead", "cacheWrite"] as const) s.usage[k] += r.usage[k] ?? 0;
    s.ms += r.ms ?? 0;
  };

  for (const run of runs) {
    const report = run.ai as Report | null;
    if (!report?.provider) continue;
    const p = get(report, "primary");
    addRun(p, report);
    const sh = report.shadow;
    const s = sh?.report?.provider ? get(sh.report, "shadow") : null;
    if (s && sh) addRun(s, sh.report);

    for (const f of run.findings) {
      const real = truthOf(f);
      if (real === null) continue;
      if (f.checkId.startsWith("AI-")) {
        // Only the primary's AI-judged failures become findings you review.
        p.judgedReviewed++;
        if (real) p.judgedAgreed++;
        if (s && sh?.judged?.[f.checkId]) {
          s.judgedReviewed++;
          if ((sh.judged[f.checkId].outcome === "FAIL") === real) s.judgedAgreed++;
        }
        continue;
      }
      tally(p, (f.ai as { verdict?: string } | null)?.verdict, real);
      if (s) tally(s, sh?.verdicts?.[f.checkId]?.verdict, real);
    }
    if (s && sh?.judged) {
      for (const [id, j] of Object.entries(sh.judged)) {
        const primaryOutcome = run.results.find((r) => r.checkId === id)?.outcome;
        if (j.outcome === "FAIL" && primaryOutcome !== "FAIL") s.shadowOnlyFails++;
      }
    }
  }
  return [...scores.values()].sort((a, b) => (a.role === b.role ? b.runs - a.runs : a.role === "primary" ? -1 : 1));
}

type Env = Record<string, string | undefined>;
// List prices in US$ per million tokens: [input, output, cache read, cache write].
// Anthropic's are built in. Others (OpenAI) come from AI_PRICES on Netlify, for example
// {"gpt-6.1-sol":[2,10,0.2,0]}, copied from the provider's own pricing page.
const BUILT_IN: Record<string, [number, number, number, number]> = {
  "claude-opus-5-5": [4, 20, 0.2, 5],
  "claude-sonnet-5-5": [2, 10, 0.1, 2.5],
};

export function costUsd(model: string, usage: ProviderScore["usage"], env: Env = process.env): number | null {
  let extra: Record<string, number[]> = {};
  try {
    extra = env.AI_PRICES ? JSON.parse(env.AI_PRICES) : {};
  } catch {
    extra = {};
  }
  const p = extra[model] ?? BUILT_IN[model];
  if (!p || p.length < 2) return null;
  const [inp, out, read = inp, write = inp] = p;
  return (usage.input * inp + usage.output * out + usage.cacheRead * read + usage.cacheWrite * write) / 1_000_000;
}
