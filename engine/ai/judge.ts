import { z } from "zod";
import { plainPunctuation } from "@/lib/punctuation";
import { AI_CHECKS } from "../checks/ai";
import { CHECK_LENS, FRAMEWORK_LENS_BY_ID } from "../framework/lenses";
import type { CheckDef, CheckVerdict, FindingCopy, PageKind, StoredPage } from "../types";
import { callModel, type Evidence, type Usage } from "./model";
import { ANALYST_SYSTEM } from "./prompt";
import { distinctQuotes, verifyQuotes, type Quote } from "./quotes";

// Answers the AI-judged checks (engine/checks/ai.ts) in one call. Its output is held to
// the same standard as a rule: a FAIL needs verified quotes and a citation, and anything
// the AI can't show from the pages is NOT_OBSERVABLE, never a guess.

const Out = z.object({
  answers: z.array(
    z.object({
      checkId: z.string(),
      outcome: z.enum(["PASS", "FAIL", "UNKNOWN"]),
      reason: z.string(),
      quotes: z.array(z.object({ page: z.string(), text: z.string() })),
      title: z.string(),
      observed: z.string(),
      likelyEffect: z.string(),
      notYetProven: z.string(),
    }),
  ),
});

const TASK = (checks: CheckDef[]) => `Answer each of these questions about the store from the captured pages. They are part of QUARR's check library, so your answer is held to the same standard as an automatic rule.

For each check:
- FAIL only when the "fail when" condition is clearly met, and quote the text that shows it (with page kinds). A contradiction needs both sides quoted, as two separate quotes.
- PASS when the "pass when" condition is met, with a quote that shows it.
- UNKNOWN when the pages don't settle it, including when something is simply not mentioned. Never fail a check because something is absent.
- Give a one-sentence reason.
- Only for a FAIL, also write the finding for the founder: "title" names the buyer problem in under 12 words; "observed" says exactly what the pages say, using your quotes; "likelyEffect" describes the likely buyer behaviour, hedged ("likely", "many buyers"); "notYetProven" says honestly what this reading could not confirm. One or two sentences each. Use no number that is not in your quotes. For PASS or UNKNOWN, leave these four fields as empty strings.

Checks:
${JSON.stringify(
  checks.map((c) => ({
    checkId: c.id,
    question: c.ai!.question,
    buyerQuestion: FRAMEWORK_LENS_BY_ID[CHECK_LENS[c.id]]?.buyerQuestion,
    failWhen: c.ai!.failWhen,
    passWhen: c.ai!.passWhen,
    pagesToRead: c.ai!.pages,
  })),
  null,
  2,
)}`;

export type JudgedVerdict = CheckVerdict & { checkId: string };

export async function judgeChecks(evidence: Evidence, pages: Partial<Record<PageKind, StoredPage>>): Promise<{ ok: boolean; reason?: string; verdicts: JudgedVerdict[]; usage?: Usage; ms: number }> {
  const checks = AI_CHECKS.filter((c) => c.ai!.pages.some((k) => pages[k]));
  if (!checks.length) return { ok: true, verdicts: [], ms: 0 };
  const res = await callModel({ name: "judge", system: ANALYST_SYSTEM, evidence, task: TASK(checks), schema: Out, effort: "medium", maxTokens: 12000 });
  if (!res.ok) return { ok: false, reason: res.reason, verdicts: [], usage: res.usage, ms: res.ms };

  const byId = new Map(res.value.answers.map((a) => [a.checkId, a]));
  const verdicts: JudgedVerdict[] = checks.map((def) => {
    const a = byId.get(def.id);
    if (!a) return { checkId: def.id, outcome: "NOT_OBSERVABLE", detail: { why: "The AI reader did not answer this check." } };
    const allowed = new Set(def.ai!.pages);
    const { valid, rejected } = verifyQuotes(
      a.quotes.filter((q) => allowed.has(q.page as PageKind)),
      pages,
    );
    const quotes = distinctQuotes(valid);
    const base = { quotes, reason: a.reason.trim().slice(0, 400), rejectedQuotes: rejected + (a.quotes.length - a.quotes.filter((q) => allowed.has(q.page as PageKind)).length), judgedBy: "claude" };

    if (a.outcome === "UNKNOWN") return { checkId: def.id, outcome: "NOT_OBSERVABLE", detail: { ...base, why: a.reason.trim().slice(0, 300) || "The pages don't settle it." } };
    if (a.outcome === "PASS") {
      // A pass is also a claim about the store: it needs something to point at.
      return quotes.length ? { checkId: def.id, outcome: "PASS", detail: base } : { checkId: def.id, outcome: "NOT_OBSERVABLE", detail: { ...base, why: "The AI reader passed this without a quote QUARR could find on the page." } };
    }
    if (quotes.length < def.ai!.failQuotes) {
      return { checkId: def.id, outcome: "NOT_OBSERVABLE", detail: { ...base, why: `The AI reader saw a problem but gave ${quotes.length} of the ${def.ai!.failQuotes} quote(s) QUARR needs to show it.` } };
    }
    const draft: FindingCopy = { title: a.title, observed: a.observed, likelyEffect: a.likelyEffect, notYetProven: a.notYetProven };
    const copy = draft.title && draft.observed && draft.likelyEffect && draft.notYetProven && numbersInQuotes(draft, quotes) ? clean(draft) : undefined;
    const first = pages[quotes[0].page as PageKind]!;
    return {
      checkId: def.id,
      outcome: "FAIL",
      evidenceStrength: def.ai!.failQuotes === 2 ? 0.75 : 0.65,
      citation: {
        pageKind: first.kind,
        url: first.finalUrl || first.url,
        snippet: quotes.map((q) => `"${q.text}"${quotes.length > 1 ? ` (${q.page.toLowerCase().replace("_", " ")})` : ""}`).join(" / ").slice(0, 500),
        viewport: "mobile",
      },
      detail: { ...base, copy },
    };
  });
  return { ok: true, verdicts, usage: res.usage, ms: res.ms };
}

const clean = (c: FindingCopy): FindingCopy => ({ title: plainPunctuation(c.title), observed: plainPunctuation(c.observed), likelyEffect: plainPunctuation(c.likelyEffect), notYetProven: plainPunctuation(c.notYetProven) });

// Same rule as the wording step: the AI may not introduce a number the evidence doesn't hold.
export function numbersInQuotes(copy: FindingCopy, quotes: Quote[]) {
  const strip = (s: string) => s.replace(/,(?=\d{2,3}\b)/g, "");
  const known = new Set(strip(quotes.map((q) => q.text).join(" ")).match(/\d+(\.\d+)?/g) ?? []);
  const used = strip([copy.title, copy.observed, copy.likelyEffect, copy.notYetProven].join(" ")).match(/\d+(\.\d+)?/g) ?? [];
  return used.every((n) => known.has(n));
}
