import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { sign, verify } from "./tokens";

// Founder sessions. Separate from the Bench session on purpose.
const COOKIE = "quarr_user";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function startUserSession(userId: string) {
  const expires = Date.now() + MAX_AGE * 1000;
  (await cookies()).set(COOKIE, sign(`u:${userId}:${expires}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
}

export async function endUserSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const value = verify((await cookies()).get(COOKIE)?.value);
  if (!value?.startsWith("u:")) return null;
  const [, id, expires] = value.split(":");
  if (Number(expires) < Date.now()) return null;
  return db.user.findUnique({ where: { id } });
}

export async function requireUser(next = "/account") {
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return user;
}

// Only ever redirect within QUARR after sign-in.
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/account";
  return next;
}
