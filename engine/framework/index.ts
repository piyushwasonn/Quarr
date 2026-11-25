import { CHECKS, CHECKS_BY_ID } from "../checks";
import type { Lens, Outcome } from "../types";
import corpus from "./corpus.json";
import { LENS_BY_ID, LENSES, type LensDef, lensesForLabels } from "./lenses";
import { REASONING_RULES } from "./rules";

export * from "./lenses";
export * from "./rules";

export type Story = {
  key: string;
  kind: "customer" | "founder";
  title: string;
  url: string;
  date: string;
  lensLabels: string;
  questions: string[];
  evidence: string;
  gap: string;
  belief?: string;
  complaint?: string;
  lenses: Lens[];
};

// Regenerate with scripts/corpus.py from the Drive corpora listed in Notion 90.
export const STORIES: Story[] = (corpus.stories as Omit<Story, "lenses">[]).map((s) => ({
  ...s,
  lenses: lensesForLabels(s.lensLabels),
}));
export const STORY_BY_KEY = Object.fromEntries(STORIES.map((s) => [s.key, s]));

export function storiesFor(lens: Lens) {
  return STORIES.filter((s) => s.lenses.includes(lens));
}

// "Why buyers care": a pattern seen in QUARR's research, attached to a finding.
// Curated per check, never chosen by AI, and never a reason for a finding to exist:
// the check's evidence is the finding. A story is cited only when it is plainly the same
// situation a founder would recognise; otherwise the note stands alone.
type Why = { note: string; stories: string[]; rule?: string };

export const WHY_BUYERS_CARE: Record<string, Why> = {
  "PRIC-02": { note: "A cost the buyer meets for the first time at checkout makes them stop and reconsider, even when they already trust the store.", stories: [], rule: "TR-02" },
  "CHKT-02": { note: "A cost the buyer meets for the first time at checkout makes them stop and reconsider, even when they already trust the store.", stories: [], rule: "TR-01" },
  "PRIC-03": { note: "Buyers want to know the complete price before they start paying. An open question about tax is a reason to pause.", stories: [], rule: "TR-01" },
  "PRIC-04": { note: "When the amount changes between choosing and paying, buyers feel they are agreeing to something different from what they picked.", stories: ["reddit:1w7u31q"] },
  "PROM-02": { note: "An offer that shaped the decision but fails or changes later is remembered as a broken promise, not a pricing detail.", stories: ["reddit:1t9sgw3"] },
  "DELV-01": { note: "Buyers often order for a specific day. Without a delivery estimate they can't tell if you will make it, so time-sensitive buyers go elsewhere.", stories: ["reddit:1j34rcv-comment-amelie-clothing", "reddit:1ulu2mt"], rule: "TR-08" },
  "DELV-02": { note: "Buyers whose pincode turns out not to be served after ordering lose time and trust, and often blame the store rather than the courier.", stories: ["reddit:1w196o5"], rule: "TR-09" },
  "RTRN-02": { note: "Some problems only show up after the first use. Buyers want to know how long they have before they commit.", stories: ["reddit:1ux3046"] },
  "RTRN-03": { note: "A return policy only helps if the buyer can actually carry it out. Unclear shipping responsibility is where returns stall.", stories: ["reddit:1vzx5ae"] },
  "RTRN-04": { note: "For buyers, a refund that arrives too late is barely a refund. The wait is part of the cost.", stories: ["reddit:1vvad2p"] },
  "TRST-04": { note: "Buyers use other buyers' words to judge whether it is safe to order. Without them, a first order feels like a risk.", stories: ["reddit:1ntd3sl", "reddit:1ulfqs7"] },
  "PROM-01": { note: "Claims become believable when the buyer can see how they are true. Showing the process beats asserting quality.", stories: [], rule: "TR-03" },
  "CLAR-04": { note: "Claims become believable when the buyer can see how they are true. Showing the process beats asserting quality.", stories: [], rule: "TR-03" },
  "TRST-01": { note: "Buyers decide before paying whether they could reach a person if something went wrong. A hidden contact route reads as no route.", stories: ["reddit:1w7sxrg", "reddit:1wd6owc"], rule: "TR-12" },
  "LGL-04": { note: "Buyers decide before paying whether they could reach a person if something went wrong. A hidden contact route reads as no route.", stories: ["reddit:1wd6owc"], rule: "TR-12" },
  "TRST-02": { note: "When something goes seriously wrong, buyers need to know which business they actually bought from.", stories: ["reddit:1wfzmd1"] },
  "CHKT-03": { note: "Every extra step before value, especially forms and forced sign-ups, loses people who were otherwise ready.", stories: ["reddit:1ryswro", "reddit:1uxjign"] },
  "CHKT-01": { note: "A buyer who hits a failure at the moment of paying rarely tries a second time.", stories: ["mouthshut:ajio-review-uqmrrupqtop"] },
  "STAT-01": { note: "Buyers expect what they chose to stay chosen. A basket that changes on its own breaks the sense that they are in control.", stories: ["reddit:1w7u31q"] },
  "CLAR-01": { note: "Visitors who can't tell within seconds what is on offer leave before they find out, however good it is.", stories: ["reddit:1w8e46o", "reddit:1vgs2bu"] },
};

