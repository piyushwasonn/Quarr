import { db } from "@/lib/db";
import { processRun } from "./pipeline";

// The crawl worker. Crawls take minutes, so they never run inside a web request.
// Locally it runs forever (engine/worker-cli.ts). On GitHub Actions it drains the
// queue and exits when idle (engine/drain.ts), so it only uses minutes when there is work.
const POLL_MS = 4000;
const STALE_MINUTES = 15;
const MAX_ATTEMPTS = 2;

// Two lanes: quick previews never wait behind a full walk of someone else's store.
type Lane = "preview" | "main";

async function claimNext(lane: Lane): Promise<string | null> {
  const rows =
    lane === "preview"
      ? await db.$queryRaw<{ id: string }[]>`
    UPDATE "Run" SET status = 'CRAWLING', "lockedAt" = now()
    WHERE id = (
      SELECT id FROM "Run" WHERE status = 'QUEUED' AND kind = 'PREVIEW'
      ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id`
      : await db.$queryRaw<{ id: string }[]>`
    UPDATE "Run" SET status = 'CRAWLING', "lockedAt" = now()
    WHERE id = (
      SELECT id FROM "Run" WHERE status = 'QUEUED' AND kind <> 'PREVIEW'
      ORDER BY priority ASC, "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED
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

export type WorkerOptions = {
  exitWhenIdleMs?: number; // stop once both lanes have had nothing to do for this long
  maxRuntimeMs?: number; // stop claiming new runs after this long (finish the current ones)
};

export async function runWorker(opts: WorkerOptions = {}) {
  const started = Date.now();
  let stopping = false;
  let busy = 0;
  let lastActivity = Date.now();
  const stop = () => (stopping = true);
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const loop = async (lane: Lane) => {
    while (!stopping) {
      if (opts.maxRuntimeMs && Date.now() - started > opts.maxRuntimeMs) break;
      if (lane === "main") await recoverStale();
      const id = await claimNext(lane);
      if (!id) {
        if (opts.exitWhenIdleMs && busy === 0 && Date.now() - lastActivity > opts.exitWhenIdleMs) break;
        await new Promise((r) => setTimeout(r, lane === "preview" ? 1000 : POLL_MS));
        continue;
      }
      busy++;
      try {
        await processRun(id);
      } catch (err) {
        console.error(`[worker:${lane}] run ${id} errored`, err);
        await db.run.update({ where: { id }, data: { status: "CRAWL_FAILED", failureCode: "ERROR", failureDetail: String(err).slice(0, 500), lockedAt: null, progress: null } });
      } finally {
        busy--;
        lastActivity = Date.now();
      }
    }
  };

  console.log("[worker] started (preview lane + main lane)");
  await Promise.all([loop("preview"), loop("main")]);
  await db.$disconnect();
  console.log(`[worker] stopped after ${Math.round((Date.now() - started) / 1000)}s`);
}
