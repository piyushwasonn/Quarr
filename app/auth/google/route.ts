import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured, newPkce } from "@/lib/google";
import { safeNext } from "@/lib/session";
import { sign } from "@/lib/tokens";

export async function GET(req: Request) {
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  if (!googleConfigured()) return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(next)}&error=google`, req.url));
  const { verifier, challenge, state } = newPkce();
  (await cookies()).set("quarr_oauth", sign(Buffer.from(JSON.stringify({ state, verifier, next, at: Date.now() })).toString("base64url")), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state, challenge));
}
