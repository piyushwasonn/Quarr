import { NextResponse } from "next/server";
import { createOrder } from "@/lib/payments";
import { currentUser } from "@/lib/session";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { product?: string; runId?: string };
  if (body.product !== "JOURNEY" && body.product !== "RECHECK") return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  try {
    return NextResponse.json(await createOrder(user, body.product, body.runId ?? null));
  } catch (err) {
    console.error("[pay] order", err);
    return NextResponse.json({ error: "We couldn't start the payment. Please try again." }, { status: 502 });
  }
}
