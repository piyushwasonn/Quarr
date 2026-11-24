import { z } from "zod";
import { CHECKS_BY_ID } from "../checks";
import { CHECK_LENS, FRAMEWORK_LENS_BY_ID } from "../framework/lenses";
import type { Citation, PageKind, StoredPage } from "../types";
import { callModel, type Evidence, type Usage } from "./model";
import { ANALYST_SYSTEM } from "./prompt";
import { verifyQuotes, type Quote } from "./quotes";

// The verifier gives every failed rule a second reading before a founder can see it.
// Rules are blunt (they miss synonyms, other pages, unusual layouts); the AI reads the
// whole page the way a careful person would. It can only overturn a rule with text it
// quotes from the captured pages, and QUARR checks that text is really there.

export type AiVerdict = {
  verdict: "CONFIRMED" | "REFUTED" | "UNSURE";
  reason: string;
  quotes: Quote[];
  rejectedQuotes: number;
};

export type FailRow = { id: string; checkId: string; citation: unknown; detail: unknown };

const Out = z.object({
  verdicts: z.array(
    z.object({
      checkId: z.string(),
      verdict: z.enum(["CONFIRMED", "REFUTED", "UNSURE"]),
      reason: z.string(),
      quotes: z.array(z.object({ page: z.string(), text: z.string() })),
    }),
  ),
});

const TASK = (items: unknown[]) => `Below are findings that QUARR's automatic rules produced for this store. Read the captured pages and give each one a verdict.

- CONFIRMED: the pages support the finding. A careful person reading these pages would agree with what it says. For a finding that says something is missing, confirm only if you also cannot find it anywhere in the captured pages, including collapsed sections and links.
- REFUTED: the pages contain text that shows the finding is wrong, for example the "missing" information is there under another name, in a collapsed section, on another captured page, or the rule misread the page. You must quote that text exactly, with its page kind. A refutation without a quote is not accepted.
- UNSURE: anything else, including when the answer depends on something not captured (images, pages not visited, checkout, behaviour after ordering), or when the finding is a matter of degree you can't settle from the text.

Never refute on opinion ("this is normal for the category", "buyers won't mind"). Refute only on what the pages say. Give a one-sentence reason a founder could read. Return one verdict for every checkId listed.

Findings:
${JSON.stringify(items, null, 2)}`;

export async function verifyFails(evidence: Evidence, pages: Partial<Record<PageKind, StoredPage>>, fails: FailRow[]): Promise<{ ok: boolean; reason?: string; verdicts: Map<string, AiVerdict>; usage?: Usage; ms: number }> {
  const verdicts = new Map<string, AiVerdict>();
  if (!fails.length) return { ok: true, verdicts, ms: 0 };
  const items = fails.map((r) => {
    const def = CHECKS_BY_ID[r.checkId];
    const citation = (r.citation ?? null) as Citation | null;
    const copy = def.copy((r.detail ?? {}) as Record<string, unknown>, citation as Citation);
    const lens = FRAMEWORK_LENS_BY_ID[CHECK_LENS[r.checkId]];
    return {
      checkId: r.checkId,
      rule: def.name,
      buyerQuestion: lens?.buyerQuestion,
      finding: copy.title,
      whatTheRuleSaw: copy.observed,
      evidence: citation ? { page: citation.pageKind, snippet: citation.snippet } : null,
    };
  });

  const res = await callModel({ name: "verify", system: ANALYST_SYSTEM, evidence, task: TASK(items), schema: Out, effort: "medium", maxTokens: 8000 });
  if (!res.ok) return { ok: false, reason: res.reason, verdicts, usage: res.usage, ms: res.ms };

  const byId = new Map(res.value.verdicts.map((v) => [v.checkId, v]));
  for (const r of fails) {
    const v = byId.get(r.checkId);
    if (!v) {
      verdicts.set(r.checkId, { verdict: "UNSURE", reason: "The AI reader did not answer for this finding.", quotes: [], rejectedQuotes: 0 });
      continue;
    }
    const { valid, rejected } = verifyQuotes(v.quotes, pages);
    let verdict = v.verdict;
    let reason = v.reason.trim();
    // Overturning a rule needs evidence QUARR can point at.
    if (verdict === "REFUTED" && !valid.length) {
      verdict = "UNSURE";
      reason = `${reason} (Not accepted as a refutation: the quoted text was not found on the captured pages.)`;
    }
    verdicts.set(r.checkId, { verdict, reason: reason.slice(0, 400), quotes: valid, rejectedQuotes: rejected });
  }
  return { ok: true, verdicts, usage: res.usage, ms: res.ms };
}
