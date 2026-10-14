import "./env";
import { db } from "@/lib/db";
import { processRun } from "./pipeline";

// Long-running job worker. Crawls take minutes, so they never run inside a web request.
const POLL_MS = 4000;
const STALE_MINUTES = 15;
const MAX_ATTEMPTS = 2;

async function claimNext(): Promise<string | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "Run" SET status = 'CRAWLING', "lockedAt" = now()
    WHERE id = (
      SELECT id FROM "Run" WHERE status = 'QUEUED'
      ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows[0]?.id ?? null;
}

async function recoverStale() {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000);
  await db.run.updateMany({ where: { status: "CRAWLING", lockedAt: { lt: cutoff }, attempts: { lt: MAX_ATTEMPTS } }, data: { status: "QUEUED", lockedAt: null } });
  await db.run.updateMany({
    where: { status: "CRAWLING", lockedAt: { lt: cutoff }, attempts: { gte: MAX_ATTEMPTS } },
    data: { status: "CRAWL_FAILED", failureCode: "TIMEOUT", failureDetail: "Worker did not finish after retries", lockedAt: null },
  });
}

let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

async function main() {
  console.log("[worker] started");
  while (!stopping) {
    await recoverStale();
    const id = await claimNext();
    if (!id) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    try {
      await processRun(id);
    } catch (err) {
      console.error(`[worker] run ${id} errored`, err);
      await db.run.update({ where: { id }, data: { status: "CRAWL_FAILED", failureCode: "ERROR", failureDetail: String(err).slice(0, 500), lockedAt: null } });
    }
  }
  await db.$disconnect();
  console.log("[worker] stopped");
}

main();
