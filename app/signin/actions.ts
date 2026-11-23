"use server";

import { redirect } from "next/navigation";
import { sendLoginCode, verifyLoginCode } from "@/lib/login-code";
import { safeNext, startUserSession } from "@/lib/session";
import { isValidEmail } from "@/lib/url";

export type SignInState = { step: "email" | "code"; email?: string; error?: string; next: string };

export async function signInStep(prev: SignInState, form: FormData): Promise<SignInState> {
  const next = safeNext(String(form.get("next") ?? prev.next));
  if (form.get("intent") === "restart") return { step: "email", next };

  if (prev.step === "email" || form.get("intent") === "resend") {
    const email = String(form.get("email") ?? prev.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) return { step: "email", email, next, error: "Please enter a valid email address." };
    const sent = await sendLoginCode(email);
    if (!sent.ok) return { step: prev.step, email, next, error: sent.error };
    return { step: "code", email, next };
  }

  const email = prev.email ?? "";
  const res = await verifyLoginCode(email, String(form.get("code") ?? ""));
  if (!res.ok) return { step: "code", email, next, error: res.error };
  await startUserSession(res.userId);
  redirect(next);
}
