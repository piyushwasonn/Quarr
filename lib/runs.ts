import type { User } from "@prisma/client";
import { wakeCrawler } from "./crawler";
import { db } from "./db";
import { newPublicToken } from "./tokens";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// After sign-up: turn an anonymous preview into the founder's full First Look.
export async function claimPreview(user: User, previewToken: string) {
  const preview = await db.run.findUnique({ where: { publicToken: previewToken } });
  if (!preview || preview.kind !== "PREVIEW") return null;
  if (!preview.userId) await db.run.update({ where: { id: preview.id }, data: { userId: user.id } });

  // One full walk per store per day (Notion 07, crawl politeness).
  const existing = await db.run.findFirst({
    where: { domain: preview.domain, kind: "FULL", createdAt: { gte: new Date(Date.now() - DAY) }, status: { not: "CRAWL_FAILED" } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    if (existing.userId === user.id) return existing;
    if (!existing.userId) return db.run.update({ where: { id: existing.id }, data: { userId: user.id } });
    return null; // someone else already has today's walk of this store
  }
  const full = await db.run.create({
    data: {
      publicToken: newPublicToken(),
      storeUrl: preview.storeUrl,
      domain: preview.domain,
      email: user.email,
      userId: user.id,
      kind: "FULL",
      priority: 5,
      parentRunId: preview.id,
      source: "PUBLIC",
      ipHash: preview.ipHash,
    },
  });
  await wakeCrawler(`first look ${full.domain}`);
  return full;
}

export async function creditsFor(userId: string) {
  const [bought, used] = await Promise.all([
    db.purchase.count({ where: { userId, product: "RECHECK", status: "PAID" } }),
    // A re-check that failed to crawl gives its credit back.
    db.run.count({ where: { userId, kind: "RECHECK", status: { not: "CRAWL_FAILED" } } }),
  ]);
  return Math.max(0, bought - used);
}

export async function startRecheck(user: User, runId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const base = await db.run.findUnique({ where: { id: runId } });
  if (!base || base.userId !== user.id || base.kind === "PREVIEW") return { ok: false, error: "We couldn't find that report in your account." };
  if (!["IN_REVIEW", "DRAFTED", "APPROVED", "PUBLISHED", "DELIVERED", "READY"].includes(base.status)) return { ok: false, error: "That walk hasn't finished yet." };
  if ((await creditsFor(user.id)) < 1) return { ok: false, error: "You need a re-check credit first." };
  const recent = await db.run.findFirst({ where: { domain: base.domain, kind: "RECHECK", userId: user.id, createdAt: { gte: new Date(Date.now() - HOUR) } } });
  if (recent) return { ok: false, error: "You can re-check this store once an hour. Try again a little later." };
  const run = await db.run.create({
    data: { publicToken: newPublicToken(), storeUrl: base.storeUrl, domain: base.domain, email: user.email, userId: user.id, kind: "RECHECK", priority: 3, parentRunId: base.id, source: "PUBLIC" },
  });
  await wakeCrawler(`re-check ${run.domain}`);
  return { ok: true, id: run.id };
}
