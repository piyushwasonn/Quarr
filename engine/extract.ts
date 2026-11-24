// Scripts evaluated inside the crawled page. Kept as plain strings so the
// TypeScript toolchain never injects helpers the browser does not have.

export const LCP_INIT_SCRIPT = `
(() => {
  try {
    window.__quarrLcp = null;
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__quarrLcp = Math.round(last.renderTime || last.loadTime || last.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {}
})();
`;

// Close newsletter / cookie / discount pop-ups so screenshots show the store,
// clicking only close controls that sit inside a dialog-like container.
export const DISMISS_POPUPS_SCRIPT = `
(() => {
  const containers = document.querySelectorAll('[role="dialog"], [aria-modal="true"], .modal, .popup, [class*="popup"], [class*="Popup"], [class*="newsletter"], [id*="popup"], .klaviyo-form, [class*="needsclick"]');
  let closed = 0;
  containers.forEach((c) => {
    const r = c.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return;
    const btn = c.querySelector('[aria-label*="close" i], [aria-label*="dismiss" i], button[class*="close" i], .close, [data-dismiss], [class*="Close"]');
    if (btn && btn instanceof HTMLElement) { btn.click(); closed++; }
  });
  return closed;
})();
`;

export const EXTRACT_SCRIPT = `
(() => {
  const vis = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const box = (el) => {
    if (!el || !vis(el)) return undefined;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const firstVisible = (sel) => Array.from(document.querySelectorAll(sel)).find(vis);
  const area = (el) => {
    if (el.closest('header, [role="banner"], nav, .header, #header, .site-header')) return "header";
    if (el.closest('footer, [role="contentinfo"], .footer, #footer, .site-footer')) return "footer";
    return "body";
  };
  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim();

  const text = document.body ? document.body.innerText : "";
  // Text inside collapsed sections (accordions, closed <details>, tabs) that a buyer can
  // open with one tap. Read from the DOM without clicking anything.
  let hiddenText = "";
  if (document.body) {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script, style, noscript, template, svg, iframe").forEach((n) => n.remove());
    hiddenText = (clone.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 30000);
  }
  const h1 = Array.from(document.querySelectorAll("h1")).map((e) => clean(e.innerText)).filter(Boolean).slice(0, 5);
  const metaEl = document.querySelector('meta[name="description"]');
  const links = Array.from(document.querySelectorAll("a[href]")).slice(0, 500).map((a) => ({
    href: a.href,
    text: clean(a.innerText || a.getAttribute("aria-label") || a.title).slice(0, 80),
    area: area(a),
  }));
  const jsonLd = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const v = JSON.parse(s.textContent || "null");
      if (Array.isArray(v)) jsonLd.push(...v);
      else if (v && v["@graph"]) jsonLd.push(...v["@graph"]);
      else if (v) jsonLd.push(v);
    } catch (e) {}
  });
  const inputs = Array.from(document.querySelectorAll("input")).filter(vis).slice(0, 60).map((i) => ({
    name: i.name || i.id || "",
    placeholder: i.placeholder || i.getAttribute("aria-label") || "",
    type: i.type || "text",
  }));
  const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"], a.btn, a.button'))
    .filter(vis).slice(0, 80).map((b) => clean(b.innerText || b.value || b.getAttribute("aria-label"))).filter(Boolean);
  const strikePrices = Array.from(document.querySelectorAll('del, s, strike, [class*="compare"], [class*="was-price"], [class*="mrp" i]'))
    .filter(vis).map((e) => clean(e.innerText)).filter((t) => /\\d/.test(t)).slice(0, 10);
  const imgs = Array.from(document.images);
  const addToCart = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'))
    .find((b) => vis(b) && /add to (cart|bag|basket)|buy now/i.test(b.innerText || b.value || ""));
  const priceEl = firstVisible('[class*="price" i]:not(del):not(s), [itemprop="price"], [data-price]');
  const pincode = Array.from(document.querySelectorAll("input")).find((i) => vis(i) && /pin\\s?code|pincode|zip|postal/i.test((i.name || "") + " " + (i.placeholder || "") + " " + (i.id || "") + " " + (i.getAttribute("aria-label") || "")));
  const reviews = firstVisible('[class*="review" i], [id*="review" i], .jdgm-widget, .yotpo, .stamped-main-badge, .loox-rating, [class*="rating" i]');
  const hero = firstVisible("main section, main img, .hero, [class*='hero' i], [class*='slideshow' i], [class*='banner' i] img");
  const banner = firstVisible("[class*='announcement' i], [class*='marquee' i], [id*='announcement' i], .top-bar, [class*='topbar' i]");
  const footer = document.querySelector("footer");
  const header = document.querySelector("header, [role='banner'], .site-header, #header");

  return {
    title: document.title || "",
    text: text.slice(0, 80000),
    data: {
      h1,
      hiddenText,
      metaDescription: metaEl ? metaEl.getAttribute("content") : null,
      links,
      jsonLd: jsonLd.slice(0, 20),
      inputs,
      buttons,
      strikePrices,
      images: { total: imgs.length, missingAlt: imgs.filter((i) => !i.hasAttribute("alt")).length },
      // Mobile browsers widen the layout viewport to fit oversized content, so compare with the device width.
      overflowX: Math.max(0, document.documentElement.scrollWidth - Math.min(window.innerWidth, screen.width || window.innerWidth)),
      lcpMs: window.__quarrLcp ?? null,
      mixedContent: [],
      boxes: {
        h1: box(document.querySelector("h1")),
        price: box(priceEl),
        addToCart: box(addToCart),
        pincode: box(pincode),
        reviews: box(reviews),
        hero: box(hero),
        banner: box(banner),
        footer: box(footer),
        header: box(header),
      },
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      extra: {
        isShopify: !!window.Shopify,
        isWoo: document.body ? document.body.className.includes("woocommerce") : false,
        shopName: (window.Shopify && window.Shopify.shop) || null,
        ogSiteName: (document.querySelector('meta[property="og:site_name"]') || {}).content || null,
      },
    },
  };
})();
`;
