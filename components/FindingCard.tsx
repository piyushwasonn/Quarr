import { LENS_NAMES, type Citation, type Lens } from "@/engine/types";
import { Shot } from "./Shot";

export type EvidencePage = { kind: string; mobileShot: string | null; desktopShot: string | null; mobileHeight: number | null; desktopHeight: number | null; finalUrl: string | null; url: string };

const PAGE_LABEL: Record<string, string> = {
  HOME: "Homepage",
  PRODUCT_1: "Product page",
  PRODUCT_2: "Second product page",
  CART: "Cart",
  CHECKOUT: "Checkout, first screen",
  SHIPPING: "Shipping policy",
  RETURNS: "Returns policy",
  TERMS: "Terms",
  PRIVACY: "Privacy policy",
  CONTACT: "Contact page",
  ABOUT: "About page",
};
export const pageLabel = (k: string) => PAGE_LABEL[k] ?? k;

export function FindingCard({
  index,
  lens,
  title,
  observed,
  likelyEffect,
  notYetProven,
  citation,
  page,
}: {
  index: number;
  lens: string;
  title: string;
  observed: string;
  likelyEffect: string;
  notYetProven: string;
  citation: Citation | null;
  page: EvidencePage | null;
}) {
  const desktop = citation?.viewport === "desktop" && page?.desktopShot;
  const shot = desktop ? page?.desktopShot : page?.mobileShot;
  const height = (desktop ? page?.desktopHeight : page?.mobileHeight) ?? 844;
  return (
    <article className="card finding" id={`finding-${index}`}>
      <div className="finding-grid">
        <div className="finding-body">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="finding-num">FINDING {String(index).padStart(2, "0")}</span>
            <span className="chip">{LENS_NAMES[lens as Lens] ?? lens}</span>
          </div>
          <h2>{title}</h2>
          <div className="facet observed">
            <span className="label">What we saw</span>
            <p>{observed}</p>
          </div>
          <div className="facet">
            <span className="label">Likely effect on a buyer</span>
            <p>{likelyEffect}</p>
          </div>
          <div className="facet">
            <span className="label">Not yet proven</span>
            <p>{notYetProven}</p>
          </div>
        </div>
        <aside className="finding-evidence" aria-label="Evidence">
          <span className="eyebrow">Evidence · {pageLabel(citation?.pageKind ?? "")}</span>
          {shot ? (
            <a href={`/e/${shot}`} target="_blank" rel="noreferrer" title="Open the full screenshot">
              <Shot src={`/e/${shot}`} pageWidth={desktop ? 1440 : 390} pageHeight={height} box={citation?.box} windowHeight={desktop ? 900 : 640} alt={`Screenshot of ${pageLabel(citation?.pageKind ?? "")}`} phone={!desktop} />
            </a>
          ) : null}
          {citation?.snippet ? <p className="snippet">{citation.snippet}</p> : null}
          {citation?.url ? (
            <p className="shot-caption">
              Captured from <span style={{ overflowWrap: "anywhere" }}>{citation.url}</span> on a {desktop ? "1440 px desktop" : "390 px phone"} screen.
            </p>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
