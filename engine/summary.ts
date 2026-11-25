import { CHECKS_BY_ID } from "./checks";
import { whatToDo } from "./checks/fixes";
import { candidateFrom, selectFindings } from "./select";
import { ENGINE_VERSION } from "./version";
import { toLens } from "./framework/lenses";
import { LENS_NAMES, type Citation, type FindingCopy, type Lens, type Outcome } from "./types";

// What QUARR may show without a person reading it first (Notion 07):
// directly observed facts only, plus any check that has earned AUTO in the Bench.
// Never an absence ("we couldn't find X"): a crawler limit can cause that, and a wrong
// finding costs more trust than a missed one (learned on weobserve.in, 24 Nov 2026).
const PRECISION_SAFE = new Set(["TRST-05", "AVAIL-02", "PROM-03", "TRST-06"]);

export function isInstantSafe(checkId: string, detail: Record<string, unknown> | null | undefined, autoChecks: Set<string> = new Set()) {
  if (autoChecks.has(checkId) || PRECISION_SAFE.has(checkId)) return true;
  // A policy page is only safe to name when its link exists and returns an error.
  if ((checkId === "RTRN-01" || checkId === "DELV-03") && detail?.kind === "broken") return true;
  // A hidden shipping charge is only safe when the page literally says "calculated at checkout".
  return checkId === "PRIC-02" && detail?.deferred === true;
}

export type ResultRow = { id: string; checkId: string; lens: string; outcome: Outcome; evidenceStrength: number; citation: unknown; detail: unknown; ai?: unknown };

// The AI's second reading of a failed rule (engine/ai/verify.ts), if it ran.
export const aiVerdictOf = (r: Pick<ResultRow, "ai">) => ((r.ai ?? null) as { verdict?: string } | null)?.verdict ?? null;

// Cleared by AI: a rule the verifier confirmed, or an AI-judged check (which already had to
// quote the page). Nothing reaches a founder unreviewed without this (CLAUDE.md).
export function aiCleared(r: Pick<ResultRow, "checkId" | "ai" | "detail">) {
  if (r.checkId.startsWith("AI-")) return !!(r.detail as { judgedBy?: string } | null)?.judgedBy;
  return aiVerdictOf(r) === "CONFIRMED";
}

// A failed rule the AI showed to be wrong (with a quote QUARR verified) is not a problem
// with the store. It is treated as unobserved: never counted, never named, never "fixed".
export function effective(rows: ResultRow[]): ResultRow[] {
  return rows.map((r) => (r.outcome === "FAIL" && aiVerdictOf(r) === "REFUTED" ? { ...r, outcome: "NOT_OBSERVABLE" as const } : r));
}

export type ShownFinding = FindingCopy & { checkId: string; lens: string; citation: Citation | null; whatToDo?: string };

function shown(r: ResultRow, platform?: string | null): ShownFinding {
  const def = CHECKS_BY_ID[r.checkId];
  const citation = (r.citation ?? null) as Citation | null;
  const copy = def.copy((r.detail ?? {}) as Record<string, unknown>, citation as Citation);
  return { ...copy, checkId: r.checkId, lens: def.lens, citation, whatToDo: whatToDo(r.checkId, r.detail, platform) };
}

// Grouped by lens (the 19 in engine/framework/lenses.ts), the same names the First Look uses.
function countsByLens(fails: ResultRow[]) {
  const by: Record<string, number> = {};
  for (const f of fails) {
    const key = CHECKS_BY_ID[f.checkId]?.lens ?? toLens(f.lens) ?? f.lens;
    by[key] = (by[key] ?? 0) + 1;
  }
  return Object.entries(by)
    .map(([lens, n]) => ({ lens, name: LENS_NAMES[lens as Lens] ?? lens, n }))
    .sort((a, b) => b.n - a.n);
}

function pickSafe(results: ResultRow[], autoChecks: Set<string>, max: number, platform?: string | null) {
  const safe = results.filter((r) => r.outcome === "FAIL" && aiCleared(r) && isInstantSafe(r.checkId, r.detail as Record<string, unknown>, autoChecks));
  const cands = safe.map(candidateFrom).filter((c): c is NonNullable<typeof c> => !!c);
  return selectFindings(cands).selected.slice(0, max).map((c) => shown(results.find((r) => r.id === c.resultId)!, platform));
}

export type PreviewSummary = {
  type: "preview";
  engineVersion?: string;
  issues: number;
  areas: number;
  byLens: { lens: string; name: string; n: number }[];
  checked: number;
  teaser: ShownFinding | null;
};

export function previewSummary(all: ResultRow[], autoChecks: Set<string> = new Set(), platform?: string | null): PreviewSummary {
  const results = effective(all);
  const fails = results.filter((r) => r.outcome === "FAIL");
  const byLens = countsByLens(fails);
  return {
    type: "preview",
    engineVersion: ENGINE_VERSION,
    issues: fails.length,
    areas: byLens.length,
    byLens,
    checked: results.filter((r) => r.outcome !== "NOT_OBSERVABLE").length,
    teaser: pickSafe(results, autoChecks, 1, platform)[0] ?? null,
  };
}

