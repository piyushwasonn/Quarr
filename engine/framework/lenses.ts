// The QUARR framework: the buyer's journey as ten questions, plus one about the founder.
// Built from Notion 90 (QIM v1.0 and the three research corpora), 24 Nov 2026.
//
// Each lens is a question a buyer (or, for EVIDENCE, the founder) must be able to answer
// with confidence. A website check answers part of it; what a crawler can't see is
// "Unknown" (QIM principle 2) and becomes a question for the founder instead of a guess.

export type FrameworkLensId =
  | "UNDERSTAND"
  | "TRUST"
  | "COST"
  | "PROMISE"
  | "COMMIT"
  | "EFFORT"
  | "EXIT"
  | "AFTER"
  | "RECOVERY"
  | "VALUE"
  | "EVIDENCE";

export type FrameworkLens = {
  id: FrameworkLensId;
  name: string;
  stage: "Before buying" | "Buying" | "After buying" | "The founder";
  buyerQuestion: string;
  // How much of it a walk through the public website can show.
  website: "yes" | "partly" | "no";
  // Asked when the website can't show it (QIM 2: Unknown is a valid answer; QIM 6: assumptions are risks).
  founderQuestions: string[];
  // Matches the free-text lens labels in the research corpus.
  aliases: RegExp;
};

export const FRAMEWORK_LENSES: FrameworkLens[] = [
  {
    id: "UNDERSTAND",
    name: "Understand the offer",
    stage: "Before buying",
    buyerQuestion: "Do I understand what this is, and whether it's for me?",
    website: "yes",
    founderQuestions: [
      "When a new visitor lands, what is the one thing you need them to understand in the first five seconds?",
      "Which questions do buyers ask you on WhatsApp or email before their first order?",
    ],
    aliases: /discovery|clarity|comprehension|positioning|listing accuracy|first-time user|expert-founder|message-to-landing|product clarity|personalis/i,
  },
  {
    id: "TRUST",
    name: "Trust the business",
    stage: "Before buying",
    buyerQuestion: "Can I trust this business with my money?",
    website: "yes",
    founderQuestions: [
      "What usually convinces a hesitant first-time buyer to go ahead with you?",
      "Where do buyers see proof from other buyers: reviews, photos, ratings elsewhere?",
    ],
    aliases: /trust|review|evidence transparency|verification|safety|merchant identity|asset identity|consent/i,
  },
  {
    id: "COST",
    name: "Know the full cost",
    stage: "Before buying",
    buyerQuestion: "Do I know the full cost before I commit?",
    website: "yes",
    founderQuestions: [
      "Is there any charge a buyer first sees at checkout: delivery, COD fee, packaging, tax?",
      "When an offer is running, what exactly happens to the price when it ends or fails to apply?",
    ],
    aliases: /pric|fee|promotion|promotional|discount|stored value|fare|paid upgrade|charge/i,
  },
  {
    id: "PROMISE",
    name: "Trust the delivery promise",
    stage: "Before buying",
    buyerQuestion: "Will I get it when, where and how I was told?",
    website: "partly",
    founderQuestions: [
      "How often does an order arrive after the date you showed the buyer?",
      "Are there pincodes your courier says it serves but often fails to deliver to?",
    ],
    aliases: /deliver|last-mile|serviceab|inventory|stock|promise|reservation|availability|hours|shipping|logistics|fulfil|time-sensitive|node/i,
  },
  {
    id: "COMMIT",
    name: "A safe first commitment",
    stage: "Before buying",
    buyerQuestion: "Is the first step small and safe enough to try?",
    website: "partly",
    founderQuestions: [
      "Can a first-time buyer try you for a small amount, such as a single item, a sample or cash on delivery?",
      "If you sell subscriptions or bundles, does the buyer see the full renewal or commitment before paying?",
    ],
    aliases: /trial|subscription|renewal|commitment|sample|moq|willingness[- ]to[- ]pay|paywall|contract design|monetisation timing/i,
  },
  {
    id: "EFFORT",
    name: "Finish without friction",
    stage: "Buying",
    buyerQuestion: "Can I finish the purchase without fighting the site?",
    website: "yes",
    founderQuestions: [
      "Where do buyers most often drop out between adding to cart and paying?",
      "When a payment fails, what does the buyer see, and can they retry safely?",
    ],
    aliases: /checkout|payment|retry|order change|customer effort|onboarding|signup|activation|empty state|core-task|software experience|first value|time-to-value/i,
  },
  {
    id: "EXIT",
    name: "A safe way out",
    stage: "After buying",
    buyerQuestion: "If it's wrong, can I return it or get my money back?",
    website: "partly",
    founderQuestions: [
      "How many days does a refund actually take, counted from the day you receive the return?",
      "Has a return ever failed because the courier wouldn't collect it from the buyer?",
    ],
    aliases: /return|refund|cancel|reverse logistics|custody|replacement|remedy|exit|damage dispute|defect/i,
  },
  {
    id: "AFTER",
    name: "Know what's happening after paying",
    stage: "After buying",
    buyerQuestion: "After I pay, do I know my order is safe and where it is?",
    website: "no",
    founderQuestions: [
      "Right after payment, what message does the buyer get, and does it say what happens next and how to track it?",
      "When an order is delayed, who tells the buyer first: you, the courier, or nobody?",
    ],
    aliases: /order-state|state integrity|status|notification|tracking|confirmation|entitlement|payment-state|history integrity|attribution|post-purchase/i,
  },
  {
    id: "RECOVERY",
    name: "Problems put right, fast",
    stage: "After buying",
    buyerQuestion: "If something goes wrong, will they make it right, and quickly?",
    website: "partly",
    founderQuestions: [
      "When a buyer writes in with a problem, how long until a person replies?",
      "Can whoever answers the buyer issue a refund or replacement without waiting on someone else?",
    ],
    aliases: /recovery|support|escalat|handoff|hand-off|appeal|sla|complaint|exception|investigation|enforcement/i,
  },
  {
    id: "VALUE",
    name: "Worth buying again",
    stage: "After buying",
    buyerQuestion: "Was it worth it, and would I buy again?",
    website: "no",
    founderQuestions: [
      "What share of first-time buyers order again within 90 days?",
      "What do buyers who never come back have in common?",
    ],
    aliases: /retention|churn|repeat|loyalty|lifetime|reorder|customer health|outcome|regret|revenue quality|longitudinal/i,
  },
  {
    id: "EVIDENCE",
    name: "What the founder really knows",
    stage: "The founder",
    buyerQuestion: "What do I know about my buyers from what they did, not what they said?",
    website: "no",
    founderQuestions: [
      "Which belief about your buyers have you never tested?",
      "What did your last ten buyers do just before they bought, and how do you know?",
    ],
    aliases: /validation|customer understanding|customer discovery|founder|idea|assumption|behavioural|vanity|acquisition|distribution|audience|customer definition|market timing|unit economics|runway|icp|feature decisions|evidence hierarchy|instrumentation/i,
  },
];

