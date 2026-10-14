import "./env";
import { readFile } from "node:fs/promises";
import { db } from "@/lib/db";
import { newPublicToken } from "@/lib/tokens";
import { normalizeStoreUrl } from "@/lib/url";
import { processRun } from "./pipeline";

// Queue and process stores directly, for outreach batches:
//   npm run run:once -- https://store.in you@quarr.in
//   npm run run:once -- --file stores.txt you@quarr.in
async function main() {
  const args = process.argv.slice(2);
  let urls: string[] = [];
  let email = "";
  if (args[0] === "--file") {
    urls = (await readFile(args[1], "utf8")).split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
    email = args[2] ?? "";
  } else {
    urls = [args[0]];
    email = args[1] ?? "";
  }
  if (!urls[0] || !email) {
    console.error("Usage: npm run run:once -- <storeUrl|--file list.txt> <your-email>");
    process.exit(1);
  }
  for (const raw of urls) {
    const n = normalizeStoreUrl(raw);
    if (!n) {
      console.error(`Skipping invalid URL: ${raw}`);
      continue;
    }
    const run = await db.run.create({
      data: { publicToken: newPublicToken(), storeUrl: n.url, domain: n.domain, email, source: "BENCH", status: "QUEUED", lockedAt: new Date() },
    });
    await processRun(run.id);
    const done = await db.run.findUniqueOrThrow({ where: { id: run.id } });
    console.log(`${n.domain}: ${done.status}${done.failureCode ? ` (${done.failureCode})` : ""} → /bench/runs/${run.id}`);
  }
  await db.$disconnect();
}

main();
