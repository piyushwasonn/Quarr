import { db } from "./db";
import { appUrl, sendEmail } from "./email";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Make the report visible at its private link, then email founder-submitted runs.
export async function publishRun(runId: string) {
  const run = await db.run.update({
    where: { id: runId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    include: { findings: { where: { selected: true, state: { not: "DROPPED" } }, orderBy: { position: "asc" } } },
  });
  if (run.source !== "PUBLIC") return run;

  const link = appUrl(`/r/${run.publicToken}`);
  const items = run.findings.map((f, i) => `${i + 1}. ${f.title}`);
  const subject = `Your QUARR First Look for ${run.domain} is ready`;
  const text = [
    `We walked ${run.domain} the way a first-time buyer would.`,
    "",
    items.length ? "What stood out:" : "We found nothing serious enough to lead with, which is a good result.",
    ...items,
    "",
    `Read the full First Look, with a screenshot behind every finding: ${link}`,
    "",
    "Every report is reviewed by a QUARR Expert before it's sent.",
    "QUARR",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#F5F6F8;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#1F2933">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #DDE2E8;border-radius:12px" cellpadding="0" cellspacing="0">
  <tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:.14em;color:#5B6675">QUARR · FIRST LOOK</td></tr>
  <tr><td style="padding:0 28px;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#14243B">We walked ${esc(run.domain)} as a first-time buyer.</td></tr>
  <tr><td style="padding:16px 28px 0;font-size:15px;line-height:1.6">${
    items.length
      ? `Here's what stood out:<ol style="padding-left:20px;margin:8px 0">${run.findings.map((f) => `<li style="margin:6px 0">${esc(f.title)}</li>`).join("")}</ol>`
      : "We found nothing serious enough to lead with, which is a good result."
  }</td></tr>
  <tr><td style="padding:20px 28px"><a href="${link}" style="display:inline-block;background:#1C3354;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Read your First Look</a></td></tr>
  <tr><td style="padding:0 28px 28px;font-size:13px;color:#5B6675;line-height:1.5">Every finding links to the screenshot it came from. Every report is reviewed by a QUARR Expert before it's sent.</td></tr>
  </table></td></tr></table></body></html>`;

  await sendEmail(run.email, subject, html, text);
  return db.run.update({ where: { id: runId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
}

const FAILURE_COPY: Record<string, string> = {
  BLOCKED: "Your store's bot protection stopped our browser before it could load the homepage, so we couldn't walk it the way a buyer would.",
  PASSWORD: "Your store is behind a password page, so there was nothing a buyer (or we) could see yet.",
  NOT_STORE: "We couldn't find any products on the site, so this doesn't look like an online store we can review.",
  UNREACHABLE: "We couldn't load the address you gave us.",
  TIMEOUT: "Your store took longer to walk through than our limit allows, so we stopped rather than send you something half-finished.",
  ERROR: "Something went wrong on our side while walking your store.",
};

export async function sendFailureEmail(runId: string) {
  const run = await db.run.findUniqueOrThrow({ where: { id: runId } });
  const why = FAILURE_COPY[run.failureCode ?? "ERROR"] ?? FAILURE_COPY.ERROR;
  const text = `${why}\n\nIf you reply to this email, a QUARR Expert will do your First Look by hand instead, at no cost.\n\nQUARR`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1F2933;max-width:520px">
  <p>${esc(why)}</p><p>If you reply to this email, a QUARR Expert will do your First Look by hand instead, at no cost.</p><p>QUARR</p></div>`;
  await sendEmail(run.email, `About your QUARR First Look for ${run.domain}`, html, text);
}
