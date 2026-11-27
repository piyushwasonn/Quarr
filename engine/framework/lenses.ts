// QUARR's 19 lenses (Notion 01): one list for the engine, the report, the Bench and the site.
// Replaces the earlier ten check areas and ten journey questions (25 Nov 2026). The codes are
// Notion's; the definitions were approved by Piyush on 27 Nov 2026 (ENFC = enforceable rights).
//
// Each lens is a part of the buyer's journey, from finding the store to recommending it.
// A website walk answers some of it; the rest needs a person (a test order, a support
// enquiry) or the founder's own numbers. What QUARR can't see is "Unknown" (QIM 2) and
// becomes a question for the founder instead of a guess.
//
// Check IDs keep their original prefixes (CLAR-02, LGL-01...) because past reviews and
// promotion history are keyed on them; a check's lens is its `lens` field, not its prefix.

import { LENS_IDS, LENS_NAMES, type Lens } from "../types";

export type Stage = "FIND" | "DECIDE" | "BUY" | "AFTER";

export const STAGES: { id: Stage; name: string }[] = [
  { id: "FIND", name: "Finding and understanding" },
  { id: "DECIDE", name: "Deciding to buy" },
  { id: "BUY", name: "Buying" },
  { id: "AFTER", name: "After buying" },
];

// What answering a lens fully takes, beyond a walk of the public website.
//  person: a person has to try it (place a test order, contact support, cancel), which a
//          crawler never does: it never pays, logs in or submits forms.
//  data:   the founder's own numbers (repeat rate, review rate, traffic sources).
export type Need = "person" | "data";

export type LensDef = {
  id: Lens;
  code: Lens;
  name: string;
  stage: Stage;
  definition: string;
  buyerQuestion: string;
  // How much of it a walk through the public website can show.
  site: "yes" | "partly" | "no";
  needs: Need[];
  // Set on lenses that only apply to some stores. Until a check can tell, the report says so
  // rather than calling it a gap.
  appliesWhen?: string;
  // Asked when the website can't show it (QIM 2: Unknown is a valid answer; QIM 6: assumptions are risks).
  founderQuestions: string[];
  // Matches the free-text lens labels in the research corpus.
  aliases: RegExp;
};

const lens = (id: Lens, def: Omit<LensDef, "id" | "code" | "name">): LensDef => ({ id, code: id, name: LENS_NAMES[id], ...def });

