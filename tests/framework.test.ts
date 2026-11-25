import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECKS } from "@/engine/checks";
import { LENSES, REASONING_RULES, STAGES, STORIES, STORY_BY_KEY, WHY_BUYERS_CARE, checksFor, coverage, coverageLabel, lensOf, lensesCheckedAutomatically, lensesForLabels, toLens, whyBuyersCare } from "@/engine/framework";
import { LENS_IDS, LENS_NAMES } from "@/engine/types";

describe("QUARR framework", () => {
  it("has exactly the 19 lenses in Notion 01, in order", () => {
    expect(LENSES.map((l) => l.id)).toEqual(["DISC", "CLAR", "RELV", "TRST", "PRIC", "PROM", "AVAIL", "CHKT", "DELV", "ONBD", "TRIAL", "SUBS", "CANC", "RTRN", "SUPP", "ENFC", "RETN", "ADVO", "STAT"]);
    expect([...LENS_IDS]).toEqual(LENSES.map((l) => l.id));
    for (const l of LENSES) expect(l.name).toBe(LENS_NAMES[l.id]);
  });

  it("maps every check to one of the 19 lenses", () => {
    for (const c of CHECKS) expect(LENS_IDS, c.id).toContain(c.lens);
    expect(LENSES.reduce((n, l) => n + checksFor(l.id).length, 0)).toBe(CHECKS.length);
    expect(lensOf("LGL-01")).toBe("ENFC");
    expect(lensOf("CLAR-02")).toBe("DISC");
    expect(lensOf("AI-COMMIT-01")).toBe("TRIAL");
  });

  it("defines every lens: a stage, a definition, a buyer question, what it needs, founder questions", () => {
    const stages = new Set(STAGES.map((s) => s.id));
    for (const l of LENSES) {
      expect(stages.has(l.stage), l.id).toBe(true);
      expect(l.definition.length, l.id).toBeGreaterThan(40);
      expect(l.definition, l.id).not.toMatch(/\d/);
      expect(l.buyerQuestion.endsWith("?"), l.id).toBe(true);
      expect(l.founderQuestions.length, l.id).toBeGreaterThanOrEqual(2);
      for (const q of l.founderQuestions) expect(q.endsWith("?"), q).toBe(true);
      // A lens the website can't fully show must say what else it needs.
      if (l.site !== "yes") expect(l.needs.length, l.id).toBeGreaterThan(0);
    }
    for (const s of STAGES) expect(LENSES.some((l) => l.stage === s.id), s.id).toBe(true);
  });

  it("counts the lenses a website walk can check, for the site's 'N of 19'", () => {
    expect(lensesCheckedAutomatically()).toBe(new Set(CHECKS.map((c) => c.lens)).size);
    expect(lensesCheckedAutomatically()).toBeLessThan(19);
  });

  it("reads lens values stored before the 19 under the new list", () => {
    expect(toLens("COST")).toBe("PRIC");
    expect(toLens("EXIT")).toBe("RTRN");
    expect(toLens("LGL")).toBe("ENFC");
    expect(toLens("EVIDENCE")).toBeNull();
    expect(toLens("DELV")).toBe("DELV");
    expect(toLens("")).toBeNull();
  });

  it("loads the research corpus with a source for every story and a lens for every buyer story", () => {
    expect(STORIES.filter((s) => s.kind === "customer").length).toBeGreaterThanOrEqual(40);
    expect(STORIES.filter((s) => s.kind === "founder").length).toBeGreaterThanOrEqual(40);
    for (const s of STORIES) {
      expect(s.url, s.key).toMatch(/^https?:\/\//);
      // Founder stories may be about the founder's own evidence, which is not a lens of the store.
      if (s.kind === "customer") expect(s.lenses.length, `${s.key}: ${s.lensLabels}`).toBeGreaterThan(0);
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
    expect(lensesForLabels("Delivery Promise, Cancellation, Refund and Service Recovery Lens.")).toEqual(expect.arrayContaining(["DELV", "PROM", "CANC", "RTRN", "SUPP"]));
    expect(lensesForLabels("Pricing; willingness to pay")).toEqual(expect.arrayContaining(["PRIC", "TRIAL"]));
    expect(lensesForLabels("Customer discovery")).toEqual([]); // the founder's research, not how buyers find a store
  });

  it("says what a lens needs instead of calling it passed when the website can't show it", () => {
    const results = CHECKS.map((c) => ({ checkId: c.id, outcome: "PASS" }));
    const cov = Object.fromEntries(coverage(results).map((c) => [c.lens.id, c]));
    expect(cov.PRIC.status).toBe("checked");
    expect(cov.RTRN.status).toBe("partly");
    expect(cov.TRIAL.status).toBe("partly"); // answered by the AI reader where pages say so
    expect(cov.ONBD.status).toBe("assessment"); // needs a test order
    expect(cov.CANC.status).toBe("assessment");
    expect(cov.RETN.status).toBe("your-data"); // needs the founder's repeat rate
    expect(cov.ADVO.status).toBe("your-data");
    expect(cov.SUBS.status).toBe("conditional"); // only some stores sell subscriptions
    const unseen = coverage([{ checkId: "RTRN-01", outcome: "NOT_OBSERVABLE" }]).find((c) => c.lens.id === "RTRN")!;
    expect(unseen.status).toBe("unknown");
    expect(coverageLabel(unseen).note).toBe(unseen.lens.founderQuestions[0]);
  });

  it("never shows a check that doesn't apply as a gap", () => {
    const na = coverage([{ checkId: "DELV-02", outcome: "NOT_APPLICABLE" }]).find((c) => c.lens.id === "DELV")!;
    expect(na.status).toBe("not-applicable");
    expect(coverageLabel(na).chip).toBe("Doesn't apply to your store");
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
