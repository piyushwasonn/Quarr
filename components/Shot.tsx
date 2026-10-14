import type { Box } from "@/engine/types";

// A cropped window onto a full-page screenshot, scrolled to the cited element
// with the element outlined. All positions are percentages of the full page,
// so the crop scales with whatever width it is rendered at.
export function Shot({
  src,
  pageWidth,
  pageHeight,
  box,
  windowHeight,
  alt,
  phone = false,
}: {
  src: string;
  pageWidth: number;
  pageHeight: number;
  box?: Box | null;
  windowHeight: number; // in page CSS px
  alt: string;
  phone?: boolean;
}) {
  const h = Math.max(1, pageHeight);
  const win = Math.min(windowHeight, h);
  const focusY = box ? box.y + box.h / 2 : 0;
  const top = Math.max(0, Math.min(h - win, focusY - win / 2));
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  return (
    <div className={`shot${phone ? " phone" : ""}`} style={{ aspectRatio: `${pageWidth} / ${win}` }}>
      <div className="shot-inner" style={{ transform: `translateY(-${pct(top, h)})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" />
        {box && (
          <div
            className="shot-box"
            style={{ left: pct(Math.max(0, box.x - 4), pageWidth), top: pct(Math.max(0, box.y - 4), h), width: pct(Math.min(box.w + 8, pageWidth), pageWidth), height: pct(box.h + 8, h) }}
          />
        )}
      </div>
    </div>
  );
}
