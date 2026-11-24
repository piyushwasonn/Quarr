import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { DISMISS_POPUPS_SCRIPT, EXTRACT_SCRIPT, LCP_INIT_SCRIPT } from "./extract";
import { isEmptyCart, priceFromJsonLd, rupeeAmounts } from "./parse";
import type { CapturedPage, CrawlResult, CrawlSignals, PageData, PageKind } from "./types";

// Walk a store the way a first-time buyer would: home → two products → cart →
// the first screen of checkout → policies. Never pay, log in, enter an OTP or
// submit a form beyond add-to-cart.

const MOBILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1 QUARRBot/0.1 (+https://quarr.in/crawler)",
  locale: "en-IN",
  timezoneId: "Asia/Kolkata",
};

const DESKTOP = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 QUARRBot/0.1 (+https://quarr.in/crawler)",
  locale: "en-IN",
  timezoneId: "Asia/Kolkata",
};

const MAX_SHOT_HEIGHT = { mobile: 7000, desktop: 5000 };
const DESKTOP_KINDS: PageKind[] = ["HOME", "PRODUCT_1", "CART"];

const POLICY_PATTERNS: [PageKind, RegExp][] = [
  ["SHIPPING", /shipping|delivery/i],
  ["RETURNS", /return|refund|exchange|cancell?ation/i],
  ["TERMS", /terms/i],
  ["PRIVACY", /privacy/i],
  ["CONTACT", /contact/i],
  ["ABOUT", /about|our story/i],
];

// Usual addresses for each page, tried only when the homepage links to none.
const COMMON_POLICY_PATHS: Partial<Record<PageKind, string[]>> = {
  SHIPPING: ["/shipping", "/shipping-policy", "/delivery", "/delivery-policy", "/pages/shipping-policy", "/pages/shipping", "/policies/shipping-policy"],
  RETURNS: ["/returns", "/return-policy", "/returns-policy", "/refund-policy", "/refunds", "/pages/return-policy", "/pages/refund-policy", "/policies/refund-policy"],
  TERMS: ["/terms", "/terms-of-service", "/terms-and-conditions", "/pages/terms-and-conditions", "/policies/terms-of-service"],
  PRIVACY: ["/privacy", "/privacy-policy", "/pages/privacy-policy", "/policies/privacy-policy"],
  CONTACT: ["/contact", "/contact-us", "/pages/contact", "/pages/contact-us"],
  ABOUT: ["/about", "/about-us", "/pages/about", "/pages/about-us", "/our-story"],
};

async function firstReachable(page: Page, origin: string, paths: string[]) {
  for (const path of paths.slice(0, 8)) {
    try {
      const res = await page.request.get(origin + path, { timeout: 8_000, maxRedirects: 3 });
      const type = res.headers()["content-type"] ?? "";
      if (res.ok() && type.includes("html") && new URL(res.url()).origin === origin) return res.url();
    } catch {
      // try the next address
    }
  }
  return null;
}

const SHOPIFY_POLICY_PATHS: Partial<Record<PageKind, string>> = {
  SHIPPING: "/policies/shipping-policy",
  RETURNS: "/policies/refund-policy",
  TERMS: "/policies/terms-of-service",
  PRIVACY: "/policies/privacy-policy",
  CONTACT: "/pages/contact",
};

export type CrawlOptions = {
  timeoutMs?: number;
  allowPrivateHosts?: boolean;
  // "preview": homepage, one product, shipping and returns policies, menu links. Phone only, no cart.
  mode?: "full" | "preview";
  onProgress?: (step: string) => void;
};

