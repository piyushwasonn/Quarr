import type { CheckDef, FindingCopy } from "../types";
import { unseen } from "./helpers";

// Checks answered by QUARR's AI reader (engine/ai/judge.ts) rather than by a rule.
// They exist because some buyer questions need reading, not pattern matching: do two
// pages contradict each other, does a claim have support, is the first step low-risk.
//
// Guardrails (CLAUDE.md, Notion 04):
//  - A FAIL needs verbatim quotes that QUARR finds on the captured pages: two for a
//    contradiction (both sides), one otherwise. No quote, no finding.
//  - The AI never concludes something is missing. Absence is "unknown", and becomes a
//    question for the founder.
//  - Like every check, these are reviewed by a person until they earn AUTO on the Bench.

type Q = { page: string; text: string };
const PAGE: Record<string, string> = {
  HOME: "homepage",
  PRODUCT_1: "product page",
  PRODUCT_2: "second product page",
  CART: "cart",
  SHIPPING: "shipping policy",
  RETURNS: "returns policy",
  TERMS: "terms",
  CONTACT: "contact page",
  ABOUT: "about page",
};
const where = (q: Q) => PAGE[q.page] ?? "site";
const said = (qs: Q[]) => qs.slice(0, 2).map((q) => `the ${where(q)} says "${q.text.slice(0, 120)}"`).join(", while ");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The AI writes the copy; this is the fallback when its copy can't be used.
function aiCopy(fallback: (qs: Q[]) => FindingCopy) {
  return (d: Record<string, unknown>): FindingCopy => {
    const copy = d.copy as FindingCopy | undefined;
    if (copy?.title && copy.observed && copy.likelyEffect && copy.notYetProven) return copy;
    return fallback((d.quotes as Q[] | undefined) ?? []);
  };
}

const byAi = () => unseen("Answered by QUARR's AI reader");

