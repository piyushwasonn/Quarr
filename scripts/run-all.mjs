// Production entrypoint: sync the schema, then run the web app and the worker.
// If either process exits, exit too, so the platform restarts the container.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync(process.env.STORAGE_DIR || "/data/storage", { recursive: true });

const push = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], { stdio: "inherit" });
if (push.status !== 0) {
  console.error("[start] prisma db push failed; refusing to start");
  process.exit(push.status ?? 1);
}

const port = process.env.PORT || "3000";
const children = [
  spawn("npx", ["next", "start", "-p", port], { stdio: "inherit" }),
  spawn("npx", ["tsx", "engine/worker.ts"], { stdio: "inherit" }),
];

let exiting = false;
const stop = (code) => {
  if (exiting) return;
  exiting = true;
  for (const c of children) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 10_000).unref();
};
for (const c of children) c.on("exit", (code) => stop(code ?? 1));
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
