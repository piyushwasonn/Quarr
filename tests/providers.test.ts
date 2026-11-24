import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { compareProviders, costUsd } from "@/engine/ai/compare";
import { aiUnavailable, callModel, providers, setModelForTests, type ModelFn } from "@/engine/ai/model";
import { draftFindings } from "@/engine/write";

// Both real SDKs, pointed at a local stand-in server: checks the exact request QUARR sends
// and how it reads the answer, with no key and no spend.

type Handler = (path: string, body: Record<string, unknown>) => { status?: number; json: unknown };
let server: Server;
let base = "";
let handler: Handler = () => ({ json: {} });
const requests: { path: string; body: Record<string, unknown> }[] = [];

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : {};
      requests.push({ path: req.url ?? "", body });
      const out = handler(req.url ?? "", body);
      res.writeHead(out.status ?? 200, { "content-type": "application/json" });
      res.end(JSON.stringify(out.json));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  requests.length = 0;
  setModelForTests(null);
});

const Schema = z.object({ answers: z.array(z.object({ checkId: z.string(), outcome: z.enum(["PASS", "FAIL"]) })) });
const answer = { answers: [{ checkId: "AI-COST-01", outcome: "PASS" }] };
const req = {
  name: "judge",
  system: "SYSTEM",
  evidence: [
    { type: "text" as const, text: "First phone screen:" },
    { type: "image" as const, mediaType: "image/jpeg" as const, data: Buffer.from("jpg").toString("base64") },
    { type: "text" as const, text: "<store>pages</store>" },
  ],
  task: "TASK",
  schema: Schema,
  effort: "medium" as const,
  maxTokens: 16000,
  cacheKey: "quarr-run1",
};

