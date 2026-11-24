import { CHECKS_BY_ID } from "./checks";
import { candidateFrom, selectFindings } from "./select";
import { ENGINE_VERSION } from "./version";
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

export type ResultRow = { id: string; checkId: string; lens: string; outcome: Outcome; evidenceStrength: number; citation: unknown; detail: unknown };

export type ShownFinding = FindingCopy & { checkId: string; lens: string; citation: Citation | null };

function shown(r: ResultRow): ShownFinding {
  const def = CHECKS_BY_ID[r.checkId];
  const citation = (r.citation ?? null) as Citation | null;
  const copy = def.copy((r.detail ?? {}) as Record<string, unknown>, citation as Citation);
  return { ...copy, checkId: r.checkId, lens: r.lens, citation };
}

function countsByLens(fails: ResultRow[]) {
  const by: Record<string, number> = {};
  for (const f of fails) by[f.lens] = (by[f.lens] ?? 0) + 1;
  return Object.entries(by)
    .map(([lens, n]) => ({ lens, name: LENS_NAMES[lens as Lens] ?? lens, n }))
    .sort((a, b) => b.n - a.n);
}

function pickSafe(results: ResultRow[], autoChecks: Set<string>, max: number) {
  const safe = results.filter((r) => r.outcome === "FAIL" && isInstantSafe(r.checkId, r.detail as Record<string, unknown>, autoChecks));
  const cands = safe.map(candidateFrom).filter((c): c is NonNullable<typeof c> => !!c);
  return selectFindings(cands).selected.slice(0, max).map((c) => shown(results.find((r) => r.id === c.resultId)!));
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

export function previewSummary(results: ResultRow[], autoChecks: Set<string> = new Set()): PreviewSummary {
  const fails = results.filter((r) => r.outcome === "FAIL");
  const byLens = countsByLens(fails);
  return {
    type: "preview",
    engineVersion: ENGINE_VERSION,
    issues: fails.length,
    areas: byLens.length,
    byLens,
    checked: results.filter((r) => r.outcome !== "NOT_OBSERVABLE").length,
    teaser: pickSafe(results, autoChecks, 1)[0] ?? null,
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

export function instantSummary(results: ResultRow[], autoChecks: Set<string> = new Set()): InstantSummary {
  const fails = results.filter((r) => r.outcome === "FAIL");
  const findings = pickSafe(results, autoChecks, 3);
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
export function recheckSummary(before: ResultRow[], after: ResultRow[], visible: Set<string> = new Set(), autoChecks: Set<string> = new Set()): RecheckSummary {
  const prev = new Map(before.map((r) => [r.checkId, r]));
  const out: RecheckSummary = { type: "recheck", fixed: [], stillOpen: [], appeared: [], unverified: [], hidden: { fixed: 0, stillOpen: 0, appeared: 0, unverified: 0 }, visible: [] };
  const named = (row: ResultRow) => visible.has(row.checkId) || isInstantSafe(row.checkId, row.detail as Record<string, unknown>, autoChecks);
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
      lens: row.lens,
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
