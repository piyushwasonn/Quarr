import type { Lens } from "../types";

// QUARR Intelligence Model v1.0 (Drive, 03 Reasoning Engine). Locked; changes only on real customer evidence.
export const QIM_PRINCIPLES = [
  { n: 1, name: "Evidence before opinion", rule: "Every finding, score and recommendation must be supported by evidence. If evidence is weak, say that confidence is limited." },
  { n: 2, name: "Unknown is a valid answer", rule: "When evidence is insufficient, the correct answer is Unknown, not an assumption." },
  { n: 3, name: "Reduce effort, preserve confidence", rule: "Remove unnecessary customer effort without removing steps that genuinely increase confidence." },
  { n: 4, name: "Behaviour beats intention", rule: "What customers do carries more weight than what they say." },
  { n: 5, name: "Every finding leads to action", rule: "Say what is happening, why it matters and what the founder should do next." },
  { n: 6, name: "Assumptions are business risks", rule: "Name the assumption, explain the risk and suggest the fastest way to test it." },
  { n: 7, name: "Respect the founder's time", rule: "If QUARR can infer it, don't ask. If it won't change a decision, don't show it." },
] as const;

// Reasoning rules from "Customer Thinking Stories" (Drive). Each one comes from a single
// person's buying decisions, so it is a HYPOTHESIS until Bench reviews of real stores
// confirm it (QIM change policy). They explain findings; they never create one.
export type ReasoningRule = {
  id: string;
  // The lens it explains. Rules about how QUARR reasons with the founder's own evidence have none.
  lens?: Lens;
  rule: string;
  source: string;
  status: "hypothesis" | "confirmed" | "rejected";
  checks?: string[];
};

export const REASONING_RULES: ReasoningRule[] = [
  { id: "TR-01", lens: "PRIC", rule: "Check whether the buyer can see the complete likely cost before starting to pay.", source: "Thinking Stories 001, Rule 007", status: "hypothesis", checks: ["PRIC-02", "PRIC-03", "CHKT-02"] },
  { id: "TR-02", lens: "PRIC", rule: "A pleasant surprise at checkout is not good information design. Hidden essential costs still lose the less committed buyer.", source: "Thinking Stories 001, Rule 011", status: "hypothesis", checks: ["PRIC-02", "CHKT-02"] },
  { id: "TR-03", lens: "PROM", rule: "Showing how something is made is stronger evidence than claiming it is high quality.", source: "Thinking Stories 001, Rule 003", status: "hypothesis", checks: ["PROM-01", "CLAR-04"] },
  { id: "TR-04", lens: "TRST", rule: "When trust rises suddenly, find the exact proof, behaviour or value signal that caused it.", source: "Thinking Stories 001, Rule 005", status: "hypothesis" },
  { id: "TR-05", lens: "TRIAL", rule: "Let buyers experience the outcome, or a small part of it, before asking for a large commitment.", source: "Thinking Stories 003 (Canva)", status: "hypothesis" },
  { id: "TR-06", lens: "TRIAL", rule: "Where trial and repeat buyers both exist, show how the price changes from a sample to a larger order.", source: "Thinking Stories 001, Rule 010", status: "hypothesis" },
  { id: "TR-07", lens: "TRIAL", rule: "A low price can act as a risk ceiling: below it, buyers don't need to justify the purchase.", source: "Thinking Stories 005", status: "hypothesis" },
  { id: "TR-08", lens: "DELV", rule: "When there is a real trade-off between price and speed, let the buyer choose.", source: "Thinking Stories 001, Rule 009", status: "hypothesis", checks: ["DELV-01"] },
  { id: "TR-09", lens: "DELV", rule: "A third-party courier or payment provider is judged as part of the brand.", source: "Thinking Stories 001, Rule 008", status: "hypothesis" },
  { id: "TR-10", lens: "ONBD", rule: "The moment after payment has its own anxiety. A confirmation should say the order was received, what happens now, and how to follow it.", source: "Thinking Stories 001, Rules 013 and 014", status: "hypothesis" },
  { id: "TR-11", lens: "SUPP", rule: "A customer's own mistake is a loyalty moment. Fair recovery can earn more trust than a flawless transaction.", source: "Thinking Stories 003 (Canva)", status: "hypothesis", checks: ["TRST-01"] },
  { id: "TR-12", lens: "SUPP", rule: "Response speed must match what the problem is costing the customer right now.", source: "Thinking Stories 006 (Zomato Dine-In)", status: "hypothesis", checks: ["TRST-01", "LGL-04"] },
  { id: "TR-13", lens: "RETN", rule: "Adding to cart proves interest, not readiness. Desire often depends on an imagined occasion, and fades when it does.", source: "Thinking Stories 004", status: "hypothesis" },
  { id: "TR-14", lens: "RETN", rule: "Repurchase intent measures lasting value better than the first conversion.", source: "Thinking Stories 002", status: "hypothesis" },
  { id: "TR-15", lens: "RETN", rule: "Measure trust withdrawal, such as a buyer who stays but stops spending, not only churn.", source: "Thinking Stories 006", status: "hypothesis" },
  { id: "TR-16", rule: "Don't recommend a fix when the business didn't cause the problem. Sometimes the finding is weak fit, not a broken journey.", source: "Thinking Stories 002", status: "hypothesis" },
  { id: "TR-17", rule: "Ask what earlier loss is shaping the buyer's current sensitivity to risk.", source: "Thinking Stories 001, Rule 002", status: "hypothesis" },
];
