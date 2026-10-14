import type { PageData } from "./types";

// Pure text and structured-data parsers shared by the crawler and the checks.

export function isEmptyCart(text: string) {
  return /(your )?(cart|bag|basket) is (currently )?empty|no items in (your )?(cart|bag)|0 items/i.test(text);
}

export function rupeeAmounts(text: string) {
  const out: number[] = [];
  const re = /(?:₹|Rs\.?|INR)\s?([\d,]+(?:\.\d{1,2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 40) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function priceFromJsonLd(data: PageData): number | null {
  for (const item of data.jsonLd as Record<string, unknown>[]) {
    if (!item || typeof item !== "object") continue;
    const type = String(item["@type"] ?? "");
    if (!/product/i.test(type)) continue;
    const offers = item.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
    const first = Array.isArray(offers) ? offers[0] : offers;
    const price = first?.price ?? first?.lowPrice;
    if (price !== undefined && price !== null && !Number.isNaN(Number(price))) return Number(price);
  }
  return null;
}
