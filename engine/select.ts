import { CHECKS_BY_ID } from "./checks";
import type { Lens } from "./types";

export type Candidate = { resultId: string; checkId: string; lens: Lens; severity: number; evidenceStrength: number; money: boolean; group?: string };

export const MAX_FINDINGS = 3;

// Severity × evidence strength, with money consequences weighted above cosmetic ones.
export function scoreOf(c: Pick<Candidate, "severity" | "evidenceStrength" | "money">) {
  return Math.round(c.severity * c.evidenceStrength * (c.money ? 1.25 : 1) * 100) / 100;
}

// Pick up to three: at most one per lens and per group, and never open with
// Legal Metrology on its own.
export function selectFindings(cands: Candidate[]) {
  const ranked = [...cands].sort((a, b) => scoreOf(b) - scoreOf(a) || a.checkId.localeCompare(b.checkId));
  const chosen: Candidate[] = [];
  const lenses = new Set<string>();
  const groups = new Set<string>();
  for (const c of ranked) {
    if (chosen.length >= MAX_FINDINGS) break;
    if (lenses.has(c.lens)) continue;
    if (c.group && groups.has(c.group)) continue;
    chosen.push(c);
    lenses.add(c.lens);
    if (c.group) groups.add(c.group);
  }
  if (chosen[0]?.lens === "LGL") {
    const lead = chosen.findIndex((c) => c.lens !== "LGL");
    if (lead > 0) [chosen[0], chosen[lead]] = [chosen[lead], chosen[0]];
  }
  const chosenIds = new Set(chosen.map((c) => c.resultId));
  const rest = ranked.filter((c) => !chosenIds.has(c.resultId));
  return {
    selected: chosen,
    rest,
    otherIssues: rest.length,
    otherLenses: new Set(rest.map((c) => c.lens)).size,
  };
}

export function candidateFrom(r: { id: string; checkId: string; evidenceStrength: number }): Candidate | null {
  const def = CHECKS_BY_ID[r.checkId];
  if (!def) return null;
  return { resultId: r.id, checkId: r.checkId, lens: def.lens, severity: def.severity, evidenceStrength: r.evidenceStrength, money: def.money, group: def.group };
}