describe("choosing a provider", () => {
  it("uses the variable when set, otherwise whichever key is present (Claude first)", () => {
    expect(providers({ QUARR_AI_PROVIDER: "openai", ANTHROPIC_API_KEY: "a" })).toEqual({ primary: "openai", shadow: null });
    expect(providers({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" }).primary).toBe("anthropic");
    expect(providers({ OPENAI_API_KEY: "o" }).primary).toBe("openai");
    expect(providers({}).primary).toBeNull();
    expect(providers({ ANTHROPIC_API_KEY: "a", QUARR_AI_SHADOW: "openai" }).shadow).toBe("openai");
    expect(providers({ ANTHROPIC_API_KEY: "a", QUARR_AI_SHADOW: "anthropic" }).shadow).toBeNull(); // can't shadow itself
  });
  it("explains exactly what is missing", () => {
    expect(aiUnavailable(null, {})).toMatch(/ANTHROPIC_API_KEY, or OPENAI_API_KEY with OPENAI_MODEL/);
    expect(aiUnavailable("openai", { OPENAI_API_KEY: "o" })).toMatch(/OPENAI_MODEL is not set/);
    expect(aiUnavailable("openai", { OPENAI_API_KEY: "o", OPENAI_MODEL: "m" })).toBeNull();
    expect(aiUnavailable("anthropic", { OPENAI_API_KEY: "o" })).toMatch(/No ANTHROPIC_API_KEY/);
  });
});

describe("Claude (Anthropic SDK)", () => {
  it("sends screenshots, caches the evidence, asks for structured output, and reads the answer", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.ANTHROPIC_BASE_URL = base;
    handler = () => ({
      json: {
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-opus-5-5",
        content: [{ type: "text", text: JSON.stringify(answer) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 500, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 9000 },
      },
    });
    const res = await callModel(req, "anthropic");
    expect(res.ok && res.value).toEqual(answer);
    expect(res.ok && res.usage).toEqual({ input: 500, output: 80, cacheRead: 0, cacheWrite: 9000 });
    const body = requests[0].body as { model: string; system: string; fallbacks: string; output_config: { effort: string; format: { type: string } }; messages: { content: { type: string; cache_control?: unknown; source?: { media_type: string } }[] }[] };
    expect(requests[0].path).toMatch(/\/v1\/messages/);
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.system).toBe("SYSTEM");
    expect(body.fallbacks).toBe("default");
    expect(body.output_config.effort).toBe("medium");
    expect(body.output_config.format.type).toBe("json_schema");
    const content = body.messages[0].content;
    expect(content[1]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
    expect(content[2].cache_control).toEqual({ type: "ephemeral" }); // end of the shared evidence
    expect(content[3]).toMatchObject({ type: "text", text: "TASK" });
  });
  it("honours ANTHROPIC_MODEL", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.ANTHROPIC_BASE_URL = base;
    process.env.ANTHROPIC_MODEL = "claude-sonnet-5-5";
    handler = () => ({ json: { id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: JSON.stringify(answer) }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } });
    await callModel(req, "anthropic");
    expect((requests[0].body as { model: string }).model).toBe("claude-sonnet-5-5");
  });
});

describe("OpenAI (Responses API)", () => {
  const response = (content: unknown[], extra: Record<string, unknown> = {}) => ({
    id: "resp_1",
    object: "response",
    created_at: 1,
    status: "completed",
    model: "test-model",
    output: [{ type: "message", id: "msg_1", role: "assistant", status: "completed", content }],
    usage: { input_tokens: 10000, input_tokens_details: { cached_tokens: 8000, cache_write_tokens: 1500 }, output_tokens: 300, output_tokens_details: { reasoning_tokens: 200 }, total_tokens: 10300 },
    incomplete_details: null,
    error: null,
    ...extra,
  });
  const setup = () => {
    process.env.OPENAI_API_KEY = "test";
    process.env.OPENAI_BASE_URL = `${base}/v1`;
    process.env.OPENAI_MODEL = "test-model";
  };

  it("sends screenshots and instructions, asks for strict JSON, keeps nothing on OpenAI's side, and reads the answer", async () => {
    setup();
    handler = () => ({ json: response([{ type: "output_text", text: JSON.stringify(answer), annotations: [] }]) });
    const res = await callModel(req, "openai");
    expect(res.ok && res.value).toEqual(answer);
    // Cache reads and writes are reported separately from plain input, as for Claude.
    expect(res.ok && res.usage).toEqual({ input: 500, output: 300, cacheRead: 8000, cacheWrite: 1500 });
    const body = requests[0].body as { model: string; instructions?: string; store: boolean; prompt_cache_key: string; reasoning: { effort: string }; text: { format: { type: string; strict: boolean; name: string } }; input: [{ role: string; content: string }, { role: string; content: { type: string; image_url?: string; text?: string; prompt_cache_breakpoint?: unknown }[] }] };
    expect(requests[0].path).toBe("/v1/responses");
    expect(body.model).toBe("test-model");
    // GPT-6.2 puts top-level instructions after the input; QUARR sends them first, as a developer message.
    expect(body.instructions).toBeUndefined();
    expect(body.input[0]).toEqual({ role: "developer", content: "SYSTEM" });
    expect(body.store).toBe(false);
    expect(body.prompt_cache_key).toBe("quarr-run1");
    expect(body.reasoning.effort).toBe("medium");
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true, name: "judge" });
    const content = body.input[1].content;
    expect(content[1].type).toBe("input_image");
    expect(content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(content[2].prompt_cache_breakpoint).toEqual({ mode: "explicit" }); // end of the shared evidence
    expect(content[3]).toEqual({ type: "input_text", text: "TASK" });
  });
  it("leaves out reasoning effort when OPENAI_REASONING=off", async () => {
    setup();
    process.env.OPENAI_REASONING = "off";
    handler = () => ({ json: response([{ type: "output_text", text: JSON.stringify(answer), annotations: [] }]) });
    await callModel(req, "openai");
    expect(requests[0].body.reasoning).toBeUndefined();
  });
  it("treats a refusal, a cut-off answer or an unknown model as 'AI didn't run'", async () => {
    setup();
    handler = () => ({ json: response([{ type: "refusal", refusal: "Can't help." }]) });
    expect(await callModel(req, "openai")).toMatchObject({ ok: false, reason: "OpenAI declined the request" });
    handler = () => ({ json: response([], { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }) });
    expect(await callModel(req, "openai")).toMatchObject({ ok: false, reason: "Answer was cut off (max_output_tokens)" });
    handler = () => ({ status: 404, json: { error: { message: "The model does not exist", type: "invalid_request_error", code: "model_not_found" } } });
    const nf = await callModel(req, "openai");
    expect(nf.ok).toBe(false);
    expect(!nf.ok && nf.reason).toMatch(/check OPENAI_MODEL/);
  });
});

