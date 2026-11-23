import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { googleProfile } from "@/lib/google";
import { safeNext, startUserSession } from "@/lib/session";
import { verify } from "@/lib/tokens";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = verify(jar.get("quarr_oauth")?.value);
  jar.delete("quarr_oauth");
  const fail = (next = "/account") => NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(next)}&error=google`, req.url));
  if (!raw) return fail();
  const saved = JSON.parse(Buffer.from(raw, "base64url").toString()) as { state: string; verifier: string; next: string; at: number };
  const next = safeNext(saved.next);
  if (url.searchParams.get("state") !== saved.state || Date.now() - saved.at > 600_000) return fail(next);
  const code = url.searchParams.get("code");
  if (!code) return fail(next);
  try {
    const profile = await googleProfile(code, saved.verifier);
    if (!profile.email_verified) return fail(next);
    const email = profile.email.toLowerCase();
    const bySub = await db.user.findUnique({ where: { googleSub: profile.sub } });
    const user =
      bySub ??
      (await db.user.upsert({
        where: { email },
        create: { email, name: profile.name ?? null, googleSub: profile.sub },
        update: { googleSub: profile.sub, name: profile.name ?? undefined },
      }));
    await startUserSession(user.id);
    return NextResponse.redirect(new URL(next, req.url));
  } catch (err) {
    console.error("[google] sign-in failed", err);
    return fail(next);
  }
}
