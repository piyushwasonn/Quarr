// "What to do" for every check: one plain next step for the founder (QIM 5: every finding
// leads to action). Written per check and per variant, never by AI, so the advice is the same
// for every store and is reviewed like any other copy. A Shopify hint is added only where the
// admin path is known; other platforms get the general step.
//
// Rules: founder as the subject, plain words, no em dashes, and no numbers (a step must never
// state a fact about the store that the evidence doesn't hold).

type Step = { step: string; shopify?: string };
type Fix = (d: Record<string, unknown>) => Step;

const policy = (what: "shipping" | "returns"): Fix => (d) => {
  const shopifyPolicies = "Settings → Policies has a place to write it; then link it in your footer menu under Online Store → Navigation.";
  if (d.kind === "broken") return { step: `Fix the link to your ${what} policy: it leads to an error page. Point it to the live policy page.`, shopify: "Online Store → Navigation → footer menu: update the link." };
  if (d.kind === "empty") return { step: `Write your ${what} policy in full: what happens, how long it takes and who pays, so a buyer can decide before ordering.`, shopify: shopifyPolicies };
  return { step: `Publish a ${what} policy page and link it in your footer, where buyers look for it before paying.`, shopify: shopifyPolicies };
};

const productDetail = (what: string): Fix => () => ({
  step: `State the ${what} on each product page, near the description.`,
  shopify: "add it to the product description, or as a product field shown on the product page through Online Store → Themes → Customize.",
});

const proofNextToClaim: Fix = () => ({ step: "Put the proof right next to the claim on the same page: a certificate, a test report, the ingredient or material list, or how it's made." });

