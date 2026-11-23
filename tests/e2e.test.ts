import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFixtures } from "@/fixtures/server";
import { crawlStore } from "@/engine/crawl";
import { CHECKS } from "@/engine/checks";
import type { CheckContext, Outcome, PageKind, StoredPage } from "@/engine/types";

// Crawls the two fixture stores with a real browser and checks every verdict.
let fx: { close: () => Promise<unknown> };
const verdicts: Record<string, Record<string, Outcome>> = {};

async function walk(port: number) {
  const r = await crawlStore(`http://127.0.0.1:${port}/`, { allowPrivateHosts: true, timeoutMs: 150_000 });
  if (!r.ok) throw new Error(`${r.code}: ${r.detail}`);
  const pages: Partial<Record<PageKind, StoredPage>> = {};
  for (const p of r.pages) pages[p.kind] = p;
  const ctx: CheckContext = { pages, signals: r.signals };
  const out: Record<string, Outcome> = {};
  for (const c of CHECKS) {
    const v = c.run(ctx);
    if (v.outcome === "FAIL") expect(v.citation, `${c.id} fired without a citation`).toBeTruthy();
    out[c.id] = v.outcome;
  }
  return { out, r };
}

beforeAll(async () => {
  fx = startFixtures(4202, 4201);
  verdicts.good = (await walk(4202)).out;
  verdicts.flawed = (await walk(4201)).out;
});
afterAll(async () => fx?.close());

describe("good store", () => {
  it("passes everything except HTTPS (fixtures run over http)", () => {
    const fails = Object.entries(verdicts.good).filter(([, o]) => o === "FAIL").map(([k]) => k);
    expect(fails).toEqual(["TRST-03"]);
  });
});

describe("flawed store", () => {
  const planted = ["PRIC-01", "PRIC-02", "PRIC-03", "PRIC-04", "DELV-01", "DELV-02", "RTRN-02", "RTRN-03", "RTRN-04", "TRST-01", "TRST-02", "TRST-04", "TRST-05", "TRST-06", "LGL-01", "LGL-02", "LGL-03", "AVAIL-01", "AVAIL-02", "AVAIL-03", "CHKT-02", "CHKT-03", "CHKT-04", "CLAR-01", "CLAR-02", "CLAR-03", "CLAR-04", "PROM-01", "PROM-02", "PROM-03"];
  it.each(planted)("%s fires", (id) => {
    expect(verdicts.flawed[id]).toBe("FAIL");
  });
  it("does not fire on things that are fine", () => {
    for (const id of ["RTRN-01", "DELV-03", "CHKT-01", "STAT-01", "STAT-02"]) expect(verdicts.flawed[id], id).not.toBe("FAIL");
  });
});

describe("preview walk", () => {
  it("visits only the homepage, one product and the two policies, phone only", async () => {
    const steps: string[] = [];
    const r = await crawlStore("http://127.0.0.1:4201/", { allowPrivateHosts: true, timeoutMs: 90_000, mode: "preview", onProgress: (s) => steps.push(s) });
    if (!r.ok) throw new Error(r.detail);
    expect(r.pages.map((p) => p.kind).sort()).toEqual(["HOME", "PRODUCT_1", "RETURNS", "SHIPPING"]);
    expect(r.pages.every((p) => !p.desktopShot)).toBe(true);
    expect(r.signals.addToCart.attempted).toBe(false);
    expect(steps[0]).toBe("Opening your homepage on a phone");
  });
});
