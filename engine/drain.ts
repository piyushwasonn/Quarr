import "./env";
import { runWorker } from "./worker";

// GitHub Actions: process everything queued, then exit after 20 s with nothing to do.
// Stops claiming new runs after 25 minutes so the job ends well inside its 30-minute limit.
runWorker({ exitWhenIdleMs: 20_000, maxRuntimeMs: 25 * 60_000 }).then(() => process.exit(0));
