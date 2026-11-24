import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

// The one place where QUARR talks to an AI model. Two providers sit behind the same call:
//   Anthropic (Claude) and OpenAI. Everything that keeps findings safe (quote checks,
//   number checks, what may be shown unreviewed) is QUARR's own code and is the same for both.
//
// Choosing (crawler environment, GitHub → Settings → Secrets and variables → Actions):
//   QUARR_AI_PROVIDER  anthropic | openai   (unset: whichever key is present, Anthropic first)
//   QUARR_AI_SHADOW    anthropic | openai   (optional: also run the other one, record only)
//   ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default claude-opus-5-5)
//   OPENAI_API_KEY, OPENAI_MODEL (required: the exact model ID from OpenAI's models page)
// Tests swap the model out with setModelForTests, so no test spends money or needs a key.

type Env = Record<string, string | undefined>;
export type Provider = "anthropic" | "openai";
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type EvidenceBlock = { type: "text"; text: string } | { type: "image"; mediaType: "image/jpeg" | "image/png"; data: string };
export type Evidence = EvidenceBlock[];
export type ModelRequest<T extends z.ZodType> = {
  name: string; // "verify" | "judge" | "write": also the structured-output name
  system: string;
  evidence: Evidence; // identical across calls in a run, so it is cached after the first
  task: string;
  schema: T;
  effort: "low" | "medium" | "high";
  maxTokens: number; // includes the model's reasoning
  cacheKey?: string;
};
export type ModelResult<T> = { ok: true; value: T; usage: Usage; ms: number } | { ok: false; reason: string; usage?: Usage; ms: number };
export type ModelFn = <T extends z.ZodType>(req: ModelRequest<T>, provider: Provider) => Promise<ModelResult<z.infer<T>>>;

let override: ModelFn | null = null;
export function setModelForTests(fn: ModelFn | null) {
  override = fn;
}

const isProvider = (v: string | undefined): v is Provider => v === "anthropic" || v === "openai";
const hasKey = (p: Provider, env: Env) => (p === "anthropic" ? !!(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) : !!env.OPENAI_API_KEY);

export function providers(env: Env = process.env): { primary: Provider | null; shadow: Provider | null } {
  const chosen = env.QUARR_AI_PROVIDER?.trim().toLowerCase();
  const primary: Provider | null = isProvider(chosen) ? chosen : hasKey("anthropic", env) ? "anthropic" : hasKey("openai", env) ? "openai" : null;
  const s = env.QUARR_AI_SHADOW?.trim().toLowerCase();
  const shadow = isProvider(s) && s !== primary ? s : null;
  return { primary, shadow };
}

export function modelFor(p: Provider, env: Env = process.env): string | null {
  return p === "anthropic" ? env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL : env.OPENAI_MODEL?.trim() || null;
}

// Why this provider can't run right now, or null when it can.
export function aiUnavailable(p: Provider | null = providers().primary, env: Env = process.env): string | null {
  if (env.QUARR_DISABLE_AI === "1") return "AI switched off (QUARR_DISABLE_AI=1)";
  if (override) return null;
  if (!p) return "No AI key in the crawler's environment: add ANTHROPIC_API_KEY, or OPENAI_API_KEY with OPENAI_MODEL";
  if (!hasKey(p, env)) return p === "anthropic" ? "No ANTHROPIC_API_KEY in the crawler's environment" : "No OPENAI_API_KEY in the crawler's environment";
  if (!modelFor(p, env)) return "OPENAI_MODEL is not set: copy the exact model ID from OpenAI's models page";
  return null;
}

export const callModel: ModelFn = async (req, provider) => {
  if (override) return override(req, provider);
  return provider === "openai" ? callOpenAI(req) : callAnthropic(req);
};

// ── Anthropic (Claude) ──────────────────────────────────────────────────────

