import type { Box, CheckContext, CheckVerdict, Citation, ElementKey, PageKind, StoredPage } from "../types";

export const PRODUCT_KINDS: PageKind[] = ["PRODUCT_1", "PRODUCT_2"];

export function pagesOf(ctx: CheckContext, kinds: PageKind[]) {
  return kinds.map((k) => ctx.pages[k]).filter((p): p is StoredPage => !!p && (p.httpStatus ?? 200) < 400);
}

// The first match of `re` across `kinds`, returned with surrounding context.
// Information inside a collapsed section counts as present (a buyer can open it with a
// tap), so presence checks also search each page's hidden text after its visible text.
export function findIn(ctx: CheckContext, kinds: PageKind[], re: RegExp, radius = 90) {
  for (const p of pagesOf(ctx, kinds)) {
    const hit = snippetAround(p.text, re, radius);
    if (hit) return { page: p, snippet: hit.snippet, index: hit.index, match: hit.match, collapsed: false };
  }
  for (const p of pagesOf(ctx, kinds)) {
    const hit = p.data.hiddenText ? snippetAround(p.data.hiddenText, re, radius) : null;
    if (hit) return { page: p, snippet: hit.snippet, index: hit.index, match: hit.match, collapsed: true };
  }
  return null;
}

// Visible text plus collapsed-section text, for presence checks that test a page directly.
export const fullText = (p: StoredPage) => `${p.text}\n${p.data.hiddenText ?? ""}`;

export function snippetAround(text: string, re: RegExp, radius = 90) {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const m = new RegExp(re.source, flags).exec(text);
  if (!m) return null;
  // Stay inside the paragraph that holds the match, widening only for very short lines.
  let start = text.lastIndexOf("\n", m.index) + 1;
  let end = text.indexOf("\n", m.index + m[0].length);
  if (end < 0) end = text.length;
  if (end - start < 60) {
    start = text.lastIndexOf("\n", Math.max(0, start - 2)) + 1;
    const next = text.indexOf("\n", end + 1);
    end = next < 0 ? text.length : next;
  }
  start = Math.max(start, m.index - radius);
  end = Math.min(end, m.index + m[0].length + radius);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  const lineStart = start === 0 || text[start - 1] === "\n";
  const lineEnd = end === text.length || text[end] === "\n";
  return { snippet: `${lineStart ? "" : "…"}${body}${lineEnd ? "" : "…"}`, index: m.index, match: m[0] };
}

export function cite(page: StoredPage, snippet: string, opts: { box?: Box | ElementKey; viewport?: "mobile" | "desktop"; searched?: PageKind[] } = {}): Citation {
  const box = typeof opts.box === "string" ? page.data.boxes?.[opts.box] : opts.box;
  return {
    pageKind: page.kind,
    url: page.finalUrl || page.url,
    snippet: snippet.slice(0, 400),
    viewport: opts.viewport ?? "mobile",
    box: box ?? undefined,
    searched: opts.searched,
  };
}

export const pass = (detail?: Record<string, unknown>): CheckVerdict => ({ outcome: "PASS", detail });
export const unseen = (why: string): CheckVerdict => ({ outcome: "NOT_OBSERVABLE", detail: { why } });
export const fail = (citation: Citation, detail: Record<string, unknown> = {}, evidenceStrength = 0.85): CheckVerdict => ({
  outcome: "FAIL",
  citation,
  detail,
  evidenceStrength,
});

// An absence finding still cites a real page: the one where the buyer would
// have expected to see the information.
export function absent(ctx: CheckContext, searched: PageKind[], cited: PageKind[], what: string, detail: Record<string, unknown> = {}, strength = 0.8, box?: ElementKey) {
  const page = pagesOf(ctx, cited)[0];
  if (!page) return unseen(`No ${cited.join("/")} page captured`);
  const looked = searched.filter((k) => ctx.pages[k]);
  return fail(
    cite(page, `Searched ${looked.map(label).join(", ")} for ${what}, including collapsed sections. Not found.`, { box, searched: looked }),
    { ...detail, searched: looked.map(label) },
    strength,
  );
}

export function label(kind: PageKind) {
  return (
    {
      HOME: "the homepage",
      PRODUCT_1: "the first product page",
      PRODUCT_2: "the second product page",
      CART: "the cart",
      CHECKOUT: "the first checkout screen",
      SHIPPING: "the shipping policy",
      RETURNS: "the returns policy",
      TERMS: "the terms page",
      PRIVACY: "the privacy policy",
      CONTACT: "the contact page",
      ABOUT: "the about page",
    } as Record<PageKind, string>
  )[kind];
}

export const has = (ctx: CheckContext, kind: PageKind) => !!ctx.pages[kind] && (ctx.pages[kind]!.httpStatus ?? 200) < 400;
export const hasProduct = (ctx: CheckContext) => PRODUCT_KINDS.some((k) => has(ctx, k));
