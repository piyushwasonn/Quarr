import { describe, expect, it } from "vitest";
import { selectFindings, type Candidate } from "@/engine/select";
import { numbersGrounded } from "@/engine/write";
import { rupeeAmounts } from "@/engine/parse";
import { normalizeStoreUrl } from "@/lib/url";
import { CHECKS } from "@/engine/checks";

const c = (checkId: string, lens: Candidate["lens"], severity: number, evidenceStrength = 0.9, money = false, group?: string): Candidate => ({ resultId: checkId, checkId, lens, severity, evidenceStrength, money, group });

describe("selection rules", () => {
  it("picks at most three, one per lens", () => {
    const r = selectFindings([c("TRST-05", "TRST", 5), c("TRST-01", "TRST", 4), c("PRIC-02", "PRIC", 4, 0.9, true), c("DELV-01", "DELV", 4), c("CLAR-01", "CLAR", 2)]);
    expect(r.selected.map((s) => s.checkId)).toEqual(["PRIC-02", "TRST-05", "DELV-01"]);
    expect(r.otherIssues).toBe(2);
    expect(r.otherLenses).toBe(2);
  });
  it("shows only one finding per group", () => {
    const r = selectFindings([c("PRIC-02", "PRIC", 4, 0.9, true, "shipping-cost"), c("CHKT-02", "CHKT", 3, 0.9, true, "shipping-cost"), c("CLAR-01", "CLAR", 2)]);
    expect(r.selected.map((s) => s.checkId)).toEqual(["PRIC-02", "CLAR-01"]);
  });
  it("never leads with Legal Metrology", () => {
    // The LGL checks sit under "My rights as a buyer" (ENFC); the rule follows the checks, not the lens.
    const r = selectFindings([c("LGL-01", "ENFC", 5, 1), c("CLAR-01", "CLAR", 2)]);
    expect(r.selected[0].checkId).not.toMatch(/^LGL-/);
  });
});

describe("AI guardrail", () => {
  const item = { template: { title: "t", observed: "Delivered in 3-5 days", likelyEffect: "", notYetProven: "" }, citation: { pageKind: "CART" as const, url: "", snippet: "₹1,299 total", viewport: "mobile" as const }, detail: {} };
  it("accepts numbers present in the evidence", () => {
    expect(numbersGrounded({ title: "x", observed: "The cart shows ₹1,299 and 3-5 days", likelyEffect: "", notYetProven: "" }, item)).toBe(true);
  });
  it("rejects invented numbers", () => {
    expect(numbersGrounded({ title: "x", observed: "70% of buyers abandon", likelyEffect: "", notYetProven: "" }, item)).toBe(false);
  });
});

describe("store URL safety", () => {
  it("normalises pasted addresses", () => {
    expect(normalizeStoreUrl("www.Brand.in/products/x")).toEqual({ url: "https://www.brand.in/", domain: "brand.in" });
  });
  it("refuses internal targets", () => {
    for (const bad of ["localhost:3000", "http://127.0.0.1", "10.0.0.5", "http://192.168.1.1", "169.254.169.254", "intranet", "ftp://x.com"]) expect(normalizeStoreUrl(bad)).toBeNull();
  });
});

describe("parsers and library", () => {
  it("reads rupee amounts", () => {
    expect(rupeeAmounts("Total ₹1,299.00 · Rs. 49 delivery · INR 500")).toEqual([1299, 49, 500]);
  });
  it("has unique check ids with copy for every check", () => {
    const ids = CHECKS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CHECKS.length).toBeGreaterThanOrEqual(33);
  });
});

describe("in-page extraction script", () => {
  it("keeps regex escapes (a lost backslash once stripped every letter s)", async () => {
    const { EXTRACT_SCRIPT } = await import("@/engine/extract");
    expect(EXTRACT_SCRIPT).not.toContain("replace(/s+/g");
    expect(EXTRACT_SCRIPT).toContain("replace(/\\s+/g");
  });
});