export async function crawlStore(startUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const timeoutMs = opts.timeoutMs ?? Number(process.env.CRAWL_TIMEOUT_MS || 240_000);
  let browser: Browser | null = null;
  const deadline = Date.now() + timeoutMs;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--disable-dev-shm-usage"],
      // Optional: route the browser through a proxy, e.g. one in India so stores show
      // Indian prices and serviceability (or a sandbox egress proxy when debugging).
      ...(process.env.CRAWL_PROXY ? { proxy: { server: process.env.CRAWL_PROXY } } : {}),
    });
    const work = walk(browser, startUrl, deadline, opts.allowPrivateHosts ?? process.env.ALLOW_LOCAL_TARGETS === "1", opts.mode ?? "full", opts.onProgress ?? (() => {}));
    const timer = new Promise<CrawlResult>((resolve) =>
      setTimeout(() => resolve({ ok: false, code: "TIMEOUT", detail: `Crawl exceeded ${timeoutMs} ms` }), timeoutMs + 5000),
    );
    return await Promise.race([work, timer]);
  } catch (err) {
    return { ok: false, code: "ERROR", detail: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function walk(browser: Browser, startUrl: string, deadline: number, allowPrivate: boolean, mode: "full" | "preview", progress: (step: string) => void): Promise<CrawlResult> {
  const preview = mode === "preview";
  const mobile = await browser.newContext(MOBILE);
  const desktop = await browser.newContext(DESKTOP);
  for (const ctx of [mobile, desktop]) {
    await ctx.addInitScript(LCP_INIT_SCRIPT);
    if (!allowPrivate) await guardPrivateHosts(ctx);
  }
  const page = await mobile.newPage();
  const desk = preview ? null : await desktop.newPage();
  const pages: CapturedPage[] = [];
  let origin = new URL(startUrl).origin;
  const timeLeft = () => deadline - Date.now();

  // 1. Homepage
  progress("Opening your homepage on a phone");
  const home = await capture(page, desk, "HOME", startUrl);
  if (!home) return { ok: false, code: "UNREACHABLE", detail: `Could not load ${startUrl}` };
  pages.push(home);

  const blocked = detectBlock(home);
  if (blocked) return { ok: false, ...blocked, pages };
  // Follow where the homepage actually landed (www ↔ apex, http → https), so the
  // site's own links count as "this site".
  try {
    origin = new URL(home.finalUrl).origin;
  } catch {
    // keep the start origin
  }

  const extra = (home.data.extra ?? {}) as Record<string, unknown>;
  let platform: CrawlSignals["platform"] = extra.isShopify ? "shopify" : extra.isWoo ? "woocommerce" : "unknown";

  // 2. Product discovery
  progress("Finding your products");
  type Candidate = { url: string; variantId?: number; price?: number | null; confirmed: boolean };
  let candidates: Candidate[] = [];
  const shopifyProducts = await fetchShopifyProducts(page, origin);
  if (shopifyProducts.length) {
    platform = "shopify";
    candidates = shopifyProducts.map((p) => ({ ...p, confirmed: true }));
  } else {
    const byPattern = discoverProductLinks(home, origin);
    candidates = byPattern.length
      ? byPattern.map((url) => ({ url, confirmed: true }))
      : // Custom-built sites: try likely links, keep only pages that look like products.
        guessProductLinks(home, origin).map((url) => ({ url, confirmed: false }));
  }

  const need = preview ? 1 : 2;
  const kept: Candidate[] = [];
  const productPrices: CrawlSignals["productPrices"] = [];
  for (const c of candidates.slice(0, need + 4)) {
    if (kept.length >= need || timeLeft() < 30_000) break;
    const kind = (kept.length === 0 ? "PRODUCT_1" : "PRODUCT_2") as PageKind;
    progress(kept.length === 0 ? "Reading a product page like a first-time buyer" : "Reading a second product page");
    const cap = await capture(page, desk, kind, c.url);
    if (!cap || (cap.httpStatus ?? 200) >= 400) continue;
    if (!c.confirmed && !looksLikeProduct(cap)) continue;
    pages.push(cap);
    kept.push(c);
    productPrices.push({ kind, amount: c.price ?? priceFromJsonLd(cap.data) });
  }
  const isStore = kept.length > 0;
  const products = kept;

  // 3. Add to cart, cart, reload, checkout entry
  const signals: CrawlSignals = {
    platform,
    storeName: (extra.ogSiteName as string) || (extra.shopName as string) || null,
    addToCart: { attempted: false, succeeded: false, method: null, itemCount: null },
    cartPersistsAfterReload: null,
    checkoutReached: false,
    checkoutRequiresLogin: null,
    isStore,
    navLinkStatuses: [],
    heroCta: null,
    productPrices,
    cartAmounts: [],
    https: startUrl.startsWith("https://"),
  };

  if (!preview && isStore && timeLeft() > 40_000) {
    progress("Adding one item to the cart");
    await addToCart(page, origin, platform, products[0], signals);
    const cartUrl = platform === "woocommerce" ? `${origin}/cart/` : `${origin}/cart`;
    const cart = await capture(page, desk, "CART", cartUrl);
    if (cart) {
      pages.push(cart);
      signals.cartAmounts = rupeeAmounts(cart.text);
      if (signals.addToCart.succeeded) {
        signals.cartPersistsAfterReload = await cartPersists(page, platform, cart);
      }
      if (signals.addToCart.succeeded && timeLeft() > 30_000) {
        progress("Opening the first screen of checkout (we stop there)");
        const checkoutUrl = platform === "woocommerce" ? `${origin}/checkout/` : `${origin}/checkout`;
        const checkout = await capture(page, null, "CHECKOUT", checkoutUrl);
        if (checkout && (checkout.httpStatus ?? 500) < 400) {
          pages.push(checkout);
          signals.checkoutReached = true;
          const loginWall = /\/account\/login|\/my-account|\/login/i.test(checkout.finalUrl);
          const hasContactField = checkout.data.inputs.some((i) => /email|phone|mobile|contact/i.test(`${i.name} ${i.placeholder} ${i.type}`));
          signals.checkoutRequiresLogin = loginWall ? true : hasContactField ? false : null;
        }
      }
    }
  }

  // 4. Policy and info pages
  progress("Reading your shipping, returns and contact pages");
  const policyLinks = discoverPolicyLinks(home, origin);
  for (const [kind] of POLICY_PATTERNS) {
    if (preview && kind !== "SHIPPING" && kind !== "RETURNS") continue;
    if (timeLeft() < 15_000) break;
    const linked = policyLinks[kind];
    if (linked) {
      // A linked page is recorded even if it errors: a broken policy link is a real finding.
      const cap = await capture(page, null, kind, linked);
      if (cap) pages.push(cap);
      continue;
    }
    // No link found: quietly try the usual addresses before anyone concludes it's missing.
    const tries = [...(platform === "shopify" && SHOPIFY_POLICY_PATHS[kind] ? [SHOPIFY_POLICY_PATHS[kind]!] : []), ...(COMMON_POLICY_PATHS[kind] ?? [])];
    const found = await firstReachable(page, origin, tries);
    if (!found) continue;
    const cap = await capture(page, null, kind, found);
    // Many sites answer any address with a normal page, so it must read like this policy.
    const re = POLICY_PATTERNS.find(([k]) => k === kind)![1];
    if (cap && (cap.httpStatus ?? 200) < 400 && re.test(`${cap.title} ${cap.data.h1.join(" ")} ${cap.text.slice(0, 1500)}`)) pages.push(cap);
  }

  // 5. Primary navigation health
  progress("Checking that your menu links open");
  signals.navLinkStatuses = await checkNavLinks(page, home, origin);
  signals.heroCta = await checkHeroCta(page, home);

  return { ok: true, pages, signals };
}

async function guardPrivateHosts(ctx: BrowserContext) {
  await ctx.route("**/*", (route) => {
    try {
      const host = new URL(route.request().url()).hostname;
      if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith(".internal")) {
        return route.abort();
      }
    } catch {
      return route.abort();
    }
    return route.continue();
  });
}

const FIRST_SCREEN_KINDS: PageKind[] = ["HOME", "PRODUCT_1", "PRODUCT_2", "CART"];

async function capture(page: Page, desk: Page | null, kind: PageKind, url: string): Promise<CapturedPage | null> {
  const mixed: string[] = [];
  const onRequest = (req: { url: () => string }) => {
    const u = req.url();
    if (u.startsWith("http://")) mixed.push(u);
  };
  page.on("request", onRequest);
  try {
    let status: number | null = null;
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      status = resp?.status() ?? null;
    } catch {
      return null;
    }
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.evaluate(DISMISS_POPUPS_SCRIPT).catch(() => 0);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);

    const extracted = (await page.evaluate(EXTRACT_SCRIPT)) as { title: string; text: string; data: PageData };
    const finalUrl = page.url();
    if (finalUrl.startsWith("https://")) extracted.data.mixedContent = mixed.slice(0, 20);

    // What a buyer sees before scrolling, for the AI reader. Not stored.
    const firstScreen = FIRST_SCREEN_KINDS.includes(kind) ? await page.screenshot({ type: "jpeg", quality: 60 }).catch(() => undefined) : undefined;
    const mobileShot = await screenshot(page, MAX_SHOT_HEIGHT.mobile);
    let desktopShot: Buffer | undefined;
    let desktopHeight: number | undefined;
    if (desk && DESKTOP_KINDS.includes(kind)) {
      try {
        await desk.goto(finalUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await desk.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
        await desk.evaluate(DISMISS_POPUPS_SCRIPT).catch(() => 0);
        await desk.keyboard.press("Escape").catch(() => {});
        await desk.waitForTimeout(300);
        const shot = await screenshot(desk, MAX_SHOT_HEIGHT.desktop);
        desktopShot = shot.buffer;
        desktopHeight = shot.height;
      } catch {
        // Desktop evidence is a bonus; mobile is the primary record.
      }
    }

    return {
      kind,
      url,
      finalUrl,
      httpStatus: status,
      title: extracted.title,
      text: extracted.text,
      data: extracted.data,
      mobileShot: mobileShot.buffer,
      mobileHeight: mobileShot.height,
      firstScreen,
      desktopShot,
      desktopHeight,
    };
  } finally {
    page.off("request", onRequest);
  }
}

