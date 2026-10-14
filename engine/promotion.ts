import { db } from "@/lib/db";
import { CHECKS } from "./checks";

// A check earns AUTO when its last 30 reviewed findings had no wrong evidence,
// no false positive, nothing unsafe, and at most 10% severity re-ranks.
// Any single one of those three bad reasons drops it back to REVIEW.
export const PROMOTION_WINDOW = 30;
export const SEVERITY_TOLERANCE = 0.1;
const BAD = new Set(["EVIDENCE_WRONG", "FALSE_POSITIVE", "UNSAFE"]);

export type CheckMode = "AUTO" | "REVIEW" | "SUSPENDED";

export type CheckStats = {
  checkId: string;
  mode: CheckMode;
  reviewed: number;
  approved: number;
  edits: Record<string, number>;
  badInWindow: number;
  severityRate: number;
  firings: number;
  passes: number;
  notObservable: number;
  shown: number;
};

export async function checkStats(): Promise<CheckStats[]> {
  const [settings, outcomes, shown] = await Promise.all([
    db.checkSetting.findMany(),
    db.checkResult.groupBy({ by: ["checkId", "outcome"], _count: { _all: true } }),
    db.finding.groupBy({ by: ["checkId"], where: { selected: true }, _count: { _all: true } }),
  ]);
  const suspended = new Set(settings.filter((s) => s.suspended).map((s) => s.checkId));

  const stats: CheckStats[] = [];
  for (const def of CHECKS) {
    const window = await db.reviewEvent.findMany({
      where: { checkId: def.id, action: { in: ["APPROVE", "EDIT", "DROP"] } },
      orderBy: { createdAt: "desc" },
      take: PROMOTION_WINDOW,
      select: { action: true, reason: true },
    });
    const edits: Record<string, number> = {};
    for (const e of window) if (e.reason) edits[e.reason] = (edits[e.reason] ?? 0) + 1;
    const badInWindow = window.filter((e) => e.reason && BAD.has(e.reason)).length;
    const severityRate = window.length ? (edits.SEVERITY ?? 0) / window.length : 0;
    const count = (o: string) => outcomes.find((x) => x.checkId === def.id && x.outcome === o)?._count._all ?? 0;

    let mode: CheckMode = "REVIEW";
    if (suspended.has(def.id)) mode = "SUSPENDED";
    else if (window.length >= PROMOTION_WINDOW && badInWindow === 0 && severityRate <= SEVERITY_TOLERANCE) mode = "AUTO";

    stats.push({
      checkId: def.id,
      mode,
      reviewed: window.length,
      approved: window.filter((e) => e.action === "APPROVE").length,
      edits,
      badInWindow,
      severityRate,
      firings: count("FAIL"),
      passes: count("PASS"),
      notObservable: count("NOT_OBSERVABLE"),
      shown: shown.find((s) => s.checkId === def.id)?._count._all ?? 0,
    });
  }
  return stats;
}

export async function checkModes() {
  return new Map((await checkStats()).map((s) => [s.checkId, s.mode]));
}
