import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { plainPunctuation } from "@/lib/punctuation";
import type { Citation, FindingCopy } from "./types";

// The AI layer writes words, never verdicts. It only rewrites the template
// copy of checks that already fired, using that check's captured evidence.
// Any draft that introduces a number not present in the evidence is discarded
// and the deterministic template is used instead.

export const WRITER_MODEL = "claude-opus-5-5";

const SYSTEM = `You write findings for QUARR, a service that walks an Indian D2C online store the way a first-time buyer would and tells the founder what that buyer is likely to trust, question or abandon.

You receive findings that a deterministic check has already confirmed, each with the captured evidence and a template draft. Rewrite each one so it reads naturally for this specific store, as a calm, experienced consultant would say it to the founder.

Rules:
- Use only facts present in the evidence or the template. Do not add numbers, statistics, percentages, prices, durations or study results that are not in the input.
- Keep the meaning of each field: "title" names the buyer problem in under 12 words; "observed" states exactly what was seen, plainly; "likelyEffect" describes the probable buyer behaviour, hedged ("likely", "often", "many buyers"); "notYetProven" states honestly what this review could not confirm.
- Each of observed, likelyEffect and notYetProven is one or two sentences.
- Indian English. No hype, no blame, no exclamation marks, no emojis. Speak to the founder as "you".
- Never use em dashes or en dashes as punctuation. Use a comma, a colon or a full stop instead.
- Never say the store is breaking the law. For labelling findings, say the rules "expect" or "ask for" the information.
- Return every finding you were given, with the same checkId.`;

const Out = z.object({
  findings: z.array(
    z.object({
      checkId: z.string(),
      title: z.string(),
      observed: z.string(),
      likelyEffect: z.string(),
      notYetProven: z.string(),
    }),
  ),
});

// Why the last batch fell back to templates, if it did. The pipeline records it on the run,
// so Bench → Health can show the real reason instead of a silent fallback.
export let lastWriterIssue: string | null = null;

export type DraftInput = { checkId: string; checkName: string; template: FindingCopy; citation: Citation; detail: Record<string, unknown> };
export type DraftOutput = FindingCopy & { checkId: string; draftedBy: "claude" | "template" };

export async function draftFindings(storeName: string | null, items: DraftInput[]): Promise<DraftOutput[]> {
  const fallback = items.map((i) => ({ ...i.template, checkId: i.checkId, draftedBy: "template" as const }));
  lastWriterIssue = null;
  if (!items.length || process.env.QUARR_DISABLE_AI === "1") return fallback;
  if (!process.env.ANTHROPIC_API_KEY) {
    lastWriterIssue = "No ANTHROPIC_API_KEY";
    return fallback;
  }

  const client = new Anthropic();
  const payload = items.map((i) => ({
    checkId: i.checkId,
    check: i.checkName,
    evidence: { page: i.citation.pageKind, url: i.citation.url, snippet: i.citation.snippet, detail: i.detail },
    template: i.template,
  }));

  try {
    const response = await client.beta.messages.parse({
      model: WRITER_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Out) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Store: ${storeName ?? "(name not detected)"}\n\nFindings:\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      lastWriterIssue = response.stop_reason === "refusal" ? "Claude declined the request" : `No structured output (stop reason: ${response.stop_reason})`;
      return fallback;
    }

    const byId = new Map(response.parsed_output.findings.map((f) => [f.checkId, f]));
    return items.map((item, idx) => {
      const draft = byId.get(item.checkId);
      if (!draft || !numbersGrounded(draft, item)) {
        lastWriterIssue = draft ? `Draft for ${item.checkId} added a number not in the evidence; template used` : `No draft returned for ${item.checkId}`;
        return fallback[idx];
      }
      return { checkId: item.checkId, title: plainPunctuation(draft.title), observed: plainPunctuation(draft.observed), likelyEffect: plainPunctuation(draft.likelyEffect), notYetProven: plainPunctuation(draft.notYetProven), draftedBy: "claude" as const };
    });
  } catch (err) {
    lastWriterIssue = err instanceof Anthropic.APIError ? `Claude API error ${err.status}: ${err.message}` : `Claude call failed: ${err instanceof Error ? err.message : String(err)}`;
    if (err instanceof Anthropic.RateLimitError) console.warn("[writer] rate limited; using templates");
    else if (err instanceof Anthropic.APIError) console.warn(`[writer] API error ${err.status}; using templates`);
    else console.warn("[writer] failed; using templates", err);
    return fallback;
  }
}

// Every number in the AI draft must already exist in the evidence or template.
export function numbersGrounded(draft: FindingCopy, item: Pick<DraftInput, "template" | "citation" | "detail">) {
  const source = JSON.stringify([item.template, item.citation.snippet, item.detail]).replace(/,(?=\d{2,3}\b)/g, "");
  const known = new Set(source.match(/\d+(\.\d+)?/g) ?? []);
  const text = [draft.title, draft.observed, draft.likelyEffect, draft.notYetProven].join(" ").replace(/,(?=\d{2,3}\b)/g, "");
  return (text.match(/\d+(\.\d+)?/g) ?? []).every((n) => known.has(n));
}