async function screenshot(page: Page, maxHeight: number) {
  const vp = page.viewportSize() ?? { width: 390, height: 844 };
  const full = await page.evaluate("document.documentElement.scrollHeight").catch(() => vp.height);
  const height = Math.min(Number(full) || vp.height, maxHeight);
  const buffer = await page.screenshot({
    type: "jpeg",
    quality: 70,
    fullPage: true,
    clip: { x: 0, y: 0, width: vp.width, height },
  });
  return { buffer, height };
}

function detectBlock(home: CapturedPage): { code: "BLOCKED" | "PASSWORD"; detail: string } | null {
  const t = home.text.slice(0, 4000);
  if (/\/password\b/.test(home.finalUrl) || /enter (store )?using password|this store is password protected/i.test(t)) {
    return { code: "PASSWORD", detail: "The store is behind a password page." };
  }
  if (
    (home.httpStatus && [403, 429, 503].includes(home.httpStatus)) ||
    /just a moment|attention required|verify you are human|cf-chl|access denied|captcha/i.test(`${home.title} ${t}`)
  ) {
    return { code: "BLOCKED", detail: `Bot protection responded (HTTP ${home.httpStatus ?? "?"}).` };
  }
  return null;
}

async function fetchShopifyProducts(page: Page, origin: string) {
  try {
    const res = await page.request.get(`${origin}/products.json?limit=12`, { timeout: 15_000 });
    if (!res.ok()) return [];
    const body = (await res.json()) as {
      products?: { handle: string; variants?: { id: number; available?: boolean; price?: string }[] }[];
    };
    return (body.products ?? [])
      .map((p) => {
        const v = p.variants?.find((x) => x.available !== false) ?? p.variants?.[0];
        return {
          url: `${origin}/products/${p.handle}`,
          variantId: v?.id,
          price: v?.price ? Number(v.price) : null,
          available: p.variants?.some((x) => x.available !== false) ?? true,
        };
      })
      .sort((a, b) => Number(b.available) - Number(a.available))
      .slice(0, 2);
  } catch {
    return [];
  }
}