// A check's lens is its `lens` field (engine/checks), so there is one source for the mapping.
export function lensOf(checkId: string): Lens | undefined {
  return CHECKS_BY_ID[checkId]?.lens;
}

export function lensNameFor(checkId: string) {
  const id = lensOf(checkId);
  return id ? LENS_BY_ID[id].name : undefined;
}

// The checks that answer each lens on a website walk.
export function checksFor(lens: Lens) {
  return CHECKS.filter((c) => c.lens === lens);
}

export function whyBuyersCare(checkId: string) {
  const w = WHY_BUYERS_CARE[checkId];
  if (!w) return null;
  return {
    note: w.note,
    rule: w.rule ? REASONING_RULES.find((r) => r.id === w.rule) ?? null : null,
    stories: w.stories.map((k) => STORY_BY_KEY[k]).filter(Boolean).map((s) => ({ title: s.title, url: s.url, source: sourceName(s.url) })),
  };
}

export function sourceName(url: string) {
  const m = url.match(/reddit\.com\/r\/([^/]+)/i);
  if (m) return `Reddit, r/${m[1]}`;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Public source";
  }
}

// What a run covered, lens by lens. "unknown" is a real answer (QIM 2), with questions for
// the founder in place of a guess. A lens the website can't answer says what it needs instead:
//  checked / partly   checks ran and saw something
//  unknown            checks ran but the pages didn't show it
//  assessment         needs a person to try it (test order, support enquiry): the paid assessment
//  your-data          needs the founder's own numbers
//  conditional        applies only to some stores, and nothing yet shows whether this one is one
//  not-applicable     every check said it doesn't apply to this store
export type CoverageStatus = "checked" | "partly" | "unknown" | "assessment" | "your-data" | "conditional" | "not-applicable";

export type LensCoverage = {
  lens: LensDef;
  checks: number;
  passed: number;
  failed: number;
  unseen: number;
  notApplicable: number;
  status: CoverageStatus;
};

export function coverage(rows: { checkId: string; outcome: Outcome | string; ai?: unknown }[]): LensCoverage[] {
  // A failed rule the AI refuted with a verified quote is not a problem with the store.
  const results = rows.map((r) => (r.outcome === "FAIL" && (r.ai as { verdict?: string } | null | undefined)?.verdict === "REFUTED" ? { ...r, outcome: "NOT_OBSERVABLE" } : r));
  return LENSES.map((lens) => {
    const mine = results.filter((r) => lensOf(r.checkId) === lens.id);
    const passed = mine.filter((r) => r.outcome === "PASS").length;
    const failed = mine.filter((r) => r.outcome === "FAIL").length;
    const unseen = mine.filter((r) => r.outcome === "NOT_OBSERVABLE").length;
    const notApplicable = mine.filter((r) => r.outcome === "NOT_APPLICABLE").length;
    return { lens, checks: mine.length, passed, failed, unseen, notApplicable, status: statusOf(lens, { checks: mine.length, seen: passed + failed, unseen, notApplicable }) };
  });
}

function statusOf(lens: LensDef, n: { checks: number; seen: number; unseen: number; notApplicable: number }): CoverageStatus {
  if (n.seen > 0) return lens.site === "yes" && n.unseen === 0 ? "checked" : "partly";
  if (n.checks > 0 && n.notApplicable === n.checks) return "not-applicable";
  if (lens.appliesWhen) return "conditional";
  if (n.checks > 0) return "unknown";
  if (lens.needs.includes("person")) return "assessment";
  if (lens.needs.includes("data")) return "your-data";
  return "unknown";
}

// How many lenses a website walk can answer at least in part today: the honest number for
// "the free First Look checks N of the 19".
export function lensesCheckedAutomatically() {
  return LENSES.filter((l) => checksFor(l.id).length > 0).length;
}

// How a lens's coverage reads to a founder: the chip, its tone, and either a question for the
// founder (QIM 2) or a quieter remark about what else the lens needs.
export function coverageLabel(c: LensCoverage): { chip: string; tone: "pass" | "fail" | "unseen"; note?: string; remark?: string } {
  switch (c.status) {
    case "checked":
    case "partly":
      return {
        chip: `${c.failed ? `${c.failed} ${c.failed === 1 ? "problem" : "problems"}, ` : ""}${c.passed} passed${c.status === "partly" ? ", partly visible" : ""}`,
        tone: c.failed ? "fail" : "pass",
        remark: c.status === "partly" && c.lens.needs.includes("person") ? "The rest needs a person to try it." : undefined,
      };
    case "unknown":
      return { chip: "Not visible from your website", tone: "unseen", note: c.lens.founderQuestions[0] };
    case "assessment":
      return { chip: "Needs a person to try it", tone: "unseen", note: c.lens.founderQuestions[0] };
    case "your-data":
      return { chip: "Needs your own numbers", tone: "unseen", note: c.lens.founderQuestions[0] };
    case "conditional":
      return { chip: c.lens.appliesWhen ?? "Applies to some stores", tone: "unseen", note: c.lens.founderQuestions[0] };
    case "not-applicable":
      return { chip: "Doesn't apply to your store", tone: "unseen" };
  }
}
