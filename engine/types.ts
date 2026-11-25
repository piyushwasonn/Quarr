// Shared shapes for the QUARR First Look engine.

export type PageKind =
  | "HOME"
  | "PRODUCT_1"
  | "PRODUCT_2"
  | "CART"
  | "CHECKOUT"
  | "SHIPPING"
  | "RETURNS"
  | "TERMS"
  | "PRIVACY"
  | "CONTACT"
  | "ABOUT";

export const POLICY_KINDS: PageKind[] = ["SHIPPING", "RETURNS", "TERMS", "PRIVACY", "CONTACT", "ABOUT"];

export type Box = { x: number; y: number; w: number; h: number };

export type LinkInfo = { href: string; text: string; area: "header" | "footer" | "body" };

export type PageData = {
  h1: string[];
  hiddenText?: string; // includes collapsed sections a buyer can open with a tap
  metaDescription: string | null;
  links: LinkInfo[];
  jsonLd: unknown[];
  inputs: { name: string; placeholder: string; type: string }[];
  buttons: string[];
  strikePrices: string[];
  images: { total: number; missingAlt: number };
  overflowX: number; // px of horizontal overflow at 390px
  lcpMs: number | null;
  mixedContent: string[];
  boxes: Partial<Record<ElementKey, Box>>;
  pageWidth: number;
  pageHeight: number;
  extra?: Record<string, unknown>;
};

export type ElementKey = "h1" | "price" | "addToCart" | "pincode" | "reviews" | "hero" | "banner" | "footer" | "header";

export type CapturedPage = {
  kind: PageKind;
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  title: string;
  text: string;
  data: PageData;
  mobileShot?: Buffer;
  // The first phone screen only, kept in memory for the AI reader (not stored).
  firstScreen?: Buffer;
  desktopShot?: Buffer;
  mobileHeight?: number;
  desktopHeight?: number;
};

export type CrawlSignals = {
  platform: "shopify" | "woocommerce" | "unknown";
  storeName: string | null;
  addToCart: { attempted: boolean; succeeded: boolean; method: string | null; itemCount: number | null };
  cartPersistsAfterReload: boolean | null;
  checkoutReached: boolean;
  checkoutRequiresLogin: boolean | null;
  isStore: boolean;
  navLinkStatuses: { href: string; text: string; status: number | null }[];
  heroCta: { href: string; text: string; status: number | null } | null;
  productPrices: { kind: PageKind; amount: number | null }[];
  cartAmounts: number[];
  https: boolean;
};

export type CrawlResult =
  | { ok: true; pages: CapturedPage[]; signals: CrawlSignals }
  | { ok: false; code: "BLOCKED" | "PASSWORD" | "NOT_STORE" | "UNREACHABLE" | "TIMEOUT" | "ERROR"; detail: string; pages?: CapturedPage[] };

// What a check cites. No citation, no finding.
export type Citation = {
  pageKind: PageKind;
  url: string;
  snippet: string;
  viewport: "mobile" | "desktop";
  box?: Box;
  searched?: PageKind[]; // for absence findings: where we looked
};

// NOT_APPLICABLE: the check doesn't apply to this store (no subscriptions to check, say). It is
// neither a pass nor a gap, and is never shown as "couldn't check".
export type Outcome = "PASS" | "FAIL" | "NOT_OBSERVABLE" | "NOT_APPLICABLE";

export type CheckVerdict = {
  outcome: Outcome;
  evidenceStrength?: number; // 0..1, defaults by outcome
  citation?: Citation;
  detail?: Record<string, unknown>;
};

export type StoredPage = {
  id?: string;
  kind: PageKind;
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  title: string;
  text: string;
  data: PageData;
};

export type CheckContext = {
  pages: Partial<Record<PageKind, StoredPage>>;
  signals: CrawlSignals;
};

// QUARR's 19 lenses (Notion 01): the parts of a buyer's journey QUARR looks at, from finding
// the store to recommending it. Definitions, stages and what each needs live in
// engine/framework/lenses.ts; the names are here so client components can show them.
export const LENS_IDS = ["DISC", "CLAR", "RELV", "TRST", "PRIC", "PROM", "AVAIL", "CHKT", "DELV", "ONBD", "TRIAL", "SUBS", "CANC", "RTRN", "SUPP", "ENFC", "RETN", "ADVO", "STAT"] as const;
export type Lens = (typeof LENS_IDS)[number];

export const LENS_NAMES: Record<Lens, string> = {
  DISC: "Finding you",
  CLAR: "Understanding the offer",
  RELV: "Is it for me",
  TRST: "Trusting the business",
  PRIC: "Knowing the full cost",
  PROM: "Claims that hold up",
  AVAIL: "There and working",
  CHKT: "Paying without friction",
  DELV: "Knowing when it arrives",
  ONBD: "After paying",
  TRIAL: "A low-risk first try",
  SUBS: "Renewals made clear",
  CANC: "Changing my mind",
  RTRN: "Returns and refunds",
  SUPP: "Getting help",
  ENFC: "My rights as a buyer",
  RETN: "Coming back",
  ADVO: "Recommending you",
  STAT: "What I chose stays right",
};

export const isLens = (v: unknown): v is Lens => typeof v === "string" && (LENS_IDS as readonly string[]).includes(v);

export type FindingCopy = {
  title: string;
  observed: string;
  likelyEffect: string;
  notYetProven: string;
};

export type CheckDef = {
  id: string;
  lens: Lens;
  name: string; // short internal label for Bench
  severity: 1 | 2 | 3 | 4 | 5; // 5 = buyer is likely to abandon
  money: boolean; // directly affects what the buyer pays or gets back
  group?: string; // checks that describe the same buyer problem; at most one is shown
  run: (ctx: CheckContext) => CheckVerdict;
  copy: (detail: Record<string, unknown>, citation: Citation) => FindingCopy;
  // Present on checks answered by QUARR's AI reader (engine/ai/judge.ts) instead of a rule.
  ai?: AiCheckSpec;
};

export type AiCheckSpec = {
  question: string;
  failWhen: string;
  passWhen: string;
  // Verified quotes a FAIL needs: 2 for a contradiction (both sides), 1 otherwise.
  failQuotes: 1 | 2;
  pages: PageKind[];
  fullOnly?: boolean;
};