describe("wording follows the chosen provider", () => {
  it("records which provider worded a finding", async () => {
    process.env.QUARR_AI_PROVIDER = "openai";
    const seen: string[] = [];
    setModelForTests((async (r: { name: string }, provider: string) => {
      seen.push(`${r.name}:${provider}`);
      return { ok: true, ms: 1, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, value: { findings: [{ checkId: "DELV-01", title: "No delivery date", observed: "No estimate shown.", likelyEffect: "Buyers hesitate.", notYetProven: "May show at checkout." }] } };
    }) as unknown as ModelFn);
    const out = await draftFindings("Shop", [
      { checkId: "DELV-01", checkName: "x", template: { title: "t", observed: "o", likelyEffect: "l", notYetProven: "n" }, citation: { pageKind: "PRODUCT_1", url: "u", snippet: "s", viewport: "mobile" }, detail: {} },
    ]);
    expect(seen).toEqual(["write:openai"]);
    expect(out[0].draftedBy).toBe("openai");
  });
});

describe("comparing providers against your Bench decisions", () => {
  const run = (primary: Record<string, string>, shadow: Record<string, string>, decisions: [string, string, string | null][]) => ({
    ai: {
      status: "on",
      provider: "anthropic",
      model: "claude-opus-5-5",
      usage: { input: 1000, output: 1000, cacheRead: 0, cacheWrite: 0 },
      ms: 20000,
      shadow: { report: { status: "on", provider: "openai", model: "test-model", usage: { input: 1000, output: 1000, cacheRead: 0, cacheWrite: 0 }, ms: 15000 }, verdicts: Object.fromEntries(Object.entries(shadow).map(([k, v]) => [k, { verdict: v }])), judged: { "AI-COMMIT-01": { outcome: "FAIL" } } },
    },
    results: [{ checkId: "AI-COMMIT-01", outcome: "PASS" }],
    findings: decisions.map(([checkId, state, editReason]) => ({ checkId, state, editReason, ai: primary[checkId] ? { verdict: primary[checkId] } : null, detail: {} })),
  });

  it("scores agreement, and flags the costly mistake: hiding a real problem", () => {
    const scores = compareProviders([
      run(
        { "DELV-01": "CONFIRMED", "TRST-04": "REFUTED", "CLAR-03": "CONFIRMED", "PRIC-03": "UNSURE" },
        { "DELV-01": "CONFIRMED", "TRST-04": "CONFIRMED", "CLAR-03": "REFUTED", "PRIC-03": "CONFIRMED" },
        [
          ["DELV-01", "APPROVED", null], // real
          ["TRST-04", "EDITED", "WORDING"], // real
          ["CLAR-03", "DROPPED", "FALSE_POSITIVE"], // wrong
          ["PRIC-03", "DROPPED", "SEVERITY"], // says nothing about truth: skipped
        ],
      ),
    ]);
    const claude = scores.find((s) => s.provider === "anthropic")!;
    const openai = scores.find((s) => s.provider === "openai")!;
    expect(claude).toMatchObject({ role: "primary", reviewed: 3, agreed: 1, hidReal: 1, letWrong: 1, unsure: 0 });
    expect(openai).toMatchObject({ role: "shadow", reviewed: 3, agreed: 3, hidReal: 0, letWrong: 0, shadowOnlyFails: 1 });
  });

  it("prices Claude from list prices, and other models only when AI_PRICES says so", () => {
    expect(costUsd("claude-opus-5-5", { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(4);
    expect(costUsd("test-model", { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }, {})).toBeNull();
    expect(costUsd("test-model", { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }, { AI_PRICES: '{"test-model":[2,10]}' })).toBe(12);
  });
});