export const FRAMEWORK_LENS_BY_ID = Object.fromEntries(FRAMEWORK_LENSES.map((l) => [l.id, l])) as Record<FrameworkLensId, FrameworkLens>;

// Which framework lens each website check answers. Every check has exactly one (tested).
export const CHECK_LENS: Record<string, FrameworkLensId> = {
  "PRIC-01": "COST",
  "PRIC-02": "COST",
  "PRIC-03": "COST",
  "PRIC-04": "COST",
  "CHKT-02": "COST",
  "STAT-02": "COST",
  "PROM-02": "COST",
  "DELV-01": "PROMISE",
  "DELV-02": "PROMISE",
  "DELV-03": "PROMISE",
  "AVAIL-01": "PROMISE",
  "RTRN-01": "EXIT",
  "RTRN-02": "EXIT",
  "RTRN-03": "EXIT",
  "RTRN-04": "EXIT",
  "TRST-01": "RECOVERY",
  "LGL-04": "RECOVERY",
  "TRST-02": "TRUST",
  "TRST-03": "TRUST",
  "TRST-04": "TRUST",
  "TRST-05": "TRUST",
  "TRST-06": "TRUST",
  "LGL-01": "TRUST",
  "LGL-02": "TRUST",
  "LGL-03": "TRUST",
  "PROM-01": "TRUST",
  "AVAIL-02": "EFFORT",
  "AVAIL-03": "EFFORT",
  "AVAIL-04": "EFFORT",
  "CHKT-01": "EFFORT",
  "CHKT-03": "EFFORT",
  "CHKT-04": "EFFORT",
  "PROM-03": "EFFORT",
  "STAT-01": "EFFORT",
  "CLAR-01": "UNDERSTAND",
  "CLAR-02": "UNDERSTAND",
  "CLAR-03": "UNDERSTAND",
  "CLAR-04": "UNDERSTAND",
  // Answered by the AI reader (engine/checks/ai.ts)
  "AI-COST-01": "COST",
  "AI-PROM-01": "PROMISE",
  "AI-EXIT-01": "EXIT",
  "AI-COMMIT-01": "COMMIT",
  "AI-UND-01": "UNDERSTAND",
  "AI-TRUST-01": "TRUST",
};

// Free-text corpus labels ("Delivery Promise, Cancellation, Refund and Service Recovery Lens")
// to framework lenses. Founder stories with no buyer-side match fall under EVIDENCE.
export function lensesForLabels(labels: string, kind: "customer" | "founder"): FrameworkLensId[] {
  const found = FRAMEWORK_LENSES.filter((l) => l.aliases.test(labels)).map((l) => l.id);
  if (kind === "founder" && !found.includes("EVIDENCE")) found.push("EVIDENCE");
  return found;
}
