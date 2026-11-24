import { db } from "./db";
import { appUrl, verifyEmailTransport } from "./email";
import { deletePrefix, getFile, putFile } from "./storage";

// Bench → System health. Each check says what's wrong in plain words.
// Never shows a secret's value.
export type Check = { name: string; ok: boolean | null; detail: string; fix?: string };

const withTimeout = <T,>(p: Promise<T>, ms = 8000) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error(`timed out after ${ms / 1000}s`)), ms))]);
const msg = (e: unknown) => (e instanceof Error ? e.message.split("\n").filter(Boolean).slice(-1)[0] : String(e));

export async function runHealthChecks(requestHost: string | null): Promise<Check[]> {
  const out: Check[] = [];

  // Website basics
  const app = process.env.APP_URL;
  const appHost = app ? new URL(app).host : null;
  out.push({
    name: "Site address (APP_URL)",
    ok: !!app && (!requestHost || appHost === requestHost),
    detail: !app ? "Not set." : requestHost && appHost !== requestHost ? `Set to ${app}, but you're visiting ${requestHost}. Links in emails and sign-in will point to the wrong place.` : app,
    fix: "Netlify → Environment variables → APP_URL = https://quarr.in",
  });
  out.push({ name: "Session secret", ok: (process.env.SESSION_SECRET ?? "").length >= 32, detail: (process.env.SESSION_SECRET ?? "").length >= 32 ? "Set." : "Missing or shorter than 32 characters.", fix: "Netlify → SESSION_SECRET = a random string of 40+ characters" });

  // Database
  try {
    await withTimeout(db.$queryRaw`SELECT 1`);
    try {
      const runs = await db.run.count();
      out.push({ name: "Database", ok: true, detail: `Connected. ${runs} runs stored.` });
    } catch {
      out.push({ name: "Database", ok: false, detail: "Connected, but QUARR's tables don't exist yet.", fix: "GitHub → Actions → Crawl queued stores → Run workflow. Its first step creates the tables." });
    }
  } catch (e) {
    out.push({ name: "Database", ok: false, detail: `Can't connect: ${msg(e)}`, fix: "Netlify → DATABASE_URL = the Neon connection string (pooling off)" });
  }

  // Screenshot storage
  if (process.env.STORAGE_DRIVER !== "netlify") {
    out.push({ name: "Screenshot storage", ok: false, detail: "STORAGE_DRIVER is not \"netlify\", so screenshots would go to a disk that Netlify throws away.", fix: "Netlify → STORAGE_DRIVER = netlify" });
  } else {
    try {
      const key = `health/ping-${Date.now()}.txt`;
      await withTimeout(putFile(key, Buffer.from("ok")));
      const back = (await withTimeout(getFile(key))).toString();
      await deletePrefix("health/");
      out.push({ name: "Screenshot storage", ok: back === "ok", detail: back === "ok" ? "Netlify Blobs: wrote and read back a test file." : "Wrote a test file but read back something else." });
    } catch (e) {
      out.push({ name: "Screenshot storage", ok: false, detail: `Netlify Blobs failed: ${msg(e)}` });
    }
  }

  // Email
  const mail = await withTimeout(verifyEmailTransport(), 12000).catch((e) => ({ ok: false, detail: msg(e) }));
  out.push({ name: "Email", ...mail, fix: mail.ok === false ? "Resend: verify quarr.in (resend.com → Domains), then Netlify → RESEND_API_KEY and EMAIL_FROM = QUARR <firstlook@quarr.in>. See docs/DEPLOY.md." : undefined });

  // Crawler (GitHub Actions)
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_CRAWLER_REPO || "piyushwasonn/quarr";
  if (!token) {
    out.push({ name: "Crawler wake-up", ok: false, detail: "GITHUB_DISPATCH_TOKEN not set, so the crawler only runs every 3 hours.", fix: "GitHub fine-grained token (Quarr only, Contents: read and write) → Netlify GITHUB_DISPATCH_TOKEN" });
  } else {
    try {
      const r = await withTimeout(fetch(`https://api.github.com/repos/${repo}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }));
      out.push({ name: "Crawler wake-up", ok: r.ok, detail: r.ok ? `Token can reach ${repo}.` : `GitHub said ${r.status}. The token is wrong, expired, or not given access to ${repo}.` });
    } catch (e) {
      out.push({ name: "Crawler wake-up", ok: false, detail: `Couldn't reach GitHub: ${msg(e)}` });
    }
  }
  try {
    const [stuck, last] = await Promise.all([
      db.run.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } }),
      db.run.findFirst({ where: { crawledAt: { not: null } }, orderBy: { crawledAt: "desc" } }),
    ]);
    const waitMin = stuck ? Math.round((Date.now() - stuck.createdAt.getTime()) / 60000) : 0;
    out.push({
      name: "Crawler (GitHub Actions)",
      ok: stuck && waitMin > 10 ? false : last ? true : null,
      detail: stuck && waitMin > 10 ? `A run for ${stuck.domain} has waited ${waitMin} minutes. The crawler isn't picking up work.` : last ? `Last store walked: ${last.domain}, ${last.crawledAt!.toLocaleString("en-IN")}.` : "No store has been walked yet. Scan a store to test it.",
      fix: stuck && waitMin > 10 ? "GitHub → Actions → Crawl queued stores: open the latest run. If it says the secrets are missing, add DATABASE_URL, APP_URL, BLOBS_SITE_ID, BLOBS_TOKEN, SMTP_USER, SMTP_PASS in GitHub → Settings → Secrets → Actions." : undefined,
    });
  } catch {
    // Database check above already reports this.
  }

  // QUARR's AI (runs in the crawler, so its key lives in GitHub, not Netlify)
  try {
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const runs = await db.run.findMany({ where: { crawledAt: { gte: since } }, orderBy: { crawledAt: "desc" }, take: 20, select: { domain: true, ai: true } });
    const reports = runs.map((r) => ({ domain: r.domain, ai: r.ai as { status?: string; reason?: string; verified?: { confirmed: number; refuted: number; unsure: number }; usage?: { input: number; output: number; cacheRead: number } } | null }));
    const on = reports.filter((r) => r.ai?.status === "on").length;
    const last = reports[0];
    const lastProblem = reports.find((r) => r.ai && r.ai.status !== "on");
    const refuted = reports.reduce((n, r) => n + (r.ai?.verified?.refuted ?? 0), 0);
    const checked = reports.reduce((n, r) => n + (r.ai?.verified ? r.ai.verified.confirmed + r.ai.verified.refuted + r.ai.verified.unsure : 0), 0);
    out.push({
      name: "QUARR AI (Claude)",
      ok: !reports.length ? null : last?.ai?.status === "on" ? true : false,
      detail: !reports.length
        ? "No store walked in the last 14 days, so nothing to judge."
        : last?.ai?.status === "on"
          ? `Active on ${on} of the last ${reports.length} walks. It double-checked ${checked} findings and caught ${refuted} the rules got wrong.${lastProblem ? ` Last problem (${lastProblem.domain}): ${lastProblem.ai?.reason ?? lastProblem.ai?.status}.` : ""}`
          : `Not active on the last walk (${last?.domain}): ${last?.ai?.reason ?? "this walk ran before AI was added"}. Until it runs, nothing is shown to a founder without your review and nothing publishes on its own.`,
      fix: last?.ai?.status === "on" ? undefined : "console.anthropic.com → API keys → create a key → GitHub → Settings → Secrets → Actions → ANTHROPIC_API_KEY. Then Wake the crawler.",
    });
  } catch {
    // Database check above already reports this.
  }

  // Sign-in and payments
  out.push({ name: "Google sign-in", ok: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) || null, detail: process.env.GOOGLE_CLIENT_ID ? `Configured. Redirect URI must be ${appUrl("/auth/google/callback")}` : "Not set up: founders sign in with an email code only. That's fine to start.", fix: process.env.GOOGLE_CLIENT_ID ? undefined : "docs/DEPLOY.md step 5" });
  const rz = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  out.push({ name: "Payments (Razorpay)", ok: rz ? !!process.env.RAZORPAY_WEBHOOK_SECRET : null, detail: rz ? (process.env.RAZORPAY_WEBHOOK_SECRET ? `Configured (${process.env.RAZORPAY_KEY_ID!.startsWith("rzp_test") ? "test mode" : "live mode"}).` : "Keys set, but RAZORPAY_WEBHOOK_SECRET is missing, so payments made while a buyer closes the tab won't be recorded.") : "Not set up: buy buttons won't work yet.", fix: rz && process.env.RAZORPAY_WEBHOOK_SECRET ? undefined : "docs/DEPLOY.md step 6" });

  return out;
}
