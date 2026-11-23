import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isInstantSafe, previewSummary, recheckSummary, type ResultRow } from "@/engine/summary";
import { checkoutSignatureValid, priceOf, webhookSignatureValid } from "@/lib/payments";
import { safeNext } from "@/lib/session";

const row = (checkId: string, lens: string, outcome: ResultRow["outcome"], detail: Record<string, unknown> = {}): ResultRow => ({
  id: `${checkId}-${outcome}`,
  checkId,
  lens,
  outcome,
  evidenceStrength: outcome === "FAIL" ? 0.9 : 1,
  citation: outcome === "FAIL" ? { pageKind: "HOME", url: "https://x.in/", snippet: "s", viewport: "mobile" } : null,
  detail,
});

describe("what may be shown without review", () => {
  it("allows precision-safe checks and AUTO checks only", () => {
    expect(isInstantSafe("TRST-05", {})).toBe(true);
    expect(isInstantSafe("PROM-01", {})).toBe(false);
    expect(isInstantSafe("PROM-01", {}, new Set(["PROM-01"]))).toBe(true);
  });
  it("shows a hidden shipping charge only when the page says 'calculated at checkout'", () => {
    expect(isInstantSafe("PRIC-02", { deferred: true })).toBe(true);
    expect(isInstantSafe("PRIC-02", {})).toBe(false);
  });
  it("teases a safe finding even when a riskier one scores higher", () => {
    const s = previewSummary([row("CHKT-01", "CHKT", "FAIL"), row("AVAIL-02", "AVAIL", "FAIL", { text: "Gifting", href: "/x", status: 404 }), row("CLAR-01", "CLAR", "PASS")]);
    expect(s.issues).toBe(2);
    expect(s.teaser?.checkId).toBe("AVAIL-02");
  });
  it("shows no teaser when nothing safe fired", () => {
    expect(previewSummary([row("PROM-01", "PROM", "FAIL", { claim: "100% natural", page: "the homepage" })]).teaser).toBeNull();
  });
});

describe("re-check comparison", () => {
  it("counts but never names findings the founder hasn't been shown", () => {
    const s = recheckSummary([row("TRST-05", "TRST", "FAIL"), row("PROM-01", "PROM", "FAIL"), row("CLAR-01", "CLAR", "FAIL")], [row("TRST-05", "TRST", "FAIL"), row("PROM-01", "PROM", "FAIL"), row("CLAR-01", "CLAR", "PASS")], new Set(["CLAR-01"]));
    expect(s.stillOpen.map((x) => x.checkId)).toEqual(["TRST-05"]); // precision-safe, may be named
    expect(s.hidden.stillOpen).toBe(1); // PROM-01 was never shown: counted only
    expect(s.fixed.map((x) => x.checkId)).toEqual(["CLAR-01"]); // shown before, so named
  });
  it("only calls a finding fixed when a failed check now passes", () => {
    const s = recheckSummary(
      [row("TRST-05", "TRST", "FAIL"), row("AVAIL-02", "AVAIL", "FAIL"), row("DELV-01", "DELV", "FAIL"), row("CLAR-01", "CLAR", "PASS")],
      [row("TRST-05", "TRST", "PASS"), row("AVAIL-02", "AVAIL", "FAIL"), row("DELV-01", "DELV", "NOT_OBSERVABLE"), row("CLAR-01", "CLAR", "FAIL")],
      new Set(["DELV-01", "CLAR-01"]),
    );
    expect(s.fixed.map((x) => x.checkId)).toEqual(["TRST-05"]);
    expect(s.stillOpen.map((x) => x.checkId)).toEqual(["AVAIL-02"]);
    expect(s.unverified.map((x) => x.checkId)).toEqual(["DELV-01"]);
    expect(s.appeared.map((x) => x.checkId)).toEqual(["CLAR-01"]);
  });
});

describe("payments", () => {
  it("adds GST to the base price", () => {
    process.env.GST_RATE = "0.18";
    expect(priceOf("JOURNEY")).toEqual({ basePaise: 500000, gstPaise: 90000, amountPaise: 590000 });
  });
  it("verifies Razorpay checkout and webhook signatures", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec";
    const sig = createHmac("sha256", "secret").update("order_1|pay_1").digest("hex");
    expect(checkoutSignatureValid("order_1", "pay_1", sig)).toBe(true);
    expect(checkoutSignatureValid("order_1", "pay_2", sig)).toBe(false);
    const body = '{"event":"payment.captured"}';
    expect(webhookSignatureValid(body, createHmac("sha256", "whsec").update(body).digest("hex"))).toBe(true);
    expect(webhookSignatureValid(body, "0".repeat(64))).toBe(false);
  });
});

describe("sign-in redirects", () => {
  it("only redirects within QUARR", () => {
    expect(safeNext("/account/claim/abc")).toBe("/account/claim/abc");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", null]) expect(safeNext(bad)).toBe("/account");
  });
});
