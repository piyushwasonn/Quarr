import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { sendEmail } from "./email";

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 15 * 60 * 1000;

const hash = (email: string, code: string) => createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}:${email}:${code}`).digest("hex");

export async function sendLoginCode(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const recent = await db.loginCode.count({ where: { email, createdAt: { gte: new Date(Date.now() - SEND_WINDOW_MS) } } });
  if (recent >= MAX_SENDS_PER_WINDOW) return { ok: false, error: "We've sent a few codes already. Please wait a few minutes and try again." };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.loginCode.create({ data: { email, codeHash: hash(email, code), expiresAt: new Date(Date.now() + TTL_MS) } });
  await sendEmail(
    email,
    `${code} is your QUARR sign-in code`,
    `<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#1F2933;max-width:480px"><p>Your QUARR sign-in code:</p><p style="font-size:32px;letter-spacing:6px;font-weight:700;color:#14243B">${code}</p><p style="color:#5B6675;font-size:14px">It works for 10 minutes. If you didn't ask for it, ignore this email.</p></div>`,
    `Your QUARR sign-in code: ${code}\n\nIt works for 10 minutes. If you didn't ask for it, ignore this email.`,
  );
  return { ok: true };
}

export async function verifyLoginCode(email: string, code: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const row = await db.loginCode.findFirst({ where: { email, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!row) return { ok: false, error: "That code has expired. Ask for a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many tries. Ask for a new code." };
  await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
  const a = Buffer.from(row.codeHash);
  const b = Buffer.from(hash(email, code.replace(/\D/g, "")));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "That code isn't right. Check the email and try again." };
  await db.loginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  const user = await db.user.upsert({ where: { email }, create: { email }, update: {} });
  return { ok: true, userId: user.id };
}
