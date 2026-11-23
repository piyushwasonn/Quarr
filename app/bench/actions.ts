"use server";

import type { EditReason, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, endBenchSession, requireBench, startBenchSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishRun } from "@/lib/deliver";
import { wakeCrawler } from "@/lib/crawler";
import { deletePrefix } from "@/lib/storage";
import { newPublicToken } from "@/lib/tokens";
import { isValidEmail, normalizeStoreUrl } from "@/lib/url";

const REASONS: EditReason[] = ["WORDING", "SEVERITY", "EVIDENCE_WRONG", "FALSE_POSITIVE", "MISSED", "UNSAFE"];
const reasonOf = (v: FormDataEntryValue | null) => (REASONS.includes(String(v) as EditReason) ? (String(v) as EditReason) : null);

export async function login(_prev: { error?: string }, form: FormData) {
  if (!checkPassword(String(form.get("password") ?? ""))) return { error: "That password isn't right." };
  await startBenchSession();
  redirect("/bench");
}

export async function logout() {
  await endBenchSession();
  redirect("/bench/login");
}

async function findingOrThrow(id: string) {
  return db.finding.findUniqueOrThrow({ where: { id }, include: { run: true } });
}

async function afterUnsafe(checkId: string, reason: EditReason | null, note: string | null) {
  if (reason !== "UNSAFE") return;
  await db.checkSetting.upsert({
    where: { checkId },
    create: { checkId, suspended: true, note: note ?? "Suspended after an UNSAFE edit" },
    update: { suspended: true, note: note ?? "Suspended after an UNSAFE edit" },
  });
}

export async function approveFinding(form: FormData) {
  await requireBench();
  const f = await findingOrThrow(String(form.get("id")));
  await db.$transaction([
    db.finding.update({ where: { id: f.id }, data: { state: "APPROVED", reviewedAt: new Date(), editReason: null } }),
    db.reviewEvent.create({ data: { runId: f.runId, findingId: f.id, checkId: f.checkId, action: "APPROVE" } }),
  ]);
  revalidatePath(`/bench/runs/${f.runId}`);
}

export async function editFinding(_prev: { error?: string; ok?: boolean }, form: FormData) {
  await requireBench();
  const f = await findingOrThrow(String(form.get("id")));
  const reason = reasonOf(form.get("reason"));
  if (!reason) return { error: "Choose why you edited it." };
  const note = String(form.get("note") ?? "").trim() || null;
  const data = {
    title: String(form.get("title") ?? f.title).trim(),
    observed: String(form.get("observed") ?? f.observed).trim(),
    likelyEffect: String(form.get("likelyEffect") ?? f.likelyEffect).trim(),
    notYetProven: String(form.get("notYetProven") ?? f.notYetProven).trim(),
  };
  if (Object.values(data).some((v) => !v)) return { error: "Every field needs text." };
  await db.$transaction([
    db.finding.update({ where: { id: f.id }, data: { ...data, state: "EDITED", editReason: reason, editNote: note, reviewedAt: new Date() } }),
    db.reviewEvent.create({ data: { runId: f.runId, findingId: f.id, checkId: f.checkId, action: "EDIT", reason, note } }),
  ]);
  await afterUnsafe(f.checkId, reason, note);
  revalidatePath(`/bench/runs/${f.runId}`);
  return { ok: true };
}

export async function dropFinding(_prev: { error?: string; ok?: boolean }, form: FormData) {
  await requireBench();
  const f = await findingOrThrow(String(form.get("id")));
  const reason = reasonOf(form.get("reason"));
  if (!reason) return { error: "Choose why you dropped it." };
  const note = String(form.get("note") ?? "").trim() || null;
  await db.$transaction([
    db.finding.update({ where: { id: f.id }, data: { state: "DROPPED", selected: false, position: null, editReason: reason, editNote: note, reviewedAt: new Date() } }),
    db.reviewEvent.create({ data: { runId: f.runId, findingId: f.id, checkId: f.checkId, action: "DROP", reason, note } }),
  ]);
  await afterUnsafe(f.checkId, reason, note);
  await compactPositions(f.runId);
  revalidatePath(`/bench/runs/${f.runId}`);
  return { ok: true };
}

export async function promoteFinding(form: FormData) {
  await requireBench();
  const f = await findingOrThrow(String(form.get("id")));
  const shown = await db.finding.count({ where: { runId: f.runId, selected: true, state: { not: "DROPPED" } } });
  if (shown >= 3) return;
  await db.$transaction([
    db.finding.update({ where: { id: f.id }, data: { selected: true, position: shown, state: "DRAFT" } }),
    db.reviewEvent.create({ data: { runId: f.runId, findingId: f.id, checkId: f.checkId, action: "PROMOTE", reason: "MISSED" } }),
  ]);
  await recountOthers(f.runId);
  revalidatePath(`/bench/runs/${f.runId}`);
}