export const AI_CHECKS: CheckDef[] = [
  {
    id: "AI-COST-01",
    lens: "PRIC",
    name: "Pages agree on delivery and COD charges",
    severity: 4,
    money: true,
    ai: {
      question: "Do the captured pages agree on what delivery costs, any free-delivery threshold, and any cash-on-delivery fee?",
      failWhen: "Two statements on the captured pages give different amounts, thresholds or conditions for the same charge (for example a different free-delivery threshold on the product page and the shipping policy). Quote both statements.",
      passWhen: "The pages state these charges and do not contradict each other. Quote one statement.",
      failQuotes: 2,
      pages: ["HOME", "PRODUCT_1", "PRODUCT_2", "CART", "SHIPPING", "TERMS"],
    },
    run: byAi,
    copy: aiCopy((qs) => ({
      title: "Your pages disagree about delivery charges",
      observed: qs.length ? `${cap(said(qs))}.` : "Two of your pages state delivery charges differently.",
      likelyEffect: "When two pages give different charges, buyers trust the less favourable one, or stop to ask before ordering.",
      notYetProven: "One of the statements may be out of date. We did not complete checkout to see which one applies.",
    })),
  },
  {
    id: "AI-PROM-01",
    lens: "DELV",
    name: "Pages agree on how long delivery takes",
    severity: 3,
    money: false,
    ai: {
      question: "Do the captured pages agree on how long delivery takes?",
      failWhen: "Two statements give different delivery times for the same kind of order and location (for example 3 to 5 days on the product page and 7 to 10 days in the shipping policy). Quote both. Different times for clearly different regions or shipping options are not a contradiction.",
      passWhen: "Delivery times are stated and consistent. Quote one statement.",
      failQuotes: 2,
      pages: ["HOME", "PRODUCT_1", "PRODUCT_2", "CART", "SHIPPING", "TERMS"],
    },
    run: byAi,
    copy: aiCopy((qs) => ({
      title: "Your pages give different delivery times",
      observed: qs.length ? `${cap(said(qs))}.` : "Two of your pages state delivery times differently.",
      likelyEffect: "Buyers who order for a date plan around the longer estimate, and those who believed the shorter one are disappointed when it arrives later.",
      notYetProven: "The difference may depend on location or courier in a way the pages don't explain.",
    })),
  },
  {
    id: "AI-EXIT-01",
    lens: "RTRN",
    name: "The returns promise matches the returns terms",
    severity: 4,
    money: true,
    ai: {
      question: "Does what the store promises about returns, exchanges and refunds match the terms in its policy?",
      failWhen: "One statement promises something about returns, exchanges or refunds (for example 'easy returns' or a number of days) and another statement narrows or contradicts it (a shorter window, returns only for damaged items, an unboxing video required, store credit instead of a refund). Quote the promise and the condition.",
      passWhen: "The promise and the terms are consistent. Quote one statement of the terms.",
      failQuotes: 2,
      pages: ["HOME", "PRODUCT_1", "PRODUCT_2", "CART", "RETURNS", "SHIPPING", "TERMS"],
    },
    run: byAi,
    copy: aiCopy((qs) => ({
      title: "The returns promise and the returns terms don't match",
      observed: qs.length ? `${cap(said(qs))}.` : "Your returns promise and your returns terms say different things.",
      likelyEffect: "A buyer who relied on the promise and then meets the condition feels misled, and that is when refund disputes and bad reviews start.",
      notYetProven: "Your team may apply the more generous version in practice. We only read what the pages say.",
    })),
  },
  {
    id: "AI-COMMIT-01",
    lens: "TRIAL",
    name: "A first order can be small and low-risk",
    severity: 3,
    money: true,
    ai: {
      question: "Can a first-time buyer try this store at low risk: cash on delivery, a single item or small size, an exchange or return if it doesn't suit?",
      failWhen: "A captured page states a barrier that makes a first order a bigger commitment: prepaid only or no cash on delivery, a minimum order value, purchase only by subscription, or no returns or exchanges for any reason. Quote the statement. Do not fail because an option is not mentioned.",
      passWhen: "A captured page states at least one low-risk way in (cash on delivery, single items, trial or mini sizes, exchanges or returns). Quote it.",
      failQuotes: 1,
      pages: ["HOME", "PRODUCT_1", "PRODUCT_2", "CART", "SHIPPING", "RETURNS", "TERMS"],
    },
    run: byAi,
    copy: aiCopy((qs) => ({
      title: "A first order is a bigger commitment than it needs to be",
      observed: qs.length ? `${cap(said(qs))}.` : "Your pages state a condition that raises the stakes of a first order.",
      likelyEffect: "A buyer who doesn't know you yet looks for a small, safe first step. Without one, many wait or buy a brand they already know.",
      notYetProven: "The condition may be essential to how you operate. We are describing how it reads to a new buyer, not whether it is the right policy.",
    })),
  },
  {
    id: "AI-UND-01",
    lens: "CLAR",
    name: "The first screen says what you sell",
    severity: 2,
    money: false,
    group: "headline",
    ai: {
      question: "Looking at the homepage's first phone screen (picture and text), can a new visitor tell what the store sells?",
      failWhen: "The words a visitor reads first (the main headline or hero text) do not name a product, category or use, and the picture does not make it obvious either. Quote the headline or hero text exactly as it appears in the page text.",
      passWhen: "The first screen names or clearly shows what is sold. Quote the words that do it.",
      failQuotes: 1,
      pages: ["HOME"],
    },
    run: byAi,
    copy: aiCopy((qs) => ({
      title: "The first screen doesn't say what you sell",
      observed: qs.length ? `The first words on your homepage are "${qs[0].text.slice(0, 120)}", which don't name a product or category.` : "The first screen of your homepage doesn't name a product or category.",
      likelyEffect: "Visitors from ads give a page a few seconds. If the first screen doesn't place the product, many leave before scrolling.",
      notYetProven: "This is a judgement about one screen. Visitors who already know you may not need it spelled out.",
    })),
  },
  {
    id: "AI-TRUST-01",
    lens: "PROM",
    name: "Strong claims are backed on the same page",
    severity: 3,
    money: false,
    group: "claims",
    ai: {
      question: "Does each strong claim a sceptical buyer would want proof for (natural, organic, clinically tested, handmade, chemical-free, best-selling, premium quality and similar) have supporting detail on the same page?",
      failWhen: "A homepage or product page makes such a claim and the same page shows no supporting detail for it: no certificate, test, ingredient or material list, process, or source. Quote the claim.",
      passWhen: "Claims on these pages come with supporting detail, or there are no strong claims. Quote a claim and its support if there is one.",
      failQuotes: 1,
      pages: ["HOME", "PRODUCT_1", "PRODUCT_2"],
    },
    run: byAi,
    copy: aiCopy((qs) => ({
      title: "A strong claim has nothing beside it to back it up",
      observed: qs.length ? `The ${where(qs[0])} says "${qs[0].text.slice(0, 120)}", with no certificate, test, ingredient list or process shown on that page.` : "A strong claim appears with no supporting detail on the same page.",
      likelyEffect: "Sceptical first-time buyers discount claims they can't check. Showing how it is true turns the claim into a reason to buy.",
      notYetProven: "We are not saying the claim is untrue. Proof may exist elsewhere on the site or on the pack.",
    })),
  },
];
