"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const DONE = ["READY", "IN_REVIEW", "DRAFTED", "APPROVED", "PUBLISHED", "DELIVERED", "CRAWL_FAILED", "REJECTED"];

// Polls the run and shows what the crawler is doing; refreshes the page when it finishes.
export function LiveProgress({ token, steps }: { token: string; steps: string[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState<string | null>(null);
  const [queued, setQueued] = useState(true);
  const seen = useRef<string[]>([]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/runs/status?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (r.ok) {
          const s = (await r.json()) as { status: string; progress: string | null };
          if (!alive) return;
          setQueued(s.status === "QUEUED");
          if (s.progress && !seen.current.includes(s.progress)) seen.current.push(s.progress);
          setCurrent(s.progress);
          if (DONE.includes(s.status)) {
            router.refresh();
            return;
          }
        }
      } catch {
        // Network blip: keep polling.
      }
      if (alive) setTimeout(tick, 1500);
    };
    tick();
    return () => {
      alive = false;
    };
  }, [token, router]);

  const idx = current ? steps.indexOf(current) : -1;
  return (
    <div className="card card-pad" aria-live="polite">
      <ol className="timeline">
        {steps.map((step, i) => {
          const done = idx > i || (idx === -1 && seen.current.includes(step) && step !== current);
          const now = step === current || (queued && i === 0 && !current);
          return (
            <li key={step} className={done ? "done" : now ? "now" : ""}>
              <span className="dot">{done ? "✓" : ""}</span>
              <div>
                <strong>{step}</strong>
                {now && queued ? <span className="muted small">Waiting for a free browser…</span> : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="small muted">Keep this page open. It updates by itself.</p>
    </div>
  );
}

export const PREVIEW_STEPS = [
  "Opening your homepage on a phone",
  "Finding your products",
  "Reading a product page like a first-time buyer",
  "Reading your shipping, returns and contact pages",
  "Checking that your menu links open",
  "Running QUARR's checks",
];

export const FULL_STEPS = [
  "Opening your homepage on a phone",
  "Finding your products",
  "Reading a product page like a first-time buyer",
  "Reading a second product page",
  "Adding one item to the cart",
  "Opening the first screen of checkout (we stop there)",
  "Reading your shipping, returns and contact pages",
  "Checking that your menu links open",
  "Running QUARR's checks",
];
