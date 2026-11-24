import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECKS } from "@/engine/checks";
import { CHECK_LENS, FRAMEWORK_LENSES, REASONING_RULES, STORIES, STORY_BY_KEY, WHY_BUYERS_CARE, coverage, lensesForLabels, whyBuyersCare } from "@/engine/framework";

describe("QUARR framework", () => {
  it("maps every check to exactly one lens, and only real checks", () => {
    const ids = CHECKS.map((c) => c.id).sort();
    expect(Object.keys(CHECK_LENS).sort()).toEqual(ids);
    const lensIds = new Set(FRAMEWORK_LENSES.map((l) => l.id));
    for (const l of Object.values(CHECK_LENS)) expect(lensIds.has(l)).toBe(true);
  });

  it("gives every lens a buyer question and founder questions", () => {
    for (const l of FRAMEWORK_LENSES) {
      expect(l.buyerQuestion.endsWith("?"), l.id).toBe(true);
      expect(l.founderQuestions.length, l.id).toBeGreaterThanOrEqual(2);
      for (const q of l.founderQuestions) expect(q.endsWith("?"), q).toBe(true);
    }
  });

  it("loads the research corpus with a source and a lens for every story", () => {
    expect(STORIES.filter((s) => s.kind === "customer").length).toBeGreaterThanOrEqual(40);
    expect(STORIES.filter((s) => s.kind === "founder").length).toBeGreaterThanOrEqual(40);
    for (const s of STORIES) {
      expect(s.url, s.key).toMatch(/^https?:\/\//);
      expect(s.lenses.length, `${s.key}: ${s.lensLabels}`).toBeGreaterThan(0);
    }
    expect(new Set(STORIES.map((s) => s.key)).size).toBe(STORIES.length);
  });

  it("cites only stories, rules and checks that exist", () => {
    const checkIds = new Set(CHECKS.map((c) => c.id));
    const ruleIds = new Set(REASONING_RULES.map((r) => r.id));
    for (const [id, w] of Object.entries(WHY_BUYERS_CARE)) {
      expect(checkIds.has(id), id).toBe(true);
      for (const k of w.stories) expect(STORY_BY_KEY[k], `${id} cites ${k}`).toBeTruthy();
      if (w.rule) expect(ruleIds.has(w.rule), w.rule).toBe(true);
    }
    for (const r of REASONING_RULES) for (const c of r.checks ?? []) expect(checkIds.has(c), `${r.id} backs ${c}`).toBe(true);
  });

  it("never adds a number to a finding through its research note", () => {
    // The note sits next to evidence-backed copy; a figure there would read as ours.
    for (const [id, w] of Object.entries(WHY_BUYERS_CARE)) expect(w.note, id).not.toMatch(/\d/);
  });

  it("keeps rules from one person's stories as hypotheses", () => {
    for (const r of REASONING_RULES) expect(r.status).toBe("hypothesis");
  });

  it("tags corpus labels to lenses", () => {
    expect(lensesForLabels("Delivery Promise, Cancellation, Refund and Service Recovery Lens.", "customer")).toEqual(expect.arrayContaining(["PROMISE", "EXIT", "RECOVERY"]));
    expect(lensesForLabels("Pricing; willingness to pay", "founder")).toEqual(expect.arrayContaining(["COST", "COMMIT", "EVIDENCE"]));
  });

  it("reports what a website walk can't see as unknown, not as passed", () => {
    const results = CHECKS.map((c) => ({ checkId: c.id, outcome: "PASS" }));
    const cov = Object.fromEntries(coverage(results).map((c) => [c.lens.id, c]));
    expect(cov.COST.status).toBe("checked");
    expect(cov.EXIT.status).toBe("partly");
    expect(cov.COMMIT.status).toBe("partly"); // answered by the AI reader where pages say so
    for (const id of ["AFTER", "VALUE", "EVIDENCE"] as const) expect(cov[id].status).toBe("unknown");
    const unseen = coverage([{ checkId: "RTRN-01", outcome: "NOT_OBSERVABLE" }]).find((c) => c.lens.id === "EXIT")!;
    expect(unseen.status).toBe("unknown");
  });

  it("resolves why-buyers-care with readable sources", () => {
    const w = whyBuyersCare("DELV-02")!;
    expect(w.stories[0].source).toMatch(/^Reddit, r\//);
    expect(whyBuyersCare("STAT-02")).toBeNull();
  });

  it("has no em dash in the corpus a founder may see", () => {
    expect(readFileSync("engine/framework/corpus.json", "utf8")).not.toContain("—");
  });
});