const NOT_PRODUCT = /^\/(?:$|about|our-story|story|contact|privacy|terms|shipping|delivery|returns?|refunds?|cancell?ation|policies|policy|cart|bag|basket|checkout|account|login|log-in|signin|sign-in|register|signup|sign-up|blogs?|notes|stories|journal|news|press|faq|help|support|track|tracking|care|careers|jobs|collabs?|collaborations?|wishlist|search|me|collections?|category|categories|pages\/(?:about|contact|faq))(?:\/|$|\.)/i;

// Same-site links that might be product pages on a custom-built store, most promising
// first: links repeated on the page (product cards) and links in the page body.
function guessProductLinks(home: CapturedPage, origin: string) {
  const score = new Map<string, number>();
  for (const l of home.data.links) {
    if (!l.href.startsWith(origin) || l.area === "footer") continue;
    const u = new URL(l.href);
    if (u.search || NOT_PRODUCT.test(u.pathname) || /\.(pdf|jpe?g|png|webp|svg|xml|txt)$/i.test(u.pathname)) continue;
    const key = u.pathname.replace(/\/$/, "");
    if (!key) continue;
    score.set(key, (score.get(key) ?? 0) + (l.area === "body" ? 2 : 1));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([path]) => `${origin}${path}`);
}

// Does a captured page look like a product page? Structured product data, an
// add-to-cart control, or a rupee price next to a buying action.
export function looksLikeProduct(cap: CapturedPage) {
  const ld = (cap.data.jsonLd as Record<string, unknown>[]).some((x) => x && /product/i.test(String(x["@type"] ?? "")));
  if (ld || priceFromJsonLd(cap.data) !== null || cap.data.boxes?.addToCart) return true;
  const buy = /add to (cart|bag|basket)|buy now|pre-?order|notify me|select (a )?size|choose (a )?size/i;
  return /(₹|rs\.?|inr)\s?\d/i.test(cap.text) && (buy.test(cap.text) || cap.data.buttons.some((b) => buy.test(b)));
}

