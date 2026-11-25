import type { Citation } from "@/engine/types";
import type { EvidencePage } from "./FindingCard";

// A real finding produced by the engine against the "Glow Basics" test fixture.
export const SAMPLE_FINDING: {
  lens: string;
  title: string;
  observed: string;
  likelyEffect: string;
  notYetProven: string;
  whatToDo: string;
  citation: Citation;
  page: EvidencePage;
} = {
  lens: "TRST",
  title: "A policy page still has unedited template text",
  observed: 'The returns policy contains template placeholder text ("[INSERT COMPANY NAME]") that was never replaced with your details.',
  likelyEffect: "Careful buyers read policies before paying a new brand. Template text tells them nobody has looked at this page, and they wonder what else is unchecked.",
  notYetProven: "Nothing more. The text is on the live page as quoted.",
  whatToDo: "Replace the placeholder text in your policy pages with your own details, then read each policy once from start to end.",
  citation: {
    pageKind: "RETURNS",
    url: "https://glowbasics.example/policies/refund-policy",
    snippet: "[INSERT COMPANY NAME] accepts returns of eligible items. To be eligible for a return, your item must be unused…",
    viewport: "mobile",
    box: { x: 12, y: 190, w: 366, h: 116 },
  },
  page: { kind: "RETURNS", mobileShot: "sample/returns-mobile.jpg", desktopShot: null, mobileHeight: 844, desktopHeight: null, finalUrl: null, url: "" },
};
