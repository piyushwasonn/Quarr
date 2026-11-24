import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHECKS } from "@/engine/checks";
import { plainPunctuation } from "@/lib/punctuation";

const EM = "—";

describe("plain punctuation (no em dashes reach a founder)", () => {
  it("rewrites dashes into ordinary punctuation", () => {
    expect(plainPunctuation(`Buyers hesitate ${EM} and leave.`)).toBe("Buyers hesitate, and leave.");
    expect(plainPunctuation(`Delivered in 3–5 days`)).toBe("Delivered in 3 to 5 days");
    expect(plainPunctuation(`Price – not stated`)).toBe("Price, not stated");
    expect(plainPunctuation(`Ends here${EM}.`)).toBe("Ends here.");
    expect(plainPunctuation("No dashes here.")).toBe("No dashes here.");
  });

  it("no check template contains an em dash", () => {
    const citation = { pageKind: "HOME" as const, url: "https://x.in/", snippet: "s", viewport: "mobile" as const };
    for (const c of CHECKS) {
      const copy = c.copy({}, citation);
      for (const v of Object.values(copy)) expect(v, c.id).not.toContain(EM);
    }
  });

  it("no em dash anywhere in the site, email or engine source", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|css|md)$/.test(name) && readFileSync(p, "utf8").includes(EM)) hits.push(p);
      }
    };
    for (const d of ["app", "components", "lib", "engine", "docs"]) walk(path.resolve(d));
    expect(hits).toEqual([]);
  });
});
