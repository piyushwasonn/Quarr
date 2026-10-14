"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashIp, newPublicToken } from "@/lib/tokens";
import { isValidEmail, normalizeStoreUrl } from "@/lib/url";

export type SubmitState = { error?: string; values?: { url: string; email: string } };

const DAY = 24 * 60 * 60 * 1000;

export async function submitFirstLook(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const rawUrl = String(form.get("url") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const values = { url: rawUrl, email };

  if (String(form.get("company") ?? "")) return { error: "Something went wrong. Please try again.", values }; // honeypot
  const store = normalizeStoreUrl(rawUrl);
  if (!store) return { error: "That doesn't look like a store address. Try something like yourbrand.in", values };
  if (!isValidEmail(email)) return { error: "Please enter an email address we can send your First Look to.", values };
  if (form.get("consent") !== "on") return { error: "Please confirm you work on this store and are happy for us to visit it.", values };

  const since = new Date(Date.now() - DAY);
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip);

  if (await db.removalRequest.findFirst({ where: { domain: store.domain } })) {
    return { error: "This store has asked us not to review it. If that's changed, write to us.", values };
  }
  const recent = await db.run.findFirst({ where: { domain: store.domain, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
  if (recent) {
    if (recent.email === email) redirect(`/s/${recent.publicToken}`);
    return { error: "This store already had a First Look in the last 24 hours. Please try again tomorrow.", values };
  }
  const [byEmail, byIp] = await Promise.all([
    db.run.count({ where: { email, createdAt: { gte: since } } }),
    db.run.count({ where: { ipHash, createdAt: { gte: since } } }),
  ]);
  if (byEmail >= 3 || byIp >= 5) return { error: "You've requested several First Looks today. Please try again tomorrow.", values };

  const run = await db.run.create({
    data: { publicToken: newPublicToken(), storeUrl: store.url, domain: store.domain, email, ipHash, source: "PUBLIC" },
  });
  redirect(`/s/${run.publicToken}`);
}

export async function requestRemoval(_prev: { done?: boolean; error?: string }, form: FormData) {
  const store = normalizeStoreUrl(String(form.get("url") ?? ""));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!store || !isValidEmail(email)) return { error: "Please enter your store address and an email we can reply to." };
  await db.removalRequest.create({ data: { domain: store.domain, email, note: String(form.get("note") ?? "").slice(0, 2000) || null } });
  return { done: true };
}
