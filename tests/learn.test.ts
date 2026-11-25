import { describe, expect, it } from "vitest";
import { aiMistakes, crawlGaps, goodPractice, MIN_STORES_FOR_PATTERN, storePatterns, truthOf, type LearnRun } from "@/engine/learn";

const run = (over: Partial<LearnRun> = {}): LearnRun => ({
  id: "r",
  domain: "shop.in",
  kind: "FULL",
  platform: "shopify",
  crawledAt: new Date(),
  pages: ["HOME", "PRODUCT_1", "PRODUCT_2", "CART", "SHIPPING", "RETURNS", "CONTACT"].map((kind) => ({ kind })),
  results: [],
  findings: [],
  ...over,
});

describe("learning from every crawl", () => {
  it("calls a site with no product pages out of scope, as with gokorbyt.com", () => {
    const korbyt = run({ domain: "gokorbyt.com", pages: ["HOME", "TERMS", "PRIVACY", "CONTACT", "ABOUT"].map((kind) => ({ kind })) });
    expect(crawlGaps(korbyt).map((g) => g.code)).toEqual(["NOT_A_STORE"]);
  });

  it("lists the pages the crawler couldn't reach on a store, expecting less from a quick scan", () => {
    const full = run({ pages: ["HOME", "PRODUCT_1", "RETURNS"].map((kind) => ({ kind })) });
    expect(crawlGaps(full).map((g) => g.code)).toEqual(["NO_CART", "NO_SHIPPING", "NO_CONTACT"]);
    const preview = run({ kind: "PREVIEW", pages: ["HOME", "PRODUCT_1", "SHIPPING", "RETURNS"].map((kind) => ({ kind })) });
    expect(crawlGaps(preview)).toEqual([]);
  });

  it("reads your decisions as truth only when they say whether a finding was real", () => {
    expect(truthOf({ state: "APPROVED", editReason: null })).toBe(true);
    expect(truthOf({ state: "EDITED", editReason: "WORDING" })).toBe(true);
    expect(truthOf({ state: "DROPPED", editReason: "FALSE_POSITIVE" })).toBe(false);
    expect(truthOf({ state: "DROPPED", editReason: "SEVERITY" })).toBeNull();
    expect(truthOf({ state: "DRAFT", editReason: null })).toBeNull();
  });

  it("records where the AI and your review disagreed, as with PRIC-03 on weobserve.in", () => {
    const r = run({
      domain: "weobserve.in",
      results: [
        { checkId: "PRIC-03", outcome: "FAIL", detail: {}, ai: { verdict: "REFUTED", reason: "The Terms state prices include taxes." } },
        { checkId: "CLAR-03", outcome: "FAIL", detail: {}, ai: { verdict: "CONFIRMED", reason: "No size guide." } },
        { checkId: "AI-EXIT-01", outcome: "FAIL", detail: { reason: "Promise and policy differ." }, ai: null },
        { checkId: "DELV-01", outcome: "FAIL", detail: {}, ai: { verdict: "CONFIRMED", reason: "" } },
      ],
      findings: [
        { checkId: "PRIC-03", state: "APPROVED", editReason: null },
        { checkId: "CLAR-03", state: "DROPPED", editReason: "FALSE_POSITIVE" },
        { checkId: "AI-EXIT-01", state: "DROPPED", editReason: "EVIDENCE_WRONG" },
        { checkId: "DELV-01", state: "APPROVED", editReason: null },
      ],
    });
    expect(aiMistakes(r).map((m) => `${m.checkId}:${m.what}`)).toEqual(["PRIC-03:HID_REAL", "CLAR-03:LET_WRONG", "AI-EXIT-01:AI_CHECK_WRONG"]);
  });

  it("counts patterns only on reviewed stores, and says when there are too few to call one", () => {
    const reviewed = (domain: string, kept: boolean) =>
      run({ domain, results: [{ checkId: "DELV-01", outcome: "FAIL", detail: {}, ai: null }, { checkId: "PRIC-03", outcome: "FAIL", detail: {}, ai: null }], findings: [{ checkId: "DELV-01", state: kept ? "APPROVED" : "DROPPED", editReason: kept ? null : "FALSE_POSITIVE" }] });
    const notStore = run({ pages: [{ kind: "HOME" }], findings: [{ checkId: "DELV-01", state: "APPROVED", editReason: null }] });
    const unreviewed = run({ results: [{ checkId: "DELV-01", outcome: "FAIL", detail: {}, ai: null }] });
    const out = storePatterns([reviewed("a.in", true), reviewed("b.in", true), reviewed("c.in", false), notStore, unreviewed]);
    expect(out.reviewedStores).toBe(3);
    expect(out.enough).toBe(false);
    const delv = out.patterns.find((p) => p.checkId === "DELV-01")!;
    expect(delv).toMatchObject({ kept: 2, droppedWrong: 1, firedUnreviewed: 0, lens: "DELV" });
    expect(out.patterns.find((p) => p.checkId === "PRIC-03")).toMatchObject({ kept: 0, firedUnreviewed: 3 });
    const many = Array.from({ length: MIN_STORES_FOR_PATTERN }, (_, i) => reviewed(`s${i}.in`, true));
    expect(storePatterns(many).enough).toBe(true);
  });

  it("keeps good practice only when the AI quoted the page", () => {
    const r = run({
      results: [
        { checkId: "AI-COMMIT-01", outcome: "PASS", detail: { quotes: [{ page: "SHIPPING", text: "Cash on delivery available" }] }, ai: null },
        { checkId: "AI-COST-01", outcome: "PASS", detail: { quotes: [] }, ai: null },
        { checkId: "DELV-01", outcome: "PASS", detail: {}, ai: null },
      ],
    });
    expect(goodPractice(r)).toEqual([{ domain: "shop.in", checkId: "AI-COMMIT-01", lens: "TRIAL", quotes: [{ page: "SHIPPING", text: "Cash on delivery available" }] }]);
  });
});
