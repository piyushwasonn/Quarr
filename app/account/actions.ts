"use server";

import { redirect } from "next/navigation";
import { startRecheck } from "@/lib/runs";
import { endUserSession, requireUser } from "@/lib/session";

export async function signOut() {
  await endUserSession();
  redirect("/");
}

export async function recheck(_prev: { error?: string }, form: FormData) {
  const user = await requireUser();
  const res = await startRecheck(user, String(form.get("runId") ?? ""));
  if (!res.ok) return { error: res.error };
  redirect(`/account/runs/${res.id}`);
}