export type InstantSummary = {
  type: "instant";
  issues: number;
  byLens: { lens: string; name: string; n: number }[];
  passed: number;
  findings: ShownFinding[];
  heldForReview: number;
};

export function instantSummary(all: ResultRow[], autoChecks: Set<string> = new Set(), platform?: string | null): InstantSummary {
  const results = effective(all);
  const fails = results.filter((r) => r.outcome === "FAIL");
  const findings = pickSafe(results, autoChecks, 3, platform);
  return {
    type: "instant",
    issues: fails.length,
    byLens: countsByLens(fails),
    passed: results.filter((r) => r.outcome === "PASS").length,
    findings,
    heldForReview: fails.length - findings.length,
  };
}

export type RecheckItem = { checkId: string; lens: string; name: string; title: string; citation: Citation | null };

export type RecheckSummary = {
  type: "recheck";
  fixed: RecheckItem[];
  stillOpen: RecheckItem[];
  appeared: RecheckItem[];
  unverified: RecheckItem[]; // failed before, could not be observed this time
  // Findings the founder has not been shown yet (unreviewed) are counted, never named.
  hidden: { fixed: number; stillOpen: number; appeared: number; unverified: number };
  visible: string[]; // check ids the founder may see named, carried to the next re-check
};

// "Fixed" means a check that failed before now passes. Nothing is inferred beyond that.
// `visible` holds the checks already shown to the founder (instant or Expert-reviewed);
// anything else is named only if it is safe to show without review.
export function recheckSummary(beforeAll: ResultRow[], afterAll: ResultRow[], visible: Set<string> = new Set(), autoChecks: Set<string> = new Set()): RecheckSummary {
  const before = effective(beforeAll);
  const after = effective(afterAll);
  const prev = new Map(before.map((r) => [r.checkId, r]));
  const out: RecheckSummary = { type: "recheck", fixed: [], stillOpen: [], appeared: [], unverified: [], hidden: { fixed: 0, stillOpen: 0, appeared: 0, unverified: 0 }, visible: [] };
  const named = (row: ResultRow) => visible.has(row.checkId) || (aiCleared(row) && isInstantSafe(row.checkId, row.detail as Record<string, unknown>, autoChecks));
  const add = (bucket: "fixed" | "stillOpen" | "appeared" | "unverified", row: ResultRow, item: RecheckItem) => {
    if (named(row)) {
      out[bucket].push(item);
      out.visible.push(row.checkId);
    } else out.hidden[bucket]++;
  };
  for (const r of after) {
    const def = CHECKS_BY_ID[r.checkId];
    if (!def) continue;
    const was = prev.get(r.checkId)?.outcome;
    const now = r.outcome;
    const item = (row: ResultRow): RecheckItem => ({
      checkId: row.checkId,
      lens: def.lens,
      name: def.name,
      title: def.copy((row.detail ?? {}) as Record<string, unknown>, (row.citation ?? null) as Citation).title,
      citation: (row.citation ?? null) as Citation | null,
    });
    const old = prev.get(r.checkId)!;
    if (was === "FAIL" && now === "PASS") add("fixed", old, item(old));
    else if (was === "FAIL" && now === "FAIL") add("stillOpen", r, item(r));
    else if (was === "FAIL" && now === "NOT_OBSERVABLE") add("unverified", old, item(old));
    else if (was !== "FAIL" && now === "FAIL") add("appeared", r, item(r));
  }
  return out;
}

// The re-check headline, from the founder's side: what they fixed, out of what was open last
// time. Counts include findings not yet shown (never named), so the numbers are complete.
type RecheckCounts = { fixed?: unknown[]; stillOpen?: unknown[]; appeared?: unknown[]; unverified?: unknown[]; hidden?: Partial<RecheckSummary["hidden"]> };
export function recheckHeadline(sum: RecheckCounts) {
  const n = (k: "fixed" | "stillOpen" | "appeared" | "unverified") => (sum[k]?.length ?? 0) + (sum.hidden?.[k] ?? 0);
  const fixed = n("fixed");
  const open = n("stillOpen");
  const appeared = n("appeared");
  const unverified = n("unverified");
  const total = fixed + open + unverified;
  const issues = total === 1 ? "issue" : "issues";
  const headline =
    total === 0
      ? "Nothing was left open from last time."
      : fixed === 0
        ? total === 1
          ? "The issue from last time isn't fixed yet."
          : `None of the ${total} issues from last time are fixed yet.`
        : fixed === total
          ? total === 1
            ? "You fixed the issue from last time."
            : `You fixed all ${total} issues from last time.`
          : `You fixed ${fixed} of ${total} ${issues} from last time.`;
  const line = [`${open} still open`, `${appeared} new`, unverified ? `${unverified} we couldn't check this time` : ""].filter(Boolean).join(" · ");
  return { headline, line, fixed, open, appeared, unverified, total };
}
