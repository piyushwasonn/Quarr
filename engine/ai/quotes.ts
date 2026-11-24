import type { PageKind, StoredPage } from "../types";

// The AI may only point at text that is really on the captured page. Every quote it returns
// is checked here, character for character after light normalisation. A quote that isn't
// found is discarded, and a verdict that needed it falls back to "unsure" or "unknown".

export type Quote = { page: string; text: string };

export function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–\u2014−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\brs\.?\s*/g, "₹")
    .replace(/₹\s+/g, "₹")
    .replace(/\s+/g, " ")
    .trim();
}

export function pageHaystack(p: StoredPage) {
  const d = p.data;
  return normalise([p.title, p.text, d.hiddenText ?? "", d.h1.join(" "), d.metaDescription ?? "", d.buttons.join(" "), d.links.map((l) => l.text).join(" ")].join(" \n "));
}

const MIN_QUOTE = 6;

// True when every part of the quote (split on "..." the way people elide) is on the page, in order.
export function quoteOnPage(quote: string, haystack: string) {
  const parts = normalise(quote)
    .replace(/^["']|["']$/g, "")
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((x) => x.replace(/^[\s.,;:]+|[\s.,;:]+$/g, ""))
    .filter(Boolean);
  if (!parts.length || parts.join("").length < MIN_QUOTE) return false;
  let from = 0;
  for (const part of parts) {
    const at = haystack.indexOf(part, from);
    if (at < 0) return false;
    from = at + part.length;
  }
  return true;
}

export function verifyQuotes(quotes: Quote[], pages: Partial<Record<PageKind, StoredPage>>) {
  const cache = new Map<string, string>();
  const valid: Quote[] = [];
  let rejected = 0;
  for (const q of quotes) {
    const page = pages[q.page as PageKind];
    if (!page || !q.text) {
      rejected++;
      continue;
    }
    if (!cache.has(q.page)) cache.set(q.page, pageHaystack(page));
    if (quoteOnPage(q.text, cache.get(q.page)!)) valid.push({ page: q.page, text: q.text.trim().slice(0, 300) });
    else rejected++;
  }
  return { valid, rejected };
}

// Two quotes only count as "both sides" of a contradiction if they say different things.
export function distinctQuotes(quotes: Quote[]) {
  const seen = new Set<string>();
  return quotes.filter((q) => {
    const k = normalise(q.text);
    if ([...seen].some((s) => s.includes(k) || k.includes(s))) return false;
    seen.add(k);
    return true;
  });
}