const callAnthropic = async <T extends z.ZodType>(req: ModelRequest<T>): Promise<ModelResult<z.infer<T>>> => {
  const started = Date.now();
  const client = new Anthropic({ timeout: 180_000, maxRetries: 2 });
  // The evidence is the long, shared prefix: mark its end so the next call reads it from cache.
  const last = req.evidence.length - 1;
  const content: Anthropic.Beta.BetaContentBlockParam[] = req.evidence.map((b, i) =>
    b.type === "image"
      ? { type: "image", source: { type: "base64", media_type: b.mediaType, data: b.data } }
      : { type: "text", text: b.text, ...(i === last ? { cache_control: { type: "ephemeral" as const } } : {}) },
  );
  try {
    const response = await client.beta.messages.parse({
      model: modelFor("anthropic") ?? DEFAULT_ANTHROPIC_MODEL,
      max_tokens: req.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: req.effort, format: betaZodOutputFormat(req.schema) },
      system: req.system,
      messages: [{ role: "user", content: [...content, { type: "text", text: req.task }] }],
    });
    const u = response.usage;
    const usage: Usage = { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 };
    const ms = Date.now() - started;
    if (response.stop_reason === "refusal") return { ok: false, reason: "Claude declined the request", usage, ms };
    if (response.stop_reason === "max_tokens") return { ok: false, reason: "Answer was cut off (max_tokens)", usage, ms };
    if (!response.parsed_output) return { ok: false, reason: `No structured answer (stop reason: ${response.stop_reason})`, usage, ms };
    return { ok: true, value: response.parsed_output, usage, ms };
  } catch (err) {
    const ms = Date.now() - started;
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "The Anthropic API key was rejected", ms };
    if (err instanceof Anthropic.NotFoundError) return { ok: false, reason: `Claude model "${modelFor("anthropic")}" not found: check ANTHROPIC_MODEL`, ms };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: "Rate limited by the Anthropic API", ms };
    if (err instanceof Anthropic.APIError) return { ok: false, reason: `Claude API error ${err.status}: ${err.message}`.slice(0, 300), ms };
    return { ok: false, reason: `Claude call failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300), ms };
  }
};

// ── OpenAI ──────────────────────────────────────────────────────────────────

const callOpenAI = async <T extends z.ZodType>(req: ModelRequest<T>): Promise<ModelResult<z.infer<T>>> => {
  const started = Date.now();
  const model = modelFor("openai")!;
  const client = new OpenAI({ timeout: 180_000, maxRetries: 2 });
  // Same layout as Claude: stable instructions, then the shared evidence, then this call's task.
  // GPT-6.2 appends top-level `instructions` after the input, so the instructions go in a
  // developer message at the start instead, and the end of the evidence is an explicit
  // cache breakpoint (OpenAI's GPT-6.2 guide: prompt caching, prefix matching).
  const last = req.evidence.length - 1;
  const content: OpenAI.Responses.ResponseInputContent[] = [
    ...req.evidence.map((b, i): OpenAI.Responses.ResponseInputContent =>
      b.type === "image"
        ? { type: "input_image", image_url: `data:${b.mediaType};base64,${b.data}`, detail: "high" }
        : { type: "input_text", text: b.text, ...(i === last ? { prompt_cache_breakpoint: { mode: "explicit" as const } } : {}) },
    ),
    { type: "input_text", text: req.task },
  ];
  try {
    const response = await client.responses.parse({
      model,
      input: [
        { role: "developer", content: req.system },
        { role: "user", content },
      ],
      text: { format: zodTextFormat(req.schema, req.name) },
      // Reasoning models take an effort level; set OPENAI_REASONING=off for a model that doesn't.
      ...(process.env.OPENAI_REASONING === "off" ? {} : { reasoning: { effort: req.effort } }),
      max_output_tokens: req.maxTokens,
      store: false, // QUARR doesn't need OpenAI to keep the response
      ...(req.cacheKey ? { prompt_cache_key: req.cacheKey } : {}),
    });
    const u = response.usage;
    const cached = u?.input_tokens_details?.cached_tokens ?? 0;
    const written = u?.input_tokens_details?.cache_write_tokens ?? 0;
    // OpenAI's cache reads and writes are a breakdown of input_tokens; QUARR reports the three
    // separately, like Anthropic, so each is priced once.
    const usage: Usage = { input: Math.max(0, (u?.input_tokens ?? 0) - cached - written), output: u?.output_tokens ?? 0, cacheRead: cached, cacheWrite: written };
    const ms = Date.now() - started;
    const refused = response.output.some((o) => o.type === "message" && o.content.some((c) => c.type === "refusal"));
    if (refused) return { ok: false, reason: "OpenAI declined the request", usage, ms };
    if (response.status === "incomplete") return { ok: false, reason: `Answer was cut off (${response.incomplete_details?.reason ?? "incomplete"})`, usage, ms };
    if (response.output_parsed == null) return { ok: false, reason: `No structured answer (status: ${response.status})`, usage, ms };
    return { ok: true, value: response.output_parsed as z.infer<T>, usage, ms };
  } catch (err) {
    const ms = Date.now() - started;
    if (err instanceof OpenAI.AuthenticationError) return { ok: false, reason: "The OpenAI API key was rejected", ms };
    if (err instanceof OpenAI.NotFoundError) return { ok: false, reason: `OpenAI model "${model}" not found: check OPENAI_MODEL`, ms };
    if (err instanceof OpenAI.RateLimitError) return { ok: false, reason: "Rate limited by the OpenAI API (or out of credit)", ms };
    if (err instanceof OpenAI.APIError) return { ok: false, reason: `OpenAI API error ${err.status}: ${err.message}`.slice(0, 300), ms };
    return { ok: false, reason: `OpenAI call failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300), ms };
  }
};

export function addUsage(a: Usage, b?: Usage): Usage {
  if (!b) return a;
  return { input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite };
}
export const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
