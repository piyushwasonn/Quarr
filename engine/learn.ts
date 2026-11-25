import { CHECKS_BY_ID } from "./checks";

// What QUARR learns from every crawl, worked out from what each run already stores: the
// pages reached, the rule results, the AI's verdicts and the reviewer's decisions. It covers
// past runs too, and needs no extra step in the crawler.
//
// Four kinds of lesson, kept apart on purpose:
//  - coverage: what the crawler couldn't reach or check (a crawler to-do list)
//  - accuracy: where the reviewer and the AI disagreed (AI and prompt fixes)
//  - store patterns: how often a problem was confirmed across reviewed stores
//  - good practice: what stores do well, quoted from their pages
// None of these is evidence of how buyers behave. That still needs real customer evidence
// (QIM 4: behaviour beats intention); the research corpus holds it, not this.

export type LearnRun = {
  id: string;
  domain: string;
  kind: string; // PREVIEW | FULL | RECHECK
  platform: string | null;
  crawledAt: Date | null;
  pages: { kind: string }[];
  results: { checkId: string; outcome: string; detail: unknown; ai: unknown }[];
  findings: { checkId: string; state: string; editReason: string | null }[];
};

export const MIN_STORES_FOR_PATTERN = 10;

export const isStoreRun = (r: Pick<LearnRun, "pages">) => r.pages.some((p) => p.kind.startsWith("PRODUCT"));

export type Gap = { code: "NOT_A_STORE" | "NO_CART" | "NO_SHIPPING" | "NO_RETURNS" | "NO_CONTACT"; label: string };

const GAP_LABEL: Record<Gap["code"], string> = {
  NOT_A_STORE: "No product pages found: not an online store, or products the crawler couldn't find",
  NO_CART: "Cart not reached: add to cart didn't work",
  NO_SHIPPING: "No shipping policy found",
  NO_RETURNS: "No returns policy found",
  NO_CONTACT: "No contact page found",
};

// What the crawler couldn't reach on this run. A quick scan only visits the homepage, one
// product and two policies, so the cart and contact page aren't expected there.
export function crawlGaps(r: LearnRun): Gap[] {
  const has = (k: string) => r.pages.some((p) => p.kind === k);
  if (!isStoreRun(r)) return [{ code: "NOT_A_STORE", label: GAP_LABEL.NOT_A_STORE }];
  const gaps: Gap["code"][] = [];
  if (r.kind !== "PREVIEW" && !has("CART")) gaps.push("NO_CART");
  if (!has("SHIPPING")) gaps.push("NO_SHIPPING");
  if (!has("RETURNS")) gaps.push("NO_RETURNS");
  if (r.kind !== "PREVIEW" && !has("CONTACT")) gaps.push("NO_CONTACT");
  return gaps.map((code) => ({ code, label: GAP_LABEL[code] }));
}

// A reviewer decision says whether a finding was real. Wording or severity edits keep it real;
// only "false positive" and "evidence wrong" mean it wasn't. Undecided findings say nothing.
export function truthOf(f: { state: string; editReason: string | null }): boolean | null {
  if (f.state === "APPROVED" || f.state === "EDITED") return true;
  if (f.state === "DROPPED" && (f.editReason === "FALSE_POSITIVE" || f.editReason === "EVIDENCE_WRONG")) return false;
  return null;
}

export type AiMistake = { domain: string; checkId: string; what: "HID_REAL" | "LET_WRONG" | "AI_CHECK_WRONG"; reason: string };

export function aiMistakes(r: LearnRun): AiMistake[] {
  const out: AiMistake[] = [];
  for (const f of r.findings) {
    const real = truthOf(f);
    if (real === null) continue;
    const res = r.results.find((x) => x.checkId === f.checkId);
    if (f.checkId.startsWith("AI-")) {
      if (!real) out.push({ domain: r.domain, checkId: f.checkId, what: "AI_CHECK_WRONG", reason: String((res?.detail as { reason?: string } | null)?.reason ?? "") });
      continue;
    }
    const v = res?.ai as { verdict?: string; reason?: string } | null | undefined;
    if (v?.verdict === "REFUTED" && real) out.push({ domain: r.domain, checkId: f.checkId, what: "HID_REAL", reason: v.reason ?? "" });
    if (v?.verdict === "CONFIRMED" && !real) out.push({ domain: r.domain, checkId: f.checkId, what: "LET_WRONG", reason: v.reason ?? "" });
  }
  return out;
}

export type Pattern = { checkId: string; lens: string; kept: number; droppedWrong: number; firedUnreviewed: number };

// How often each problem was confirmed across stores you reviewed. "Kept" counts only your
// decisions; "fired, not reviewed" is shown apart because nobody has checked it.
export function storePatterns(runs: LearnRun[]): { reviewedStores: number; patterns: Pattern[]; enough: boolean } {
  const reviewed = runs.filter((r) => isStoreRun(r) && r.findings.some((f) => truthOf(f) !== null));
  const by = new Map<string, Pattern>();
  const get = (checkId: string) => {
    if (!by.has(checkId)) by.set(checkId, { checkId, lens: CHECKS_BY_ID[checkId]?.lens ?? "", kept: 0, droppedWrong: 0, firedUnreviewed: 0 });
    return by.get(checkId)!;
  };
  for (const r of reviewed) {
    const decided = new Map(r.findings.map((f) => [f.checkId, truthOf(f)]));
    for (const res of r.results) {
      if (res.outcome !== "FAIL") continue;
      const t = decided.get(res.checkId);
      if (t === true) get(res.checkId).kept++;
      else if (t === false) get(res.checkId).droppedWrong++;
      else get(res.checkId).firedUnreviewed++;
    }
  }
  const patterns = [...by.values()].sort((a, b) => b.kept - a.kept || b.firedUnreviewed - a.firedUnreviewed);
  return { reviewedStores: reviewed.length, patterns, enough: reviewed.length >= MIN_STORES_FOR_PATTERN };
}

export type GoodPractice = { domain: string; checkId: string; lens: string; quotes: { page: string; text: string }[] };

// What stores do well, in their own words: AI-judged checks that passed with a quote QUARR verified.
export function goodPractice(r: LearnRun): GoodPractice[] {
  return r.results
    .filter((x) => x.checkId.startsWith("AI-") && x.outcome === "PASS")
    .map((x) => ({ domain: r.domain, checkId: x.checkId, lens: CHECKS_BY_ID[x.checkId]?.lens ?? "", quotes: ((x.detail as { quotes?: { page: string; text: string }[] } | null)?.quotes ?? []).slice(0, 2) }))
    .filter((g) => g.quotes.length > 0);
}