// Written in stage order for reading; kept in Notion's order (LENS_IDS) below.
const DEFINED: LensDef[] = [
  lens("DISC", {
    stage: "FIND",
    definition: "How a buyer finds you and where they land: how you appear in search and link previews, and whether the page they arrive on matches what brought them.",
    buyerQuestion: "Did I land where I expected, from where I found you?",
    site: "partly",
    needs: ["person", "data"],
    founderQuestions: [
      "Where do most first-time buyers come from: Instagram, Google, marketplaces or word of mouth?",
      "Does the page your ads link to show the product the ad promised?",
    ],
    aliases: /(?<!customer |founder |opportunity |constraint )discovery|message-to-landing|listing accuracy|search|acquisition/i,
  }),
  lens("CLAR", {
    stage: "FIND",
    definition: "Whether a new visitor can tell, within seconds, what you sell and what each product is.",
    buyerQuestion: "Do I understand what this is?",
    site: "yes",
    needs: [],
    founderQuestions: [
      "When a new visitor lands, what is the one thing you need them to understand in the first five seconds?",
      "Which questions do buyers ask you on WhatsApp or email before their first order?",
    ],
    aliases: /clarity|comprehension|positioning|first-time user|expert-founder|product clarity/i,
  }),
  lens("RELV", {
    stage: "FIND",
    definition: "Whether a buyer can judge that a product suits them: size and fit, who it's for, how it's used, and how it compares with your other products.",
    buyerQuestion: "Is this right for me?",
    site: "partly",
    needs: ["person"],
    founderQuestions: [
      "What do buyers most often get wrong about whether a product suits them: size, skin type, fit or use?",
      "Which products come back most often as \"not what I expected\"?",
    ],
    aliases: /relevan|suitab|personalis|product fit|subscription fit|audience/i,
  }),
  lens("TRST", {
    stage: "DECIDE",
    definition: "Whether the business looks real and safe to pay: who you are, a secure site, other buyers' reviews, and policies written for this store.",
    buyerQuestion: "Can I trust this business with my money?",
    site: "yes",
    needs: [],
    founderQuestions: [
      "What usually convinces a hesitant first-time buyer to go ahead with you?",
      "Where do buyers see proof from other buyers: reviews, photos, ratings elsewhere?",
    ],
    aliases: /trust|review|evidence transparency|verification|safety|merchant identity|asset identity|consent/i,
  }),
  lens("PRIC", {
    stage: "DECIDE",
    definition: "Whether the full cost is clear before paying: price, tax, delivery charge and fees, the same from product page to cart.",
    buyerQuestion: "Do I know the full cost before I commit?",
    site: "yes",
    needs: [],
    founderQuestions: [
      "Is there any charge a buyer first sees at checkout: delivery, COD fee, packaging, tax?",
      "When an offer is running, what exactly happens to the price when it ends or fails to apply?",
    ],
    aliases: /pric|fee|discount|stored value|fare|paid upgrade|charge/i,
  }),
  lens("PROM", {
    stage: "DECIDE",
    definition: "Whether claims and offers hold up: proof next to claims, offers that say when they end, and buttons that go where they say.",
    buyerQuestion: "Will what I was promised turn out to be true?",
    site: "partly",
    needs: ["person"],
    founderQuestions: [
      "Which claims on your site could you prove today if a buyer asked?",
      "When an offer ends, what changes on the site, and who changes it?",
    ],
    aliases: /promise|promotion|promotional|claim|expectation/i,
  }),
  lens("AVAIL", {
    stage: "DECIDE",
    definition: "Whether what the buyer wants is there and works: in stock or a way to be told, working links, and pages that load fast and fit a phone.",
    buyerQuestion: "Can I actually get it, and does the site work?",
    site: "yes",
    needs: [],
    founderQuestions: [
      "How often does a product sell out while ads are still sending people to it?",
      "How fast does your store load on a mid-range phone on mobile data?",
    ],
    aliases: /inventory|stock|availability|hours|reservation|performance|uptime/i,
  }),
  lens("DELV", {
    stage: "DECIDE",
    definition: "Whether the buyer knows when and where it will arrive: a delivery estimate, whether their pincode is served, a shipping policy, and whether that promise is kept.",
    buyerQuestion: "Will I get it when and where I was told?",
    site: "partly",
    needs: ["person", "data"],
    founderQuestions: [
      "How often does an order arrive after the date you showed the buyer?",
      "Are there pincodes your courier says it serves but often fails to deliver to?",
    ],
    aliases: /deliver|last-mile|serviceab|shipping|logistics|fulfil|time-sensitive|node/i,
  }),
  lens("TRIAL", {
    stage: "DECIDE",
    definition: "Whether a first-time buyer can try you with little risk: cash on delivery, a single item or small size, a sample, or an easy exchange.",
    buyerQuestion: "Is the first step small and safe enough to try?",
    site: "partly",
    needs: ["person"],
    founderQuestions: [
      "Can a first-time buyer try you for a small amount, such as a single item, a sample or cash on delivery?",
      "Do first-time buyers usually start with your cheapest product, or with a bundle?",
    ],
    aliases: /trial|sample|moq|willingness[- ]to[- ]pay|commitment|monetisation timing/i,
  }),
  lens("SUBS", {
    stage: "DECIDE",
    definition: "For stores that sell subscriptions or auto-renewing plans: what renews, when, at what price, and how to stop, stated before paying.",
    buyerQuestion: "Do I know what I'm signing up for, and how to stop?",
    site: "partly",
    needs: ["person"],
    appliesWhen: "Only for stores that sell subscriptions or auto-renewing plans.",
    founderQuestions: [
      "If you sell subscriptions, does the buyer see what renews, when and at what price before paying?",
      "How does a subscriber cancel, and how many steps does it take?",
    ],
    aliases: /subscription|renewal|paywall|contract design|entitlement/i,
  }),
  lens("ENFC", {
    stage: "DECIDE",
    definition: "Whether the protections Indian law gives a buyer are in place and visible: product labelling (Legal Metrology), consumer care and grievance contacts, and policies that hold up.",
    buyerQuestion: "Are my rights as a buyer stated and protected?",
    site: "partly",
    needs: ["person"],
    founderQuestions: [
      "Who is your grievance officer, and are their contact details on the site?",
      "Do your product pages carry the same net quantity, origin and manufacturer details as the pack?",
    ],
    aliases: /enforcement|legal|compliance|regulat|grievance|consumer protection/i,
  }),
  lens("CHKT", {
    stage: "BUY",
    definition: "Whether the buyer can finish paying without a fight: add to cart works, no forced sign-up, the payment methods they use, and a payment that completes.",
    buyerQuestion: "Can I finish the purchase without fighting the site?",
    site: "partly",
    needs: ["person"],
    founderQuestions: [
      "Where do buyers most often drop out between adding to cart and paying?",
      "When a payment fails, what does the buyer see, and can they retry safely?",
    ],
    aliases: /checkout|payment|retry|customer effort|signup|core-task|order change/i,
  }),
  lens("STAT", {
    stage: "BUY",
    definition: "Whether what the buyer chose stays right: the cart, size, pincode and currency stay as set, and the order status matches what is really happening.",
    buyerQuestion: "Does the site remember what I chose, and tell me the truth about my order?",
    site: "partly",
    needs: ["person"],
    founderQuestions: [
      "Do buyers ever report a cart, size or pincode changing on its own?",
      "Does the order status a buyer sees match what the courier shows?",
    ],
    aliases: /order-state|state integrity|state-integrity|state ownership|status|payment-state|history integrity|attribution/i,
  }),
  lens("ONBD", {
    stage: "AFTER",
    definition: "What happens right after paying: a clear confirmation, tracking, and help getting started with the product.",
    buyerQuestion: "After I pay, do I know my order is safe and where it is?",
    site: "no",
    needs: ["person"],
    founderQuestions: [
      "Right after payment, what message does the buyer get, and does it say what happens next and how to track it?",
      "When an order is delayed, who tells the buyer first: you, the courier, or nobody?",
    ],
    aliases: /onboarding|activation|empty state|first value|time-to-value|post-purchase|confirmation|notification|tracking|software experience/i,
  }),
  lens("CANC", {
    stage: "AFTER",
    definition: "Whether a buyer can cancel or change an order before it ships: how, until when, and how fast the money comes back.",
    buyerQuestion: "If I change my mind, can I cancel?",
    site: "partly",
    needs: ["person"],
    founderQuestions: [
      "Until when can a buyer cancel an order, and how do they do it?",
      "How long does the refund for a cancelled prepaid order take?",
    ],
    aliases: /cancel/i,
  }),
  lens("RTRN", {
    stage: "AFTER",
    definition: "Whether a buyer can return or exchange it and get their money back: the window, who pays for shipping, how long the refund takes, and whether it really happens.",
    buyerQuestion: "If it's wrong, can I return it and get my money back?",
    site: "partly",
    needs: ["person"],
    founderQuestions: [
      "How many days does a refund actually take, counted from the day you receive the return?",
      "Has a return ever failed because the courier wouldn't collect it from the buyer?",
    ],
    aliases: /return|refund|reverse logistics|custody|replacement|remedy|exit|damage dispute|defect/i,
  }),
  lens("SUPP", {
    stage: "AFTER",
    definition: "Whether a buyer can reach a person and get a problem fixed: visible channels and hours, how fast a reply comes, and whether that person can solve it.",
    buyerQuestion: "If something goes wrong, will they make it right, and quickly?",
    site: "partly",
    needs: ["person", "data"],
    founderQuestions: [
      "When a buyer writes in with a problem, how long until a person replies?",
      "Can whoever answers the buyer issue a refund or replacement without waiting on someone else?",
    ],
    aliases: /recovery|support|escalat|handoff|hand-off|appeal|sla|complaint|exception|investigation/i,
  }),
  lens("RETN", {
    stage: "AFTER",
    definition: "Whether first-time buyers come back: reorders, reminders, and a first experience worth repeating.",
    buyerQuestion: "Was it worth it, and would I buy again?",
    site: "no",
    needs: ["data"],
    founderQuestions: [
      "What share of first-time buyers order again within 90 days?",
      "What do buyers who never come back have in common?",
    ],
    aliases: /retention|churn|repeat|loyalty|lifetime|reorder|customer health|regret|revenue quality|longitudinal/i,
  }),
  lens("ADVO", {
    stage: "AFTER",
    definition: "Whether happy buyers tell others: reviews asked for and shown, referrals, and an experience worth sharing.",
    buyerQuestion: "Would I recommend this, and is it easy to?",
    site: "partly",
    needs: ["data"],
    founderQuestions: [
      "What share of buyers leave a review, and do you ask them to?",
      "Do you have a referral or share offer, and do buyers use it?",
    ],
    aliases: /advoca|referral|word of mouth|recommend|sharing|ugc/i,
  }),
];