export async function moveFinding(form: FormData) {
  await requireBench();
  const f = await findingOrThrow(String(form.get("id")));
  const dir = form.get("dir") === "up" ? -1 : 1;
  const list = await db.finding.findMany({ where: { runId: f.runId, selected: true, state: { not: "DROPPED" } }, orderBy: { position: "asc" } });
  const i = list.findIndex((x) => x.id === f.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction([
    ...list.map((x, idx) => db.finding.update({ where: { id: x.id }, data: { position: idx } })),
    db.reviewEvent.create({ data: { runId: f.runId, findingId: f.id, checkId: f.checkId, action: "EDIT", reason: "SEVERITY", note: `Moved ${dir < 0 ? "up" : "down"}` } }),
  ]);
  revalidatePath(`/bench/runs/${f.runId}`);
}

async function compactPositions(runId: string) {
  const list = await db.finding.findMany({ where: { runId, selected: true, state: { not: "DROPPED" } }, orderBy: { position: "asc" } });
  await db.$transaction(list.map((x, idx) => db.finding.update({ where: { id: x.id }, data: { position: idx } })));
  await recountOthers(runId);
}

async function recountOthers(runId: string) {
  const rest = await db.finding.findMany({ where: { runId, selected: false, state: { not: "DROPPED" } }, select: { lens: true } });
  await db.run.update({ where: { id: runId }, data: { otherIssues: rest.length, otherLenses: new Set(rest.map((r) => r.lens)).size } });
}

export async function publish(_prev: { error?: string }, form: FormData) {
  await requireBench();
  const runId = String(form.get("runId"));
  const run = await db.run.findUniqueOrThrow({ where: { id: runId }, include: { findings: { where: { selected: true, state: { not: "DROPPED" } } } } });
  if (!["IN_REVIEW", "DRAFTED", "APPROVED"].includes(run.status)) return { error: `Run is ${run.status}.` };
  const undecided = run.findings.filter((f) => f.state === "DRAFT");
  if (undecided.length) return { error: `Approve, edit or drop ${undecided.length} more ${undecided.length === 1 ? "finding" : "findings"} first.` };
  const reviewSeconds = run.reviewStartAt ? Math.round((Date.now() - run.reviewStartAt.getTime()) / 1000) : null;
  await db.run.update({ where: { id: runId }, data: { status: "APPROVED", reviewSeconds } });
  await publishRun(runId);
  revalidatePath("/bench");
  redirect(`/bench/runs/${runId}`);
}

export async function rejectRun(form: FormData) {
  await requireBench();
  const runId = String(form.get("runId"));
  await db.run.update({ where: { id: runId }, data: { status: "REJECTED", notes: String(form.get("note") ?? "") || null } });
  revalidatePath(`/bench/runs/${runId}`);
}

export async function requeueRun(form: FormData) {
  await requireBench();
  const runId = String(form.get("runId"));
  await db.$transaction([
    db.finding.deleteMany({ where: { runId } }),
    db.checkResult.deleteMany({ where: { runId } }),
    db.page.deleteMany({ where: { runId } }),
    db.run.update({ where: { id: runId }, data: { status: "QUEUED", failureCode: null, failureDetail: null, attempts: 0, lockedAt: null, reviewStartAt: null, autoPublished: false } }),
  ]);
  await wakeCrawler("bench re-run");
  revalidatePath("/bench");
  redirect("/bench");
}

export async function markFunnel(form: FormData) {
  await requireBench();
  const runId = String(form.get("runId"));
  const field = String(form.get("field"));
  const data: Prisma.RunUpdateInput = {};
  if (field === "replied") data.repliedAt = new Date();
  if (field === "paid") data.paidAt = new Date();
  if (field === "delivered") {
    data.deliveredAt = new Date();
    data.status = "DELIVERED";
  }
  await db.run.update({ where: { id: runId }, data });
  revalidatePath(`/bench/runs/${runId}`);
}

export async function queueRuns(_prev: { error?: string; queued?: number }, form: FormData) {
  await requireBench();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return { error: "Enter the email the reports should be tied to (yours, for outreach)." };
  const lines = String(form.get("urls") ?? "").split(/\s+/).map((s) => s.trim()).filter(Boolean);
  let queued = 0;
  for (const line of lines.slice(0, 100)) {
    const n = normalizeStoreUrl(line);
    if (!n) continue;
    if (await db.removalRequest.findFirst({ where: { domain: n.domain } })) continue;
    await db.run.create({ data: { publicToken: newPublicToken(), storeUrl: n.url, domain: n.domain, email, source: "BENCH" } });
    queued++;
  }
  if (queued) await wakeCrawler(`bench queued ${queued}`);
  revalidatePath("/bench");
  return { queued };
}

export async function toggleSuspend(form: FormData) {
  await requireBench();
  const checkId = String(form.get("checkId"));
  const cur = await db.checkSetting.findUnique({ where: { checkId } });
  await db.checkSetting.upsert({ where: { checkId }, create: { checkId, suspended: true }, update: { suspended: !cur?.suspended } });
  revalidatePath("/bench/checks");
}

export async function handleRemoval(form: FormData) {
  await requireBench();
  const req = await db.removalRequest.findUniqueOrThrow({ where: { id: String(form.get("id")) } });
  const runs = await db.run.findMany({ where: { domain: req.domain }, select: { id: true } });
  for (const r of runs) {
    await deletePrefix(`runs/${r.id}/`);
  }
  await db.run.deleteMany({ where: { domain: req.domain } });
  await db.removalRequest.update({ where: { id: req.id }, data: { handledAt: new Date() } });
  revalidatePath("/bench/removals");
}

export async function markFulfilled(form: FormData) {
  await requireBench();
  await db.purchase.update({ where: { id: String(form.get("id")) }, data: { fulfilledAt: new Date() } });
  revalidatePath("/bench/orders");
}

export async function wakeNow() {
  await requireBench();
  await wakeCrawler("bench health check");
  revalidatePath("/bench/health");
}
