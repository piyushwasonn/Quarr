import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// One place where QUARR talks to Claude for judgement (verifier and AI-judged checks).
// The wording step (engine/write.ts) keeps its own call. Tests swap the model out with
// setModelForTests, so no test ever spends money or needs a key.

export const ANALYST_MODEL = "claude-opus-5-5";

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type Evidence = Anthropic.Beta.BetaContentBlockParam[];
export type ModelRequest<T extends z.ZodType> = {
  name: string; // for logs: "verify" | "judge"
  system: string;
  evidence: Evidence; // identical across calls in a run, so it is cached once
  task: string;
  schema: T;
  effort: "low" | "medium" | "high";
  maxTokens: number;
};
export type ModelResult<T> = { ok: true; value: T; usage: Usage; ms: number } | { ok: false; reason: string; usage?: Usage; ms: number };
export type ModelFn = <T extends z.ZodType>(req: ModelRequest<T>) => Promise<ModelResult<z.infer<T>>>;

let override: ModelFn | null = null;
export function setModelForTests(fn: ModelFn | null) {
  override = fn;
}

// Why AI can't run right now, or null when it can.
export function aiUnavailable(): string | null {
  if (override) return null;
  if (process.env.QUARR_DISABLE_AI === "1") return "AI switched off (QUARR_DISABLE_AI=1)";
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return "No ANTHROPIC_API_KEY in the crawler's environment";
  return null;
}

export const callModel: ModelFn = async (req) => {
  if (override) return override(req);
  const started = Date.now();
  const client = new Anthropic({ timeout: 180_000, maxRetries: 2 });
  // The evidence block is the long, shared prefix: mark its end so the second call reads it from cache.
  const evidence = req.evidence.map((b, i) => (i === req.evidence.length - 1 && b.type === "text" ? { ...b, cache_control: { type: "ephemeral" as const } } : b));
  try {
    const response = await client.beta.messages.parse({
      model: ANALYST_MODEL,
      max_tokens: req.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: req.effort, format: betaZodOutputFormat(req.schema) },
      system: req.system,
      messages: [{ role: "user", content: [...evidence, { type: "text", text: req.task }] }],
    });
    const u = response.usage;
    const usage: Usage = { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 };
    const ms = Date.now() - started;
    if (response.stop_reason === "refusal") return { ok: false, reason: "Claude declined the request", usage, ms };
    if (response.stop_reason === "max_tokens") return { ok: false, reason: "Answer was cut off (max_tokens)", usage, ms };
    if (!response.parsed_output) return { ok: false, reason: `No structured answer (stop reason: ${response.stop_reason})`, usage, ms };
    return { ok: true, value: response.parsed_output as z.infer<typeof req.schema>, usage, ms };
  } catch (err) {
    const ms = Date.now() - started;
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "The Anthropic API key was rejected", ms };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: "Rate limited by the Anthropic API", ms };
    if (err instanceof Anthropic.APIError) return { ok: false, reason: `Claude API error ${err.status}: ${err.message}`.slice(0, 300), ms };
    return { ok: false, reason: `Claude call failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300), ms };
  }
};

export function addUsage(a: Usage, b?: Usage): Usage {
  if (!b) return a;
  return { input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite };
}
export const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
