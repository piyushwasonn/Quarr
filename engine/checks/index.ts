import { priceFromJsonLd } from "../parse";
import type { CheckDef, StoredPage } from "../types";
import { absent, cite, fail, findIn, has, hasProduct, label, pagesOf, pass, PRODUCT_KINDS, snippetAround, unseen } from "./helpers";

// The QUARR First Look check library.
// Rules (03 — Free First Look Engine):
//  1. A finding exists only when one of these deterministic checks fires.
//  2. Every check returns PASS, FAIL or NOT_OBSERVABLE. What the crawler could
//     not see is NOT_OBSERVABLE, never FAIL.
// Copy is written in the buyer's voice, hedged where the evidence is indirect.

const PRE_CHECKOUT = ["HOME", "PRODUCT_1", "PRODUCT_2", "CART"] as const;
const DAYS = String.raw`(?:\d{1,2}\s*(?:-|–|to)\s*\d{1,2}|within\s+\d{1,2}|in\s+\d{1,2}|\d{1,2})\s*(?:working\s+|business\s+)?days?`;
const NO_RETURNS = /(no|do not|don't|cannot)\s+(accept\s+)?(returns?|exchanges?)|non[- ]returnable|all sales are final/i;

const short = (s: unknown, n = 140) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export const CHECKS: CheckDef[] = [
  // ───────────── PRICING ─────────────
  {
    id: "PRIC-01",
    lens: "PRIC",
    name: "Price visible on product page",
    severity: 5,
    money: true,
    run: (ctx) => {
      const pages = pagesOf(ctx, PRODUCT_KINDS);
      if (!pages.length) return unseen("No product page captured");
      for (const p of pages) {
        if (!/(₹|Rs\.?|INR)\s?\d/.test(p.text)) {
          return fail(cite(p, `No rupee price found in the visible text of ${label(p.kind)}.`, { box: "addToCart" }), { kind: "missing" }, 0.85);
        }
      }
      const structured = pages.some((p) => priceFromJsonLd(p.data) !== null);
      if (!structured) {
        const p = pages[0];
        return fail(cite(p, "The price is shown on screen but is not marked up as structured product data (schema.org Product → Offer → price).", { box: "price" }), { kind: "structured" }, 0.4);
      }
      return pass();
    },
    copy: (d) =>
      d.kind === "missing"
        ? {
            title: "A buyer can't find the price on the product page",
            observed: "We could not find a price in rupees anywhere in the visible text of the product page.",
            likelyEffect: "A first-time buyer who can't see the price before tapping add to cart usually assumes it is high, or leaves to check elsewhere.",
            notYetProven: "The price may appear after choosing a size or variant. We did not select variants.",
          }
        : {
            title: "Search engines and shopping feeds can't read your price",
            observed: "The price is shown on screen, but it isn't included in the page's structured product data.",
            likelyEffect: "Google Shopping and search results may not show your price, so buyers comparing options see competitors' prices first.",
            notYetProven: "We did not check your Google Merchant Center feed, which may supply the price separately.",
          },
  },
  {
    id: "PRIC-02",
    lens: "PRIC",
    name: "Shipping cost stated before checkout",
    severity: 4,
    money: true,
    group: "shipping-cost",
    run: (ctx) => {
      if (!hasProduct(ctx) && !has(ctx, "CART")) return unseen("No product or cart page captured");
      const kinds = [...PRE_CHECKOUT];
      const stated = findIn(ctx, kinds, /free\s+(shipping|delivery)|(shipping|delivery)\s+(charges?|fees?|costs?)\s*(of|:|is|are)?\s*(₹|rs\.?|free|inr)|(shipping|delivery)\s*:\s*(₹|rs\.?|free)|(₹|rs\.?)\s?\d+ (shipping|delivery) (charges?|fees?)/i);
      if (stated) return pass({ snippet: stated.snippet });
      const deferred = findIn(ctx, ["CART", "PRODUCT_1", "PRODUCT_2"], /(shipping|taxes and shipping|delivery)[^.]{0,30}calculated at checkout/i);
      if (deferred) return fail(cite(deferred.page, deferred.snippet), { deferred: true, page: label(deferred.page.kind) }, 0.9);
      return absent(ctx, kinds, ["CART", "PRODUCT_1"], "a shipping cost or a free-shipping threshold", {}, 0.8);
    },
    copy: (d) => ({
      title: "Buyers only find out the delivery charge at checkout",
      observed: d.deferred
        ? `${capital(String(d.page))} says shipping is "calculated at checkout". No shipping cost or free-shipping threshold appears before that point.`
        : "We found no shipping cost and no free-shipping threshold on the homepage, product pages or cart.",
      likelyEffect: "An unexpected delivery charge at the last step is one of the most common reasons Indian shoppers abandon a cart.",
      notYetProven: "We did not complete checkout, so we can't say what the charge actually is or whether it's free.",
    }),
  },
  {
    id: "PRIC-03",
    lens: "PRIC",
    name: "Tax inclusivity stated",
    severity: 2,
    money: true,
    run: (ctx) => {
      if (!hasProduct(ctx)) return unseen("No product page captured");
      const hit = findIn(ctx, [...PRODUCT_KINDS, "CART"], /inclusive of (all )?taxes|incl\.? (of )?(all )?taxes|inc\.? of all taxes|tax(es)? included|including (all )?taxes|incl\.? gst|inclusive of gst/i);
      if (hit) return pass({ snippet: hit.snippet });
      return absent(ctx, [...PRODUCT_KINDS, "CART"], ["PRODUCT_1"], '"inclusive of all taxes" or similar', {}, 0.75, "price");
    },
    copy: () => ({
      title: "The price doesn't say whether GST is included",
      observed: 'Neither the product page nor the cart says the price is "inclusive of all taxes".',
      likelyEffect: "Indian buyers expect MRP-style pricing to include tax. Without that line, some will hesitate and wonder if GST is added later.",
      notYetProven: "Tax may be shown correctly at checkout. We stopped before payment.",
    }),
  },
  {
    id: "PRIC-04",
    lens: "PRIC",
    name: "Product price matches cart price",
    severity: 4,
    money: true,
    run: (ctx) => {
      const product = ctx.signals.productPrices[0]?.amount;
      if (!ctx.signals.addToCart.succeeded || !has(ctx, "CART")) return unseen("Item was not added to the cart");
      if (product == null || !ctx.signals.cartAmounts.length) return unseen("Could not read both prices");
      const match = ctx.signals.cartAmounts.some((a) => Math.abs(a - product) <= 1);
      if (match) return pass({ product });
      const cart = ctx.pages.CART!;
      const hit = snippetAround(cart.text, /(₹|Rs\.?)\s?[\d,]+/i, 120);
      return fail(cite(cart, hit?.snippet ?? "Cart amounts differ from the product price."), { product, cart: ctx.signals.cartAmounts.slice(0, 4) }, 0.6);
    },
    copy: (d) => ({
      title: "The price changes between the product page and the cart",
      observed: `The product page price was ₹${fmt(d.product)}, but the cart showed ${(d.cart as number[] | undefined)?.map((n) => `₹${fmt(n)}`).join(", ")} for the same single item.`,
      likelyEffect: "When the number changes without explanation, buyers stop trusting every other number on the site.",
      notYetProven: "An automatic discount or a different default variant could explain the gap. We added one unit of the first available variant.",
    }),
  },

  // ───────────── DELIVERY ─────────────
  {
    id: "DELV-01",
    lens: "DELV",
    name: "Delivery timeline stated in days",
    severity: 4,
    money: false,
    run: (ctx) => {
      if (!hasProduct(ctx)) return unseen("No product page captured");
      const re = new RegExp(String.raw`(deliver\w*|ship\w*|dispatch\w*|arriv\w*|reach\w*)[^.\n]{0,60}?` + DAYS + "|" + DAYS + String.raw`[^.\n]{0,30}(deliver\w*|ship\w*|dispatch\w*)`, "i");
      const upfront = findIn(ctx, [...PRODUCT_KINDS, "CART", "HOME"], re);
      if (upfront) return pass({ snippet: upfront.snippet });
      const buried = findIn(ctx, ["SHIPPING"], re);
      if (buried) return fail(cite(ctx.pages.PRODUCT_1 ?? buried.page, `Product page and cart: no delivery time. Shipping policy: "${buried.snippet}"`, { box: "addToCart" }), { buried: true }, 0.65);
      return absent(ctx, [...PRODUCT_KINDS, "CART", "HOME", "SHIPPING"], ["PRODUCT_1"], "a delivery time in days", {}, 0.85, "addToCart");
    },
    copy: (d) => ({
      title: "Buyers can't tell when the order will arrive",
      observed: d.buried
        ? "The delivery time appears only inside the shipping policy. The product page and cart don't mention it."
        : "We found no delivery time in days on the product pages, cart, homepage or shipping policy.",
      likelyEffect: '"When will it reach me?" is among the first questions an Indian online buyer asks. With no answer next to the buy button, they hesitate or ask on WhatsApp.',
      notYetProven: "A pincode checker may show an estimate after a pincode is entered. We don't enter pincodes.",
    }),
  },
  {
    id: "DELV-02",
    lens: "DELV",
    name: "Pincode / serviceability check",
    severity: 2,
    money: false,
    run: (ctx) => {
      const pages = pagesOf(ctx, PRODUCT_KINDS);
      if (!pages.length) return unseen("No product page captured");
      const found = pages.some(
        (p) => p.data.inputs.some((i) => /pin\s?code|pincode|zip|postal/i.test(`${i.name} ${i.placeholder}`)) || /check (delivery|pincode|availability)|enter (your )?pin ?code|delivery pincode/i.test(p.text),
      );
      if (found) return pass();
      return absent(ctx, PRODUCT_KINDS, ["PRODUCT_1"], "a pincode or delivery-availability checker", {}, 0.7, "addToCart");
    },
    copy: () => ({
      title: "No way to check if you deliver to the buyer's pincode",
      observed: "The product pages have no pincode field or delivery-availability checker.",
      likelyEffect: "Buyers outside the metros often want to confirm you deliver to them before they invest time in checkout.",
      notYetProven: "Serviceability may be checked at checkout. If you deliver to every pincode in India, this matters less.",
    }),
  },
  {
    id: "DELV-03",
    lens: "DELV",
    name: "Shipping policy page exists",
    severity: 3,
    money: false,
    run: (ctx) => policyPage(ctx.pages.SHIPPING, ctx.pages.HOME, "shipping"),
    copy: (d) => policyCopy("shipping", "delivery times and charges", d),
  },

  // ───────────── RETURNS ─────────────
  {
    id: "RTRN-01",
    lens: "RTRN",
    name: "Returns / refund policy page exists",
    severity: 4,
    money: true,
    run: (ctx) => policyPage(ctx.pages.RETURNS, ctx.pages.HOME, "returns"),
    copy: (d) => policyCopy("returns or refund", "what happens if the product doesn't work out", d),
  },
  {
    id: "RTRN-02",
    lens: "RTRN",
    name: "Return window stated in days",
    severity: 3,
    money: true,
    run: (ctx) => {
      const p = ctx.pages.RETURNS;
      if (!p || (p.httpStatus ?? 200) >= 400) return unseen("No returns policy captured");
      if (NO_RETURNS.test(p.text)) return pass({ noReturns: true });
      const hit = snippetAround(p.text, new RegExp(String.raw`(\d{1,2}|seven|ten|fifteen|thirty)[\s-]*(calendar\s+|working\s+)?days?[^.]{0,80}(return|exchange|replace)|(return|exchange|replace)[^.]{0,80}(\d{1,2}|seven|ten|fifteen|thirty)[\s-]*(calendar\s+|working\s+)?days?`, "i"));
      if (hit) return pass({ snippet: hit.snippet });
      return fail(cite(p, short(p.text, 300)), {}, 0.8);
    },
    copy: () => ({
      title: "The returns policy doesn't say how many days a buyer has",
      observed: "The returns page exists, but it never states a return or exchange window in days.",
      likelyEffect: 'Without a number ("7 days"), buyers can\'t tell whether a return is realistic, and a hesitant first-time buyer reads that as risk.',
      notYetProven: "The window may be stated elsewhere, for example in an FAQ we did not crawl.",
    }),
  },
  {
    id: "RTRN-03",
    lens: "RTRN",
    name: "Who pays return shipping",
    severity: 2,
    money: true,
    run: (ctx) => {
      const p = ctx.pages.RETURNS;
      if (!p || (p.httpStatus ?? 200) >= 400) return unseen("No returns policy captured");
      if (NO_RETURNS.test(p.text)) return pass({ noReturns: true });
      if (/(return|reverse)\s+(shipping|pick-?\s?up|courier)[^.]{0,100}(free|charge|cost|borne|pay|deduct)|free\s+(return|reverse\s+pick)|(customer|buyer|you)\s+(will\s+)?(have\s+to\s+|need\s+to\s+)?(bear|pay)[^.]{0,60}(return|shipping|courier)|reverse pick-?\s?up/i.test(p.text)) return pass();
      return fail(cite(p, short(p.text, 300)), {}, 0.7);
    },
    copy: () => ({
      title: "It's unclear who pays to send a product back",
      observed: "The returns policy does not say whether return pickup is free or charged to the buyer.",
      likelyEffect: "Buyers often assume the worst (that they will pay to courier it back themselves), which makes the first order feel riskier.",
      notYetProven: "Your support team may explain this when asked. We only read the written policy.",
    }),
  },
  {
    id: "RTRN-04",
    lens: "RTRN",
    name: "Refund timeline stated",
    severity: 2,
    money: true,
    run: (ctx) => {
      const p = ctx.pages.RETURNS;
      if (!p || (p.httpStatus ?? 200) >= 400) return unseen("No returns policy captured");
      if (NO_RETURNS.test(p.text)) return pass({ noReturns: true });
      const hit = snippetAround(p.text, new RegExp(String.raw`refund[^.]{0,120}?` + DAYS + "|" + DAYS + String.raw`[^.]{0,60}refund`, "i"));
      if (hit) return pass({ snippet: hit.snippet });
      return fail(cite(p, short(p.text, 300)), {}, 0.75);
    },
    copy: () => ({
      title: "The policy doesn't say how long a refund takes",
      observed: "The returns policy mentions refunds but gives no timeline in days.",
      likelyEffect: "Especially for prepaid orders, buyers want to know when their money comes back. Silence pushes them toward cash on delivery, or away.",
      notYetProven: "Refunds may in practice be fast. This is about what the buyer can read before ordering.",
    }),
  },

  // ───────────── TRUST ─────────────
  {
    id: "TRST-01",
    lens: "TRST",
    name: "Contact method reachable from homepage",
    severity: 4,
    money: false,
    run: (ctx) => {
      const home = ctx.pages.HOME;
      if (!home) return unseen("No homepage");
      const link = home.data.links.some((l) => /^(mailto:|tel:)|wa\.me|api\.whatsapp|\/contact/i.test(l.href) || /contact|whatsapp|call us|support/i.test(l.text));
      const inText = /[\w.+-]+@[\w-]+\.[\w.]+|(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/.test(home.text);
      if (link || inText) return pass();
      return fail(cite(home, "No contact link, email address, phone number or WhatsApp link found on the homepage.", { box: "footer" }), {}, 0.8);
    },
    copy: () => ({
      title: "A buyer can't find a way to reach you from the homepage",
      observed: "The homepage has no contact page link, email, phone number or WhatsApp link.",
      likelyEffect: "For a brand they haven't bought from, many Indian buyers check that a real person is reachable before paying online.",
      notYetProven: "A chat widget that loads late, or one hidden from automated browsers, would not have been visible to us.",
    }),
  },
  {
    id: "TRST-02",
    lens: "TRST",
    name: "Legal entity or registered address",
    severity: 3,
    money: false,
    run: (ctx) => {
      const kinds = ["HOME", "CONTACT", "ABOUT", "TERMS", "PRIVACY", "SHIPPING", "RETURNS"] as const;
      const entity = findIn(ctx, [...kinds], /\b(private limited|pvt\.?\s?ltd\.?|llp|opc|limited liability|proprietor(ship)?)\b/i);
      const address = findIn(ctx, [...kinds], /\b(road|rd\.|nagar|sector|floor|street|marg|lane|phase|colony|plot|industrial area)\b[^\n]{0,80}\b[1-9]\d{5}\b/i);
      if (entity || address) return pass({ snippet: (entity ?? address)!.snippet });
      return absent(ctx, [...kinds], ["CONTACT", "HOME"], "a registered company name or postal address", {}, 0.7, "footer");
    },
    copy: () => ({
      title: "There's no company name or address behind the store",
      observed: "We found no registered business name (Pvt Ltd, LLP and so on) and no postal address on the homepage, contact, about or policy pages.",
      likelyEffect: "A named company and an address are basic proof that a real business stands behind the product, which matters most on a first purchase.",
      notYetProven: "The details may be on a page we did not reach, or printed on the invoice.",
    }),
  },
  {
    id: "TRST-03",
    lens: "TRST",
    name: "HTTPS without mixed content",
    severity: 3,
    money: false,
    run: (ctx) => {
      const home = ctx.pages.HOME;
      if (!home) return unseen("No homepage");
      if (!ctx.signals.https || !(home.finalUrl || home.url).startsWith("https://")) {
        return fail(cite(home, `The store loaded over ${home.finalUrl || home.url} (not HTTPS).`), { kind: "nohttps" }, 0.95);
      }
      for (const p of Object.values(ctx.pages)) {
        if (p?.data.mixedContent?.length) return fail(cite(p, `Insecure resources loaded on a secure page: ${p.data.mixedContent.slice(0, 3).join(", ")}`), { kind: "mixed", page: label(p.kind) }, 0.85);
      }
      return pass();
    },
    copy: (d) =>
      d.kind === "nohttps"
        ? {
            title: "The store isn't served over a secure connection",
            observed: "The store loads without HTTPS, so browsers mark it as \"Not secure\".",
            likelyEffect: "Many buyers will not type a phone number or address into a page their browser calls insecure.",
            notYetProven: "Checkout may run on a separate secure domain.",
          }
        : {
            title: "Some page content loads insecurely",
            observed: `${capital(String(d.page))} loads some files over plain HTTP inside a secure page.`,
            likelyEffect: "Browsers can block these files or drop the padlock, which can break images or scripts and undermine trust.",
            notYetProven: "The affected files may be invisible tracking pixels with no effect on what the buyer sees.",
          },
  },
  {
    id: "TRST-04",
    lens: "TRST",
    name: "Reviews on product page",
    severity: 3,
    money: false,
    run: (ctx) => {
      const pages = pagesOf(ctx, PRODUCT_KINDS);
      if (!pages.length) return unseen("No product page captured");
      for (const p of pages) {
        const ld = (p.data.jsonLd as Record<string, unknown>[]).some((x) => x && typeof x === "object" && ("aggregateRating" in x || "review" in x));
        if (ld || p.data.boxes?.reviews || /\d+\s*(reviews?|ratings?)|customer reviews|write a review|★/i.test(p.text)) return pass();
      }
      return absent(ctx, PRODUCT_KINDS, ["PRODUCT_1"], "ratings, reviews or a review widget", {}, 0.7, "addToCart");
    },
    copy: () => ({
      title: "Product pages show no reviews or ratings",
      observed: "We found no star rating, review count or review section on the product pages we visited.",
      likelyEffect: "Reviews are often the deciding signal for an unfamiliar brand. With none showing, buyers fall back on Amazon or Instagram comments to judge you.",
      notYetProven: "A review widget may load late or only after scrolling. Newer products may genuinely have no reviews yet.",
    }),
  },
  {
    id: "TRST-05",
    lens: "TRST",
    name: "Policy pages free of placeholder text",
    severity: 5,
    money: false,
    run: (ctx) => {
      const kinds = ["SHIPPING", "RETURNS", "TERMS", "PRIVACY", "CONTACT", "ABOUT"] as const;
      const present = pagesOf(ctx, [...kinds]);
      if (!present.length) return unseen("No policy pages captured");
      const hit = findIn(
        ctx,
        [...kinds, "HOME"],
        /lorem ipsum|\[(insert|your|company|store|business|address|email|phone|date|name)[^\]]{0,40}\]|\{\{\s*\w+|your (store|company|business|shop) name|\bINSERT (YOUR|COMPANY|ADDRESS)\b|\bexample\.com\b|\(?xxx\)?[-\s]xxx|placeholder text|enter your (address|email|phone) here|add your (address|content) here/i,
        80,
      );
      if (hit) return fail(cite(hit.page, hit.snippet), { page: label(hit.page.kind), match: hit.match }, 0.95);
      return pass();
    },
    copy: (d) => ({
      title: "A policy page still has unedited template text",
      observed: `${capital(String(d.page))} contains template placeholder text ("${short(d.match, 60)}") that was never replaced with your details.`,
      likelyEffect: "Careful buyers read policies before paying a new brand. Template text tells them nobody has looked at this page, and they wonder what else is unchecked.",
      notYetProven: "Nothing more. The text is on the live page as quoted.",
    }),
  },
  {
    id: "TRST-06",
    lens: "TRST",
    name: "Footer social links point to real profiles",
    severity: 2,
    money: false,
    run: (ctx) => {
      const home = ctx.pages.HOME;
      if (!home) return unseen("No homepage");
      const social = home.data.links.filter((l) => /instagram\.com|facebook\.com|twitter\.com|x\.com|youtube\.com|linkedin\.com|pinterest\.com/i.test(l.href));
      if (!social.length) return unseen("No social links in the page");
      const bad = social.find((l) => {
        try {
          const u = new URL(l.href);
          const path = u.pathname.replace(/\/$/, "");
          return path === "" || /^\/(shopify|wix|woocommerce|wordpress|yourpage|username|your-?handle)$/i.test(path);
        } catch {
          return true;
        }
      });
      if (bad) return fail(cite(home, `Social link "${bad.text || "icon"}" points to ${bad.href}`, { box: "footer" }), { href: bad.href }, 0.85);
      return pass();
    },
    copy: (d) => ({
      title: "A social icon leads to a platform homepage, not your profile",
      observed: `A social link on your site points to ${d.href}, which is the platform itself (or a theme default) rather than your brand's page.`,
      likelyEffect: "Buyers tap social icons to check that a brand is real and active. A dead end there feels like a red flag.",
      notYetProven: "Nothing more. The link target is as quoted.",
    }),
  },

  // ───────────── LEGAL METROLOGY (India, packaged goods) ─────────────
  lgl("LGL-01", "Net quantity declared", /net\s*(qty|quantity|wt|weight|content|vol(ume)?)|\b\d+(\.\d+)?\s?(g|gm|gms|grams?|kg|ml|l|ltr|litres?|liters?|oz|pcs|pieces|units?)\b/i, "net quantity (weight, volume or count)", {
    title: "Product pages don't state the net quantity",
    observed: "We found no net quantity (grams, ml, pieces and so on) on the product pages.",
    likelyEffect: "Buyers comparing value need the quantity, and India's Legal Metrology rules for goods sold online expect it to be displayed.",
    notYetProven: "Some product categories have specific exemptions. Quantity may be shown inside an image we cannot read.",
  }),
  lgl("LGL-02", "Country of origin stated", /country of origin|made in india|made in [A-Z][a-z]+|origin\s*:\s*\w+|manufactured in/i, "the country of origin", {
    title: "Product pages don't state the country of origin",
    observed: "We found no country of origin on the product pages.",
    likelyEffect: '"Made in India" increasingly matters to buyers, and the rules for e-commerce listings ask for country of origin.',
    notYetProven: "The information may be in an image or a tab we did not open.",
  }),
  lgl("LGL-03", "Manufacturer / packer / importer details", /(manufactured|marketed|packed|imported|mfd\.?|mkt\.?|mfg\.?)\s*(&\s*\w+\s*)?by/i, '"manufactured by", "marketed by" or "packed by" details', {
    title: "Product pages don't name the manufacturer or marketer",
    observed: 'We found no "manufactured by", "marketed by" or "packed by" name and address on the product pages.',
    likelyEffect: "For consumables and personal care in particular, buyers look for who actually makes the product, and the listing rules expect it.",
    notYetProven: "It may be printed on the pack and shown only in product images.",
  }),
  {
    id: "LGL-04",
    lens: "LGL",
    name: "Consumer care contact",
    severity: 2,
    money: false,
    run: (ctx) => {
      if (!hasProduct(ctx)) return unseen("No product page captured");
      const hit = findIn(ctx, [...PRODUCT_KINDS, "HOME", "CONTACT"], /(consumer|customer)\s+(care|support|service)|grievance (officer|redressal)/i);
      if (hit) return pass({ snippet: hit.snippet });
      return absent(ctx, [...PRODUCT_KINDS, "HOME", "CONTACT"], ["PRODUCT_1"], "consumer care details", {}, 0.65, "footer");
    },
    copy: () => ({
      title: "No consumer care details where a buyer would look",
      observed: 'We found no "customer care" or "consumer care" details on the product pages, homepage or contact page.',
      likelyEffect: "Buyers want to know where to go if something goes wrong. India's e-commerce rules also expect consumer care and grievance contacts.",
      notYetProven: "A support email may exist under a different label we did not recognise.",
    }),
  },

  // ───────────── AVAILABILITY ─────────────
  {
    id: "AVAIL-01",
    lens: "AVAIL",
    name: "Product in stock or notify-me offered",
    severity: 3,
    money: false,
    run: (ctx) => {
      const pages = pagesOf(ctx, PRODUCT_KINDS);
      if (!pages.length) return unseen("No product page captured");
      for (const p of pages) {
        const top = p.text.slice(0, 2500);
        if (!p.data.boxes?.addToCart && /sold out|out of stock|currently unavailable/i.test(top) && !/notify me|email me when|back in stock|waitlist|wait list/i.test(p.text)) {
          const hit = snippetAround(top, /sold out|out of stock|currently unavailable/i, 80);
          return fail(cite(p, hit?.snippet ?? "Sold out"), { page: label(p.kind) }, 0.7);
        }
      }
      return pass();
    },
    copy: (d) => ({
      title: "A sold-out product offers no way to be told when it's back",
      observed: `${capital(String(d.page))} shows the product as sold out, with no "notify me" or waitlist option.`,
      likelyEffect: "A buyer who wanted that product leaves with nothing, and you lose the chance to bring them back when stock returns.",
      notYetProven: "We picked products from your catalogue feed. Your bestsellers may well be in stock.",
    }),
  },
  {
    id: "AVAIL-02",
    lens: "AVAIL",
    name: "Primary navigation links work",
    severity: 4,
    money: false,
    run: (ctx) => {
      const home = ctx.pages.HOME;
      const links = ctx.signals.navLinkStatuses;
      if (!home || !links.length) return unseen("No navigation links tested");
      const broken = links.find((l) => l.status !== null && l.status >= 400);
      if (broken) return fail(cite(home, `Menu link "${broken.text}" → ${broken.href} returned HTTP ${broken.status}.`, { box: "header" }), { text: broken.text, href: broken.href, status: broken.status }, 0.9);
      return pass({ tested: links.length });
    },
    copy: (d) => ({
      title: "A link in your main menu is broken",
      observed: `The menu link "${short(d.text, 40)}" leads to a page that returns an error (HTTP ${d.status}).`,
      likelyEffect: "Main menu links are how browsing buyers find products. A dead end there sends them back to search, and often to a competitor.",
      notYetProven: "Nothing more. The error was returned when we requested the page.",
    }),
  },
  {
    id: "AVAIL-03",
    lens: "AVAIL",
    name: "No horizontal overflow on mobile",
    severity: 3,
    money: false,
    run: (ctx) => {
      for (const p of pagesOf(ctx, ["HOME", "PRODUCT_1", "CART"])) {
        if (p.data.overflowX > 8) return fail(cite(p, `At 390 px wide, ${label(p.kind)} is ${p.data.overflowX}px wider than the screen and scrolls sideways.`), { page: label(p.kind), px: p.data.overflowX }, 0.8);
      }
      return pass();
    },
    copy: (d) => ({
      title: "On a phone, the page slides sideways",
      observed: `On a 390 px phone screen, ${String(d.page)} is ${d.px}px wider than the screen, so it can be dragged sideways.`,
      likelyEffect: "A page that wobbles under the thumb feels broken on mobile, which is where most Indian D2C traffic arrives.",
      notYetProven: "The effect may vary by phone model. We tested at iPhone-sized width.",
    }),
  },
  {
    id: "AVAIL-04",
    lens: "AVAIL",
    name: "Mobile LCP under 4 s",
    severity: 3,
    money: false,
    run: (ctx) => {
      const measured = pagesOf(ctx, ["HOME", "PRODUCT_1"]).filter((p) => p.data.lcpMs !== null);
      if (!measured.length) return unseen("LCP not measured");
      const slow = measured.find((p) => (p.data.lcpMs ?? 0) > 4000);
      if (slow) return fail(cite(slow, `Largest content on ${label(slow.kind)} took ${(slow.data.lcpMs! / 1000).toFixed(1)} s to appear.`, { box: "hero" }), { page: label(slow.kind), s: (slow.data.lcpMs! / 1000).toFixed(1) }, 0.5);
      return pass();
    },
    copy: (d) => ({
      title: "The main content is slow to appear on mobile",
      observed: `On a phone-sized browser, the largest piece of content on ${String(d.page)} took about ${d.s} seconds to appear.`,
      likelyEffect: "Visitors from Instagram ads are impatient. Every extra second before the product shows up loses some of them.",
      notYetProven: "This is one measurement from our servers, not your real visitors' networks. Use Google PageSpeed Insights to confirm.",
    }),
  },

  // ───────────── CHECKOUT ─────────────
  {
    id: "CHKT-01",
    lens: "CHKT",
    name: "Add to cart succeeds",
    severity: 5,
    money: true,
    run: (ctx) => {
      const a = ctx.signals.addToCart;
      if (!a.attempted) return unseen("Add to cart not attempted");
      const cart = ctx.pages.CART;
      const p = ctx.pages.PRODUCT_1;
      if (!p) return unseen("No product page");
      if (a.method === "button" && cart && /(your )?(cart|bag|basket) is (currently )?empty/i.test(cart.text)) {
        return fail(cite(p, 'Tapped "Add to cart", then opened the cart: it said the cart was empty.', { box: "addToCart" }), { how: "button" }, 0.6);
      }
      if (!a.method) return unseen("No add-to-cart control found");
      if (!a.succeeded) return fail(cite(p, "Adding the first available variant to the cart did not succeed.", { box: "addToCart" }), { how: a.method }, 0.55);
      return pass();
    },
    copy: () => ({
      title: 'Tapping "Add to cart" didn\'t put the product in the cart',
      observed: "We added the product to the cart and then opened the cart. It was empty.",
      likelyEffect: "If this happens to real buyers, it is the most expensive problem on the site: the purchase stops at the first step.",
      notYetProven: "The product may need a size or variant chosen first, or a script may behave differently in automated browsers. Please try it yourself on a phone.",
    }),
  },
  {
    id: "CHKT-02",
    lens: "CHKT",
    name: "Cart total includes shipping before login",
    severity: 3,
    money: true,
    group: "shipping-cost",
    run: (ctx) => {
      const cart = ctx.pages.CART;
      if (!cart || !ctx.signals.addToCart.succeeded) return unseen("Cart with item not captured");
      if (/(shipping|delivery)[^.\n]{0,40}(₹|rs\.?|free)|free (shipping|delivery)/i.test(cart.text)) return pass();
      const deferred = snippetAround(cart.text, /(shipping|delivery)[^.]{0,30}calculated at checkout/i);
      return fail(cite(cart, deferred?.snippet ?? "The cart shows a subtotal but no shipping line."), {}, deferred ? 0.85 : 0.7);
    },
    copy: () => ({
      title: "The cart total leaves out delivery",
      observed: "The cart shows a subtotal but doesn't show the delivery charge, or a free-delivery line, before the buyer moves to checkout.",
      likelyEffect: "The cart is where buyers decide whether the total is worth it. A missing line here becomes a surprise later.",
      notYetProven: "Delivery may genuinely be free and simply not labelled.",
    }),
  },
  {
    id: "CHKT-03",
    lens: "CHKT",
    name: "Guest checkout without an account",
    severity: 4,
    money: false,
    run: (ctx) => {
      const r = ctx.signals.checkoutRequiresLogin;
      if (r === null || !ctx.pages.CHECKOUT) return unseen("Checkout entry not observed");
      if (r) return fail(cite(ctx.pages.CHECKOUT, `Checkout redirected to ${ctx.pages.CHECKOUT.finalUrl} before showing any contact or address form.`), {}, 0.8);
      return pass();
    },
    copy: () => ({
      title: "Buyers must create an account before they can pay",
      observed: "Going to checkout redirected us to a login or sign-up page before any address or contact form appeared.",
      likelyEffect: "Forced sign-up is a well-known reason for abandoned first orders, especially when an OTP is involved.",
      notYetProven: "There may be a guest option further down the login page that we did not interact with.",
    }),
  },
  {
    id: "CHKT-04",
    lens: "CHKT",
    name: "Payment methods visible",
    severity: 3,
    money: true,
    run: (ctx) => {
      const hit = findIn(ctx, ["CHECKOUT", "CART", ...PRODUCT_KINDS, "HOME", "SHIPPING", "TERMS"], /\bupi\b|cash on delivery|\bcod\b|credit card|debit card|net ?banking|paytm|gpay|google pay|phonepe|razorpay|wallets?/i);
      if (hit) return pass({ snippet: hit.snippet, cod: /cash on delivery|\bcod\b/i.test(hit.snippet) });
      if (!ctx.pages.CHECKOUT) return unseen("Checkout entry not observed");
      return absent(ctx, ["CHECKOUT", "CART", ...PRODUCT_KINDS, "HOME"], ["CART", "PRODUCT_1"], "payment options (UPI, cards, COD and so on)", {}, 0.6);
    },
    copy: () => ({
      title: "Buyers can't see how they'll be able to pay",
      observed: "We found no mention of UPI, cards, net banking or cash on delivery before or at the first checkout screen.",
      likelyEffect: "Many Indian buyers decide based on COD or UPI availability. If they can't see it early, they have to start checkout just to find out.",
      notYetProven: "Payment options may appear on a later checkout step, which we do not open.",
    }),
  },

  // ───────────── CLARITY ─────────────
  {
    id: "CLAR-01",
    lens: "CLAR",
    name: "Homepage headline says what you sell",
    severity: 2,
    money: false,
    run: (ctx) => {
      const home = ctx.pages.HOME;
      if (!home) return unseen("No homepage");
      const h1 = home.data.h1[0];
      if (!h1) return fail(cite(home, "The homepage has no main heading (h1)."), { kind: "none" }, 0.6);
      const store = (ctx.signals.storeName ?? "").toLowerCase().trim();
      const generic = /^(home|welcome( to .*)?|shop|new arrivals?|sale|best ?sellers?|featured( products)?|collections?)$/i.test(h1) || (!!store && h1.toLowerCase().trim() === store);
      if (generic) return fail(cite(home, `Main heading: "${h1}"`, { box: "h1" }), { kind: "generic", h1 }, 0.6);
      return pass({ h1 });
    },
    copy: (d) => ({
      title: "The homepage headline doesn't say what you sell",
      observed: d.kind === "none" ? "The homepage has no main heading at all." : `The homepage's main heading is "${short(d.h1, 60)}", which doesn't tell a new visitor what the brand sells or for whom.`,
      likelyEffect: "Visitors from ads give a page a few seconds. If the first words don't place the product, many bounce before scrolling.",
      notYetProven: "Your hero image may communicate the product well visually. We read text only for this check.",
    }),
  },
  {
    id: "CLAR-02",
    lens: "CLAR",
    name: "Page titles and descriptions present",
    severity: 1,
    money: false,
    run: (ctx) => {
      const home = ctx.pages.HOME;
      const p = ctx.pages.PRODUCT_1;
      if (!home) return unseen("No homepage");
      if (!home.title?.trim()) return fail(cite(home, "The homepage has no <title>."), { issue: "The homepage has no page title." }, 0.8);
      if (!home.data.metaDescription?.trim()) return fail(cite(home, `Title: "${home.title}". No meta description.`), { issue: "The homepage has no search description." }, 0.7);
      if (p && p.title?.trim() === home.title.trim()) return fail(cite(p, `Product title: "${p.title}", identical to the homepage title.`), { issue: "Product pages reuse the homepage title." }, 0.7);
      return pass();
    },
    copy: (d) => ({
      title: "Search results won't describe your store well",
      observed: String(d.issue),
      likelyEffect: "In Google, buyers see only the title and description. A missing or repeated one makes your result easy to skip.",
      notYetProven: "Google sometimes writes its own description. This mostly matters for search traffic, not ads.",
    }),
  },
  {
    id: "CLAR-03",
    lens: "CLAR",
    name: "Product description over 40 words",
    severity: 2,
    money: false,
    run: (ctx) => {
      const p = ctx.pages.PRODUCT_1;
      if (!p) return unseen("No product page");
      const product = (p.data.jsonLd as Record<string, unknown>[]).find((x) => x && /product/i.test(String(x["@type"] ?? "")));
      const desc = product?.description ? String(product.description).replace(/<[^>]+>/g, " ") : null;
      if (desc === null) return unseen("No structured product description");
      const words = desc.split(/\s+/).filter(Boolean).length;
      if (words > 40) return pass({ words });
      return fail(cite(p, `Product description (${words} words): "${short(desc, 200)}"`, { box: "price" }), { words }, 0.7);
    },
    copy: (d) => ({
      title: "The product description is too thin to answer questions",
      observed: `The main product's description is ${d.words} words long.`,
      likelyEffect: "Short descriptions leave buyers to guess about fit, use, ingredients or care, and guessing is where they hesitate.",
      notYetProven: "Detail may live in images or accordions. We counted the structured description only.",
    }),
  },
  {
    id: "CLAR-04",
    lens: "CLAR",
    name: "Size / specification block present",
    severity: 3,
    money: false,
    run: (ctx) => {
      if (!hasProduct(ctx)) return unseen("No product page captured");
      const hit = findIn(ctx, PRODUCT_KINDS, /size (chart|guide)|dimensions?|specifications?|ingredients|material|fabric|composition|how to use|capacity|\bsize\s*:|fit\s*:|care instructions/i);
      if (hit) return pass({ snippet: hit.snippet });
      return absent(ctx, PRODUCT_KINDS, ["PRODUCT_1"], "a size guide, dimensions, materials, ingredients or specifications", {}, 0.7, "addToCart");
    },
    copy: () => ({
      title: "No size, material or specification details on the product page",
      observed: "We found no size guide, dimensions, materials, ingredients or specification section on the product pages.",
      likelyEffect: "These details are what a buyer checks right before deciding. Without them, they either message you or leave.",
      notYetProven: "The details may be inside images or tabs that did not render as text.",
    }),
  },

  // ───────────── PROMISES ─────────────
  {
    id: "PROM-01",
    lens: "PROM",
    name: "Strong claims without visible proof",
    severity: 3,
    money: false,
    run: (ctx) => {
      const claim = /\b(100\s?%\s?(natural|organic|pure|safe|effective)|clinically (proven|tested)|dermatologically (tested|approved)|certified organic|#\s?1\b|no\.?\s?1 (brand|choice)|number one|chemical[- ]free|toxin[- ]free|guaranteed results?)/i;
      const proof = /certif\w+ (by|from)|lab (report|tested)|test report|study|trial|fssai|usda|ecocert|india organic|npop|iso \d|see (the )?(results|study|report)|source:|\[\d\]/i;
      for (const p of pagesOf(ctx, ["HOME", ...PRODUCT_KINDS])) {
        const hit = snippetAround(p.text, claim, 200);
        if (hit && !proof.test(hit.snippet)) return fail(cite(p, hit.snippet), { claim: hit.match, page: label(p.kind) }, 0.6);
      }
      return pass();
    },
    copy: (d) => ({
      title: "A strong claim appears without proof next to it",
      observed: `${capital(String(d.page))} says "${short(d.claim, 50)}", with no certificate, test or source shown near the claim.`,
      likelyEffect: "Sceptical first-time buyers discount big claims they can't verify. Proof close to the claim turns it from marketing into a reason to buy.",
      notYetProven: "We are not saying the claim is untrue. Proof may exist elsewhere on the site or the pack.",
    }),
  },
  {
    id: "PROM-02",
    lens: "PROM",
    name: "Offer banner with no end condition",
    severity: 2,
    money: true,
    run: (ctx) => {
      const home = ctx.pages.HOME;
      if (!home) return unseen("No homepage");
      const top = home.text.slice(0, 1500);
      const offer = snippetAround(top, /(\d{1,2}\s?% off|flat\s+(₹|rs\.?)?\s?\d+|limited time|hurry|ends soon|today only|last chance|use code\s+\w+|sale is live|mega sale)/i, 120);
      if (!offer) return pass();
      const end = /(till|until|ends?|valid (till|until|up ?to)|expires?|\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|midnight|\d{1,2}:\d{2}|countdown|while stocks? last|\bhrs\b|hours|mins)/i;
      if (end.test(offer.snippet)) return pass();
      return fail(cite(home, offer.snippet, { box: "banner" }), { offer: offer.match }, 0.55);
    },
    copy: (d) => ({
      title: "The headline offer doesn't say when it ends",
      observed: `The top of the homepage promotes "${short(d.offer, 50)}" without an end date or condition.`,
      likelyEffect: "Open-ended urgency reads as permanent, so it stops creating urgency and can make the 'sale' price feel like the real price.",
      notYetProven: "The terms may be shown at checkout or in a separate offers page.",
    }),
  },
  {
    id: "PROM-03",
    lens: "PROM",
    name: "Hero call-to-action works",
    severity: 4,
    money: false,
    run: (ctx) => {
      const cta = ctx.signals.heroCta;
      const home = ctx.pages.HOME;
      if (!cta || !home) return unseen("No hero call-to-action found");
      if (cta.status !== null && cta.status >= 400) return fail(cite(home, `"${cta.text}" → ${cta.href} returned HTTP ${cta.status}`, { box: "hero" }), { text: cta.text, status: cta.status }, 0.9);
      return pass();
    },
    copy: (d) => ({
      title: "The main homepage button leads to an error",
      observed: `The homepage's "${short(d.text, 30)}" button leads to a page that returns an error (HTTP ${d.status}).`,
      likelyEffect: "This is usually the single most-tapped button on the site. A broken target here loses visitors at the very first step.",
      notYetProven: "Nothing more. The error was returned when we requested the page.",
    }),
  },

  // ───────────── RELIABILITY (state integrity) ─────────────
  {
    id: "STAT-01",
    lens: "STAT",
    name: "Cart persists across reload",
    severity: 3,
    money: false,
    run: (ctx) => {
      const r = ctx.signals.cartPersistsAfterReload;
      if (r === null || !ctx.pages.CART) return unseen("Cart persistence not tested");
      if (!r) return fail(cite(ctx.pages.CART, "After reloading the cart page, the cart was empty."), {}, 0.7);
      return pass();
    },
    copy: () => ({
      title: "The cart empties itself when the page reloads",
      observed: "We added an item, opened the cart, reloaded the page, and the cart was empty.",
      likelyEffect: "Mobile buyers switch apps (to check UPI, a message, a price) and come back. A cart that forgets them forces a restart many won't bother with.",
      notYetProven: "Some carts are tied to cookies that automated browsers handle differently. Please confirm on a phone.",
    }),
  },
  {
    id: "STAT-02",
    lens: "STAT",
    name: "Currency consistent across pages",
    severity: 3,
    money: true,
    run: (ctx) => {
      const pages = pagesOf(ctx, ["HOME", ...PRODUCT_KINDS, "CART"]);
      if (!pages.length) return unseen("No pages");
      const rupee = pages.find((p) => /(₹|Rs\.?|INR)\s?\d/.test(p.text));
      const foreign = pages.map((p) => ({ p, hit: snippetAround(p.text, /(US\$|\$|€|£|USD|EUR|GBP)\s?\d/, 60) })).find((x) => x.hit);
      if (rupee && foreign?.hit) return fail(cite(foreign.p, foreign.hit.snippet), { page: label(foreign.p.kind) }, 0.6);
      return pass();
    },
    copy: (d) => ({
      title: "Prices switch between rupees and another currency",
      observed: `Most prices are in rupees, but ${String(d.page)} shows a price in a foreign currency.`,
      likelyEffect: "Mixed currencies make buyers doubt which price they'll pay, and whether the store is meant for India at all.",
      notYetProven: "Geo-pricing apps can show other currencies to visitors outside India. Our crawler's location may have triggered it.",
    }),
  },
];

function lgl(id: string, name: string, re: RegExp, what: string, copy: ReturnType<CheckDef["copy"]>): CheckDef {
  return {
    id,
    lens: "LGL",
    name,
    severity: 2,
    money: false,
    run: (ctx) => {
      if (!hasProduct(ctx)) return unseen("No product page captured");
      const hit = findIn(ctx, PRODUCT_KINDS, re);
      if (hit) return pass({ snippet: hit.snippet });
      return absent(ctx, PRODUCT_KINDS, ["PRODUCT_1"], what, {}, 0.7, "price");
    },
    copy: () => copy,
  };
}

function policyPage(page: StoredPage | undefined, home: StoredPage | undefined, what: string) {
  if (!home) return unseen("No homepage");
  if (!page) {
    return fail(cite(home, `No link to a ${what} policy found in the homepage menu or footer.`, { box: "footer" }), { kind: "missing" }, 0.8);
  }
  if ((page.httpStatus ?? 200) >= 400) return fail(cite(page, `${page.url} returned HTTP ${page.httpStatus}.`), { kind: "broken", status: page.httpStatus }, 0.9);
  if (page.text.trim().split(/\s+/).length < 40) return fail(cite(page, `The page has only ${page.text.trim().split(/\s+/).length} words: "${short(page.text, 200)}"`), { kind: "empty" }, 0.8);
  return pass();
}

function policyCopy(name: string, purpose: string, d: Record<string, unknown>) {
  const observed =
    d.kind === "broken"
      ? `The ${name} policy link leads to an error page (HTTP ${d.status}).`
      : d.kind === "empty"
        ? `The ${name} policy page exists but is nearly empty.`
        : `We couldn't find a ${name} policy linked from the homepage menu or footer.`;
  return {
    title: `Buyers can't read your ${name} policy`,
    observed,
    likelyEffect: `Before a first order, careful buyers look for ${purpose}. When the page is missing or broken, they assume the answer is unfavourable.`,
    notYetProven: "The policy may be published under a different name or only shared after purchase.",
  };
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmt(n: unknown) {
  return Number(n).toLocaleString("en-IN");
}

export const CHECKS_BY_ID = Object.fromEntries(CHECKS.map((c) => [c.id, c]));
