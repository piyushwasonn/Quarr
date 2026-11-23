"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashIp, newPublicToken } from "@/lib/tokens";
import { isValidEmail, normalizeStoreUrl } from "@/lib/url";

export type ScanState = { error?: string; url?: string };

const DAY = 24 * 60 * 60 * 1000;

// Landing page: start a quick, anonymous preview walk. No sign-up needed.
export async function startScan(_prev: ScanState, form: FormData): Promise<ScanState> {
  const url = String(form.get("url") ?? "");
  if (String(form.get("company") ?? "")) return { error: "Something went wrong. Please try again.", url }; // honeypot
  const store = normalizeStoreUrl(url);
  if (!store) return { error: "That doesn't look like a store address. Try something like yourbrand.in", url };
  if (form.get("consent") !== "on") return { error: "Please confirm you work on this store and are happy for us to visit it.", url };
  if (await db.removalRequest.findFirst({ where: { domain: store.domain } })) {
    return { error: "This store has asked us not to review it. If that's changed, write to us.", url };
  }

  const since = new Date(Date.now() - DAY);
  // One preview walk per store per day: reuse today's instead of visiting again.
  const recent = await db.run.findFirst({ where: { domain: store.domain, kind: "PREVIEW", createdAt: { gte: since }, status: { not: "CRAWL_FAILED" } }, orderBy: { createdAt: "desc" } });
  if (recent) redirect(`/scan/${recent.publicToken}`);

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip);
  if ((await db.run.count({ where: { ipHash, kind: "PREVIEW", createdAt: { gte: since } } })) >= 10) {
    return { error: "You've scanned several stores today. Please try again tomorrow.", url };
  }
  const run = await db.run.create({
    data: { publicToken: newPublicToken(), storeUrl: store.url, domain: store.domain, kind: "PREVIEW", priority: 0, ipHash, source: "PUBLIC" },
  });
  redirect(`/scan/${run.publicToken}`);
}

export async function requestRemoval(_prev: { done?: boolean; error?: string }, form: FormData) {
  const store = normalizeStoreUrl(String(form.get("url") ?? ""));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!store || !isValidEmail(email)) return { error: "Please enter your store address and an email we can reply to." };
  await db.removalRequest.create({ data: { domain: store.domain, email, note: String(form.get("note") ?? "").slice(0, 2000) || null } });
  return { done: true };
}
