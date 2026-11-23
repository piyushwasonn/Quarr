import { NextResponse } from "next/server";
import { claimPreview } from "@/lib/runs";
import { currentUser } from "@/lib/session";

// Turns a preview into the founder's full First Look right after sign-up.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(`/account/claim/${token}`)}`, req.url));
  const run = await claimPreview(user, token);
  if (!run) return NextResponse.redirect(new URL("/account?notice=claimed", req.url));
  return NextResponse.redirect(new URL(`/account/runs/${run.id}`, req.url));
}
