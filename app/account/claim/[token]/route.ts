import { NextResponse } from "next/server";
import { appUrl } from "@/lib/email";
import { claimPreview } from "@/lib/runs";
import { currentUser } from "@/lib/session";

// Turns a preview into the founder's full First Look right after sign-up.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.redirect(appUrl(`/signin?next=${encodeURIComponent(`/account/claim/${token}`)}`));
  const run = await claimPreview(user, token);
  if (!run) return NextResponse.redirect(appUrl("/account?notice=claimed"));
  return NextResponse.redirect(appUrl(`/account/runs/${run.id}`));
}