export const FIXES: Record<string, Fix> = {
  "PRIC-01": (d) =>
    d.kind === "structured"
      ? { step: "Add the price to your product's structured data (schema.org Product with an Offer price), so Google and shopping feeds can show it. Most themes include it: test a product page with Google's Rich Results Test and ask your developer if it's missing." }
      : { step: "Show the price in rupees next to the product name, above the Add to cart button, so a buyer sees it before choosing a size.", shopify: "Online Store → Themes → Customize → Product page: make sure the Price block is shown above the buy buttons." },
  "PRIC-02": () => ({ step: "State the delivery charge before checkout: write the charge, or the order value above which delivery is free, on the product page or in the cart.", shopify: "your rates are in Settings → Shipping and delivery; add them as a text block under the price in Online Store → Themes → Customize → Product page." }),
  "PRIC-03": () => ({ step: "Write \"Inclusive of all taxes\", or that GST is added at checkout, right under the price on the product page.", shopify: "Settings → Taxes and duties: if your prices include tax, many themes then show \"Tax included\" under the price; if yours doesn't, add it as a text block in the theme editor." }),
  "PRIC-04": () => ({ step: "Make the product page and the cart show the same price for the same item. If a discount or fee changes it, say so on the product page." }),
  "DELV-01": () => ({ step: "Say when the order will arrive, near the Add to cart button: a range of days, and whether it differs for metro cities and the rest of India." }),
  "DELV-02": () => ({ step: "Let buyers check delivery to their pincode on the product page, or say plainly where you deliver.", shopify: "a pincode checker app from the Shopify App Store adds this to the product page." }),
  "DELV-03": policy("shipping"),
  "RTRN-01": policy("returns"),
  "RTRN-02": () => ({ step: "State how many days a buyer has to return or exchange, in your returns policy and near the price on the product page.", shopify: "Settings → Policies → Refund policy." }),
  "RTRN-03": () => ({ step: "Say who pays to send a product back, you or the buyer, and how the return is collected.", shopify: "Settings → Policies → Refund policy." }),
  "RTRN-04": () => ({ step: "Say how long a refund takes after you receive the return, and where the money goes: the original payment method, or a bank account for cash on delivery orders.", shopify: "Settings → Policies → Refund policy." }),
  "TRST-01": () => ({ step: "Put a way to reach you (WhatsApp, phone or email) in your header or footer, so it's on every page.", shopify: "Online Store → Navigation: add your Contact page to the footer menu." }),
  "TRST-02": () => ({ step: "Show your registered business name and address in the footer or on the contact page, so buyers know who they are paying.", shopify: "the details are in Settings → Store details; show them on your contact page and in the footer." }),
  "TRST-03": (d) =>
    d.kind === "mixed"
      ? { step: "Load every image and script over https: find the files that still use http:// and update their links." }
      : { step: "Turn on HTTPS for your domain, so browsers don't warn buyers that the store isn't secure.", shopify: "Settings → Domains: check the SSL status of your domain." },
  "TRST-04": () => ({ step: "Show reviews or ratings on product pages, near the price, even if you only have a few honest ones.", shopify: "add a product reviews app from the Shopify App Store and place its block on the product page." }),
  "TRST-05": () => ({ step: "Replace the placeholder text in your policy pages with your own details, then read each policy once from start to end.", shopify: "Settings → Policies." }),
  "TRST-06": () => ({ step: "Point each social icon to your brand's own profile, not the platform's homepage.", shopify: "Online Store → Themes → Customize → Theme settings → Social media." }),
  "LGL-01": productDetail("net quantity (weight, volume or count)"),
  "LGL-02": productDetail("country of origin"),
  "LGL-03": productDetail("name and address of the manufacturer, packer or marketer"),
  "LGL-04": () => ({ step: "Show consumer care details (a name, email, phone number and address for complaints) on your contact page and in the footer." }),
  "AVAIL-01": () => ({ step: "When a product sells out, offer \"Notify me when it's back\" instead of a dead end.", shopify: "a back-in-stock alert app adds this button to sold-out products." }),
  "AVAIL-02": () => ({ step: "Fix or remove the broken link in your main menu, so it leads to a live page.", shopify: "Online Store → Navigation → Main menu." }),
  "AVAIL-03": () => ({ step: "Find what is wider than a phone screen (often a large image, table or banner) and make it fit; then check the page on your own phone." }),
  "AVAIL-04": () => ({ step: "Make the first screen load faster on phones: compress the large hero image or video, and remove apps or scripts you no longer use." }),
  "CHKT-01": () => ({ step: "Try Add to cart yourself on a phone, on a product with sizes or options, and fix whatever stops the product reaching the cart." }),
  "CHKT-02": () => ({ step: "Show the delivery charge in the cart total, or next to the total, before the buyer reaches checkout." }),
  "CHKT-03": () => ({ step: "Let buyers pay without creating an account, and offer an account after the order instead.", shopify: "Settings → Customer accounts: make sure an account isn't required to check out." }),
  "CHKT-04": () => ({ step: "Show the payment methods you accept (UPI, cards, cash on delivery) on the product page or in the cart, before checkout.", shopify: "Online Store → Themes → Customize: turn on payment icons, or add a text block under the price." }),
  "CLAR-01": (d) =>
    d.kind === "none"
      ? { step: "Add a main headline to your homepage that says what you sell and who it's for, in plain words." }
      : { step: "Replace the homepage headline with one that names what you sell and who it's for, instead of a greeting or your brand name." },
  "CLAR-02": () => ({ step: "Give your homepage and each product page its own title and search description.", shopify: "Online Store → Preferences for the homepage; for products, the Search engine listing section at the bottom of each product." }),
  "CLAR-03": () => ({ step: "Expand the product description to answer what a buyer asks before buying: what it is, what it's made of, how it fits or works, and how to care for it." }),
  "CLAR-04": () => ({ step: "Add size, material or specification details on the product page, such as a size guide or a short specifications list." }),
  "PROM-01": proofNextToClaim,
  "PROM-02": () => ({ step: "Say when the offer ends, or that it runs while stock lasts, in the banner itself." }),
  "PROM-03": () => ({ step: "Point the main homepage button to a live page, usually your best-selling collection.", shopify: "Online Store → Themes → Customize → the hero or banner section: update the button link." }),
  "STAT-01": () => ({ step: "Make the cart keep what a buyer added after the page reloads, and test it on your own phone." }),
  "STAT-02": () => ({ step: "Show prices in rupees on every page. If you also sell abroad, make sure visitors in India still see rupees.", shopify: "Settings → Markets: check that India uses Indian rupees." }),
  // AI-judged checks
  "AI-COST-01": () => ({ step: "Make every page say the same thing about delivery charges: decide which is correct and update the others." }),
  "AI-PROM-01": () => ({ step: "Make every page give the same delivery time, or say plainly why it differs, such as location or shipping option." }),
  "AI-EXIT-01": () => ({ step: "Make your returns promise and your returns policy say the same thing: change the policy or change the promise." }),
  "AI-COMMIT-01": () => ({ step: "Give first-time buyers a low-risk way in, such as cash on delivery, a single item or small size, or an easy exchange. If you can't, explain why on the page." }),
  "AI-UND-01": () => ({ step: "Make the first screen say what you sell: a headline that names the product, readable without scrolling." }),
  "AI-TRUST-01": proofNextToClaim,
};

// The next step for one finding, for this store's platform.
export function whatToDo(checkId: string, detail: unknown, platform?: string | null): string {
  const fix = FIXES[checkId];
  if (!fix) return "";
  const { step, shopify } = fix((detail ?? {}) as Record<string, unknown>);
  return platform === "shopify" && shopify ? `${step} In Shopify: ${shopify}` : step;
}