function discoverProductLinks(home: CapturedPage, origin: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of home.data.links) {
    if (!l.href.startsWith(origin)) continue;
    const path = new URL(l.href).pathname;
    if (!/\/(products?|p|item|shop)\/[^/]+/i.test(path)) continue;
    if (/\/(collections?|category|categories)\/?$/i.test(path)) continue;
    const key = path.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`${origin}${path}`);
    if (out.length >= 2) break;
  }
  return out;
}

function discoverPolicyLinks(home: CapturedPage, origin: string) {
  const found: Partial<Record<PageKind, string>> = {};
  const candidates = [...home.data.links].sort((a, b) => Number(b.area === "footer") - Number(a.area === "footer"));
  for (const [kind, re] of POLICY_PATTERNS) {
    const hit = candidates.find((l) => {
      if (!l.href.startsWith(origin)) return false;
      const path = new URL(l.href).pathname;
      return re.test(l.text) || re.test(path);
    });
    if (hit) found[kind] = hit.href.split("#")[0];
  }
  // A "Returns" match on the shipping page or vice versa is common; keep them distinct.
  if (found.SHIPPING && found.SHIPPING === found.RETURNS) delete found.RETURNS;
  return found;
}

async function addToCart(
  page: Page,
  origin: string,
  platform: CrawlSignals["platform"],
  product: { url: string; variantId?: number },
  signals: CrawlSignals,
) {
  signals.addToCart.attempted = true;
  try {
    if (platform === "shopify" && product.variantId) {
      const count = (await page.evaluate(`(async () => {
        const r = await fetch(${JSON.stringify(origin + "/cart/add.js")}, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ id: ${Number(product.variantId)}, quantity: 1 }] }),
        });
        if (!r.ok) return -1;
        const c = await (await fetch(${JSON.stringify(origin + "/cart.js")})).json();
        return c.item_count;
      })()`)) as number;
      signals.addToCart.method = "shopify-ajax";
      signals.addToCart.itemCount = count >= 0 ? count : null;
      signals.addToCart.succeeded = count > 0;
      return;
    }
    if (page.url() !== product.url) await page.goto(product.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const btn = page.getByRole("button", { name: /add to (cart|bag|basket)/i }).first();
    if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await btn.click({ timeout: 5_000 });
      await page.waitForTimeout(2_500);
      signals.addToCart.method = "button";
      signals.addToCart.succeeded = true; // confirmed below by the cart page contents
    }
  } catch {
    signals.addToCart.succeeded = false;
  }
}

async function cartPersists(page: Page, platform: CrawlSignals["platform"], cart: CapturedPage) {
  try {
    if (platform === "shopify") {
      await page.reload({ waitUntil: "domcontentloaded" });
      const count = (await page.evaluate(`(async () => (await (await fetch("/cart.js")).json()).item_count)()`)) as number;
      return count > 0;
    }
    if (isEmptyCart(cart.text)) return null;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const text = (await page.evaluate("document.body.innerText")) as string;
    return !isEmptyCart(text);
  } catch {
    return null;
  }
}

async function checkNavLinks(page: Page, home: CapturedPage, origin: string) {
  const seen = new Set<string>();
  const targets = home.data.links
    .filter((l) => l.area === "header" && l.href.startsWith(origin) && !l.href.includes("#"))
    .filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)))
    .slice(0, 12);
  const out: CrawlSignals["navLinkStatuses"] = [];
  for (const l of targets) {
    try {
      const res = await page.request.get(l.href, { timeout: 10_000, maxRedirects: 5 });
      out.push({ href: l.href, text: l.text, status: res.status() });
    } catch {
      out.push({ href: l.href, text: l.text, status: null });
    }
  }
  return out;
}

const CTA_TEXT = /^(shop( now| all| the .*)?|buy now|order now|explore.*|discover.*|view (all|collection|products)|get yours|try (it )?now)$/i;

async function checkHeroCta(page: Page, home: CapturedPage) {
  const cta = home.data.links.find((l) => l.area === "body" && CTA_TEXT.test(l.text) && /^https?:/.test(l.href));
  if (!cta) return null;
  try {
    const res = await page.request.get(cta.href, { timeout: 10_000, maxRedirects: 5 });
    return { href: cta.href, text: cta.text, status: res.status() };
  } catch {
    return { href: cta.href, text: cta.text, status: null };
  }
}
