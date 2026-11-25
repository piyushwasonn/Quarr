import { whatToDo } from "@/engine/checks/fixes";
import { recheckHeadline } from "@/engine/summary";
import { db } from "./db";
import { appUrl, sendEmail } from "./email";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Make the report visible at its private link, then email founder-submitted runs.
export async function publishRun(runId: string) {
  const run = await db.run.update({
    where: { id: runId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    include: { findings: { where: { selected: true, state: { not: "DROPPED" } }, orderBy: { position: "asc" }, include: { checkResult: { select: { detail: true } } } } },
  });
  if (run.source !== "PUBLIC" || !run.email) return run;

  const link = appUrl(`/r/${run.publicToken}`);
  const store = run.storeName || run.domain;
  const steps = run.findings.map((f) => f.whatToDo || whatToDo(f.checkId, f.checkResult.detail, run.platform));
  const items = run.findings.flatMap((f, i) => [`${i + 1}. ${f.title}`, steps[i] ? `   What to do: ${steps[i]}` : ""].filter(Boolean));
  // Only a person-reviewed report may say a person reviewed it.
  const checkedBy = run.autoPublished
    ? "Every finding was checked before it reached you, by QUARR checks that have each held up in 30 expert reviews in a row."
    : "A QUARR Expert checked every finding before it reached you.";
  const subject = `Your QUARR First Look for ${run.domain}: what to fix first`;
  const text = [
    `Here's what a first-time buyer meets on ${store}, and what to fix first.`,
    "",
    items.length ? "What to fix first:" : "We found nothing serious enough to lead with, which is a good result.",
    ...items,
    "",
    `Read your First Look, with a screenshot behind every finding: ${link}`,
    "",
    checkedBy,
    "QUARR",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#F7F9FC;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#1F2933">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #DDE2E8;border-radius:12px" cellpadding="0" cellspacing="0">
  <tr><td style="padding:28px 28px 4px"><img src="${appUrl("/brand/quarr-logo-on-white.png")}" width="168" alt="QUARR" style="display:block;border:0;width:168px;height:auto"></td></tr>
  <tr><td style="padding:12px 28px 8px;font-size:12px;letter-spacing:.14em;color:#4F6275">FIRST LOOK</td></tr>
  <tr><td style="padding:0 28px;font-family:Manrope,Inter,Arial,sans-serif;font-weight:700;font-size:22px;line-height:1.3;color:#0B1F44">Here's what a first-time buyer meets on ${esc(store)}, and what to fix first.</td></tr>
  <tr><td style="padding:16px 28px 0;font-size:15px;line-height:1.6">${
    items.length
      ? `<ol style="padding-left:20px;margin:8px 0">${run.findings.map((f, i) => `<li style="margin:10px 0"><strong>${esc(f.title)}</strong>${steps[i] ? `<br><span style="color:#1F6B4A">What to do:</span> ${esc(steps[i])}` : ""}</li>`).join("")}</ol>`
      : "We found nothing serious enough to lead with, which is a good result."
  }</td></tr>
  <tr><td style="padding:20px 28px"><a href="${link}" style="display:inline-block;background:#0B1F44;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Read your First Look</a></td></tr>
  <tr><td style="padding:0 28px 28px;font-size:13px;color:#5B6675;line-height:1.5">Every finding links to the screenshot it came from. ${esc(checkedBy)}</td></tr>
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
  if (!run.email) return;
  const why = FAILURE_COPY[run.failureCode ?? "ERROR"] ?? FAILURE_COPY.ERROR;
  const text = `${why}\n\nIf you reply to this email, a QUARR Expert will do your First Look by hand instead, at no cost.\n\nQUARR`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1F2933;max-width:520px">
  <p>${esc(why)}</p><p>If you reply to this email, a QUARR Expert will do your First Look by hand instead, at no cost.</p><p>QUARR</p></div>`;
  await sendEmail(run.email, `About your QUARR First Look for ${run.domain}`, html, text);
}

export async function sendRecheckEmail(runId: string) {
  const run = await db.run.findUniqueOrThrow({ where: { id: runId } });
  if (!run.email) return;
  const { headline, line, fixed, total } = recheckHeadline((run.summary ?? {}) as Parameters<typeof recheckHeadline>[0]);
  const link = appUrl(`/account/runs/${run.id}`);
  const text = `${headline}\n${line}\n\nWe walked ${run.domain} again and compared it with your last First Look. See exactly what changed: ${link}\n\nQUARR`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1F2933;max-width:520px">
  <p style="font-size:20px;color:#14243B;margin-bottom:4px"><strong>${esc(headline)}</strong></p>
  <p style="margin-top:0;color:#5B6675">${esc(line)}</p>
  <p>We walked <strong>${esc(run.domain)}</strong> again and compared it with your last First Look.</p>
  <p><a href="${link}" style="display:inline-block;background:#0B1F44;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">See what changed</a></p></div>`;
  await sendEmail(run.email, `Your QUARR re-check for ${run.domain}: ${total ? `you fixed ${fixed} of ${total}` : "nothing was left open"}`, html, text);
}
