import http from "node:http";

// Two Shopify-like fixture stores for end-to-end tests of the crawler and checks.
//  - "Kesar & Co" (good): does nearly everything right.
//  - "Glow Basics" (flawed): carries a known set of planted problems.

type Store = { name: string; good: boolean };

// Lets a test "fix" the flawed store mid-run (POST /__fix) to exercise re-checks.
let flawedFixed = false;

const products = (good: boolean) => [
  { handle: "saffron-face-oil", title: "Saffron Face Oil", price: good ? "899.00" : "649.00", id: 101, available: true },
  { handle: "rose-water-mist", title: "Rose Water Mist", price: "399.00", id: 102, available: good },
];

function layout(store: Store, title: string, body: string, opts: { meta?: string; wide?: boolean } = {}) {
  const s = store.good;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>${opts.meta ? `<meta name="description" content="${opts.meta}">` : ""}
<meta property="og:site_name" content="${store.name}">
<style>
 body{margin:0;font-family:Arial,sans-serif;color:#222;background:#fff}
 header,footer{padding:14px 18px;background:${s ? "#f3efe8" : "#ffe9f2"}} nav a{margin-right:12px;color:#333}
 main{padding:18px} .price{font-size:22px;font-weight:bold} del{color:#888}
 .announcement{background:#222;color:#fff;padding:8px 18px;font-size:13px}
 .hero{background:#eadfce;padding:40px 18px} button{background:#222;color:#fff;border:0;padding:12px 18px;border-radius:6px}
 ${opts.wide ? ".wide{width:640px;background:#fde}" : ""}
</style>
<script>window.Shopify={shop:"${store.name.toLowerCase().replace(/[^a-z]/g, "")}.myshopify.com"};</script>
</head><body>
<div class="announcement">${s ? "Free delivery on orders above ₹499 · Festive offer 15% off ends 31 Oct" : "MEGA SALE — 40% off everything! Hurry!"}</div>
<header><strong>${store.name}</strong><nav><a href="/">Home</a><a href="/collections/all">Shop</a><a href="/pages/about">About</a>${s ? "" : '<a href="/collections/gifting">Gifting</a>'}<a href="/cart">Cart</a></nav></header>
<main>${body}</main>
<footer>
 <a href="/policies/shipping-policy">Shipping</a> · <a href="/policies/refund-policy">Returns &amp; Refunds</a> · <a href="/policies/terms-of-service">Terms</a> · <a href="/policies/privacy-policy">Privacy</a>${s ? ' · <a href="/pages/contact">Contact us</a>' : ""}
 <p>${s ? '<a href="https://instagram.com/kesarandco">Instagram</a> · <a href="https://facebook.com/kesarandco">Facebook</a>' : '<a href="https://instagram.com/">Instagram</a>'}</p>
 ${s ? "<p>Kesar &amp; Co Private Limited, 4th Floor, 12 MG Road, Bengaluru 560001 · Customer care: care@kesarandco.in · +91 98450 12345</p>" : ""}
</footer>
</body></html>`;
}

function home(store: Store) {
  const s = store.good;
  return layout(
    store,
    s ? "Kesar & Co — Saffron skincare made in India" : "Glow Basics",
    `<section class="hero"><h1>${s ? "Saffron skincare for dry, dull Indian skin" : "Welcome"}</h1>
     <p>${s ? "Small-batch oils and mists, made in Jaipur." : "100% natural glow for everyone. The #1 choice of thousands."}</p>
     <a href="${s ? "/collections/all" : "/collections/bestsellers"}">Shop now</a></section>
     <h2>Bestsellers</h2>
     <ul>${products(s).map((p) => `<li><a href="/products/${p.handle}">${p.title}</a> ₹${Number(p.price)}</li>`).join("")}</ul>`,
    { meta: s ? "Saffron face oils and mists for dry skin. Free delivery above ₹499." : undefined },
  );
}

function product(store: Store, handle: string) {
  const s = store.good;
  const p = products(s).find((x) => x.handle === handle);
  if (!p) return null;
  const desc = s
    ? "A lightweight face oil blended with Kashmiri saffron, kumkumadi and cold-pressed almond oil. Made for dry and dull skin, it absorbs in under a minute and leaves no greasy film. Use two drops at night on clean, damp skin. Suitable for all skin types; patch test first if you have sensitive skin."
    : "Glow oil for glowing skin.";
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: desc,
    offers: s ? { "@type": "Offer", price: p.price, priceCurrency: "INR" } : undefined,
    ...(s ? { aggregateRating: { "@type": "AggregateRating", ratingValue: "4.6", reviewCount: "214" } } : {}),
  };
  return layout(
    store,
    s ? `${p.title} | Kesar & Co` : "Glow Basics",
    `<script type="application/ld+json">${JSON.stringify(ld)}</script>
     <h1>${p.title}</h1>
     <p class="price">₹${Number(p.price).toLocaleString("en-IN")} ${s ? "<del>₹1,099</del> <small>Inclusive of all taxes</small>" : ""}</p>
     ${p.available ? `<button id="add">Add to cart</button>` : `<p><strong>Sold out</strong></p>`}
     ${s ? '<p><label>Check delivery <input name="pincode" placeholder="Enter pincode"></label></p><p>Delivered in 3-5 business days. UPI, cards and Cash on Delivery available.</p>' : "<p>Shipping calculated at checkout.</p>"}
     <div class="description"><p>${desc}</p></div>
     ${s ? "<h3>Specifications</h3><p>Net quantity: 30 ml · Country of origin: India · Manufactured by Kesar & Co Private Limited, Jaipur 302001 · Ingredients: saffron, almond oil</p><div class=\"reviews\"><h3>Customer reviews</h3><p>★★★★★ 214 reviews</p></div>" : ""}
     ${s ? "" : '<div class="wide">Recently viewed</div>'}
     <script>document.getElementById('add')&&document.getElementById('add').addEventListener('click',()=>fetch('/cart/add.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{id:${p.id},quantity:1}]})}));</script>`,
    { meta: s ? `${p.title}: ${desc.slice(0, 120)}` : undefined, wide: !s },
  );
}

const policies: Record<string, (s: boolean) => string> = {
  "shipping-policy": (s) =>
    s
      ? "We dispatch every order within 24 hours. Orders are delivered in 3-5 business days across India. Delivery is free on orders above ₹499; below that a flat ₹49 delivery charge applies. We ship to over 19,000 pincodes through Delhivery and Blue Dart. You will receive a tracking link on WhatsApp and email as soon as your order ships."
      : "We ship all over India. Shipping charges are calculated at checkout. Orders usually ship quickly. Please contact us for any shipping questions about your order and we will try to help you as soon as possible.",
  "refund-policy": (s) =>
    s
      ? "You can return any unopened product within 7 days of delivery. Reverse pickup is free. Once we receive the product, your refund is processed within 5-7 business days to the original payment method, or to your bank account for Cash on Delivery orders. Opened products can be exchanged if they arrived damaged; share a photo within 48 hours of delivery."
      : flawedFixed
        ? "You can return any unused product within 7 days of delivery. Reverse pickup is free. Refunds are processed within 5-7 business days of the product reaching us, to your original payment method or bank account."
        : "[INSERT COMPANY NAME] accepts returns of eligible items. To be eligible for a return, your item must be unused and in the same condition that you received it. Refunds will be processed after inspection. Please contact us at [your email] to start a return.",
  "terms-of-service": (s) =>
    `These terms govern your use of ${s ? "Kesar & Co Private Limited" : "this store"}. By placing an order you agree to these terms. Prices are listed in Indian rupees. We may update these terms from time to time and will post the updated version on this page. Disputes are subject to the courts of the place of registration of the company. Product images are for illustration and may differ slightly from the product delivered due to lighting and screen settings.`,
  "privacy-policy": () =>
    "We collect your name, phone number, email and address to deliver your order. We use payment partners to process payments and never store card details. We may send you order updates on WhatsApp and email. You can ask us to delete your data at any time by writing to us. We do not sell your personal data to anyone, and we only share it with delivery partners to fulfil your order.",
};

function makeServer(store: Store) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const cookies = Object.fromEntries((req.headers.cookie ?? "").split(";").map((c) => c.trim().split("=")).filter((x) => x[0]));
    let count = Number(cookies.cart ?? 0);
    const html = (body: string | null, status = 200) => {
      res.writeHead(body ? status : 404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body ?? "<h1>404 Page not found</h1>");
    };
    const json = (obj: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(200, { "Content-Type": "application/json", ...headers });
      res.end(JSON.stringify(obj));
    };
    const p = url.pathname;

    if (p === "/__fix" && req.method === "POST") {
      flawedFixed = true;
      return json({ fixed: true });
    }
    if (p === "/collections/gifting" && flawedFixed) return html(layout(store, "Gifting", "<h1>Gifting</h1><p>Gift sets for every occasion.</p>"));
    if (p === "/") return html(home(store));
    if (p === "/products.json") return json({ products: products(store.good).map((x) => ({ handle: x.handle, variants: [{ id: x.id, available: x.available, price: x.price }] })) });
    if (p.startsWith("/products/")) return html(product(store, p.split("/")[2]));
    if (p === "/collections/all") return html(layout(store, "All products", `<h1>All products</h1>${products(store.good).map((x) => `<a href="/products/${x.handle}">${x.title}</a>`).join(" ")}`));
    if (p === "/pages/about") return html(layout(store, "About", `<h1>About us</h1><p>${store.good ? "We started Kesar & Co in Jaipur in 2021 to make saffron skincare that works in Indian weather." : "We love glowing skin."}</p>`));
    if (p === "/pages/contact") return store.good ? html(layout(store, "Contact", "<h1>Contact</h1><p>Write to care@kesarandco.in or WhatsApp +91 98450 12345, 10am–7pm, Monday to Saturday.</p>")) : html(null);
    if (p.startsWith("/policies/")) {
      const fn = policies[p.split("/")[2]];
      return fn ? html(layout(store, "Policy", `<h1>Policy</h1><p>${fn(store.good)}</p>`)) : html(null);
    }
    if (p === "/cart/add.js" && req.method === "POST") {
      count += 1;
      return json({ ok: true }, { "Set-Cookie": `cart=${count}; Path=/` });
    }
    if (p === "/cart.js") return json({ item_count: count });
    if (p === "/cart") {
      if (!count) return html(layout(store, "Cart", "<h1>Your cart</h1><p>Your cart is empty.</p>"));
      const price = store.good ? 899 : 699; // the flawed store's cart disagrees with its product page
      return html(
        layout(
          store,
          "Cart",
          `<h1>Your cart</h1><p>Saffron Face Oil × 1 — ₹${price}</p>${store.good ? "<p>Delivery: ₹49 (free above ₹499)</p><p>Total ₹899 · Inclusive of all taxes</p>" : "<p>Subtotal ₹699</p><p>Taxes and shipping calculated at checkout</p>"}<a href="/checkout">Checkout</a>`,
        ),
      );
    }
    if (p === "/checkout") {
      if (!store.good) {
        res.writeHead(302, { Location: "/account/login" });
        return res.end();
      }
      return html(layout(store, "Checkout", '<h1>Checkout</h1><label>Email or mobile phone number <input name="email" type="email"></label><p>Pay with UPI, cards, net banking or Cash on Delivery.</p>'));
    }
    if (p === "/account/login") return html(layout(store, "Login", '<h1>Login</h1><label>Mobile number <input name="customer[phone]" placeholder="Mobile number"></label><button>Send OTP</button>'));
    return html(null);
  });
}

export function startFixtures(goodPort = 4102, flawedPort = 4101) {
  const good = makeServer({ name: "Kesar & Co", good: true }).listen(goodPort);
  const flawed = makeServer({ name: "Glow Basics", good: false }).listen(flawedPort);
  return { close: () => Promise.all([new Promise((r) => good.close(r)), new Promise((r) => flawed.close(r))]) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startFixtures();
  console.log("Fixtures: good store http://127.0.0.1:4102  flawed store http://127.0.0.1:4101");
}