export const LENSES: LensDef[] = [...DEFINED].sort((a, b) => LENS_IDS.indexOf(a.id) - LENS_IDS.indexOf(b.id));

export const LENS_BY_ID = Object.fromEntries(LENSES.map((l) => [l.id, l])) as Record<Lens, LensDef>;
export { LENS_IDS, LENS_NAMES, type Lens };

// Lens values stored before 25 Nov 2026: the ten journey questions (on Learning notes) and the
// LGL check area (on old results). Read through this so history shows under the new lenses.
const LEGACY: Record<string, Lens | null> = {
  UNDERSTAND: "CLAR",
  TRUST: "TRST",
  COST: "PRIC",
  PROMISE: "DELV",
  COMMIT: "TRIAL",
  EFFORT: "CHKT",
  EXIT: "RTRN",
  AFTER: "ONBD",
  RECOVERY: "SUPP",
  VALUE: "RETN",
  EVIDENCE: null, // the founder's own evidence: part of QIM, not a lens of the store
  LGL: "ENFC",
};

export function toLens(value: string | null | undefined): Lens | null {
  if (!value) return null;
  if ((LENS_IDS as readonly string[]).includes(value)) return value as Lens;
  return LEGACY[value] ?? null;
}

// Free-text corpus labels ("Delivery Promise, Cancellation, Refund and Service Recovery Lens")
// to lenses. A founder story with no buyer-side match maps to none: it is about the founder's
// evidence (QIM 4 and 6), which the Bench shows separately.
export function lensesForLabels(labels: string): Lens[] {
  return LENSES.filter((l) => l.aliases.test(labels)).map((l) => l.id);
}
