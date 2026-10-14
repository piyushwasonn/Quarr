import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { sign, verify } from "./tokens";

const COOKIE = "quarr_bench";
const MAX_AGE = 60 * 60 * 24 * 14;

export function checkPassword(given: string) {
  const expected = process.env.BENCH_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function startBenchSession() {
  const store = await cookies();
  const expires = Date.now() + MAX_AGE * 1000;
  store.set(COOKIE, sign(`bench:${expires}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endBenchSession() {
  (await cookies()).delete(COOKIE);
}

export async function isBenchSession() {
  const value = verify((await cookies()).get(COOKIE)?.value);
  if (!value?.startsWith("bench:")) return false;
  return Number(value.slice(6)) > Date.now();
}

export async function requireBench() {
  if (!(await isBenchSession())) redirect("/bench/login");
}
