import { describe, expect, it } from "vitest";
import { CHECKS } from "@/engine/checks";
import { FIXES, whatToDo } from "@/engine/checks/fixes";
import { recheckHeadline } from "@/engine/summary";

// Every detail variant a check can report, so each one's step is exercised.
const VARIANTS: Record<string, Record<string, unknown>[]> = {
  "PRIC-01": [{ kind: "missing" }, { kind: "structured" }],
  "TRST-03": [{ kind: "nohttps" }, { kind: "mixed" }],
  "CLAR-01": [{ kind: "none" }, { kind: "generic" }],
  "DELV-03": [{ kind: "missing" }, { kind: "broken" }, { kind: "empty" }],
  "RTRN-01": [{ kind: "missing" }, { kind: "broken" }, { kind: "empty" }],
};

const EM = "—";

describe("what to do (one plain next step on every finding)", () => {
  it("has a step for every check QUARR runs, and none for checks that don't exist", () => {
    const ids = CHECKS.map((c) => c.id).sort();
    expect(Object.keys(FIXES).sort()).toEqual(ids);
  });

  it("never states a number, never uses an em dash, and always gives a full sentence", () => {
    for (const c of CHECKS) {
      for (const detail of VARIANTS[c.id] ?? [{}]) {
        for (const platform of ["shopify", "woocommerce", null]) {
          const step = whatToDo(c.id, detail, platform);
          expect(step.length, c.id).toBeGreaterThan(30);
          expect(step, `${c.id} has a number`).not.toMatch(/\d/);
          expect(step, c.id).not.toContain(EM);
          expect(step, c.id).toMatch(/[.]$/);
        }
      }
    }
  });

  it("gives a different step for each kind of problem a check finds", () => {
    expect(whatToDo("DELV-03", { kind: "broken" })).toContain("error page");
    expect(whatToDo("DELV-03", { kind: "empty" })).toContain("in full");
    expect(whatToDo("DELV-03", { kind: "missing" })).toContain("Publish");
    expect(whatToDo("PRIC-01", { kind: "structured" })).toContain("structured data");
    expect(whatToDo("TRST-03", { kind: "mixed" })).toContain("http://");
  });

  it("adds the Shopify admin path only on Shopify stores", () => {
    expect(whatToDo("RTRN-02", {}, "shopify")).toContain("In Shopify: Settings → Policies");
    expect(whatToDo("RTRN-02", {}, "woocommerce")).not.toContain("Shopify");
    expect(whatToDo("RTRN-02", {}, null)).not.toContain("Shopify");
    // No known admin path: the general step only, even on Shopify.
    expect(whatToDo("PRIC-04", {}, "shopify")).not.toContain("Shopify");
  });

  it("returns nothing for an unknown check rather than inventing advice", () => {
    expect(whatToDo("NOPE-01", {})).toBe("");
  });
});

describe("re-check headline (what the founder fixed, out of what was open)", () => {
  const items = (n: number) => Array.from({ length: n }, () => ({}));
  it("leads with what you fixed, counting findings not yet shown", () => {
    const h = recheckHeadline({ fixed: items(2), stillOpen: items(1), appeared: [], unverified: [], hidden: { fixed: 1, stillOpen: 1, appeared: 1, unverified: 0 } });
    expect(h.headline).toBe("You fixed 3 of 5 issues from last time.");
    expect(h.line).toBe("2 still open · 1 new");
  });
  it("says so plainly when nothing, or everything, is fixed", () => {
    expect(recheckHeadline({ stillOpen: items(4) }).headline).toBe("None of the 4 issues from last time are fixed yet.");
    expect(recheckHeadline({ stillOpen: items(1) }).headline).toBe("The issue from last time isn't fixed yet.");
    expect(recheckHeadline({ fixed: items(3) }).headline).toBe("You fixed all 3 issues from last time.");
    expect(recheckHeadline({}).headline).toBe("Nothing was left open from last time.");
  });
  it("counts pages it couldn't see as not checked, never as fixed", () => {
    const h = recheckHeadline({ fixed: items(1), unverified: items(1) });
    expect(h.headline).toBe("You fixed 1 of 2 issues from last time.");
    expect(h.line).toContain("1 we couldn't check this time");
  });
});
