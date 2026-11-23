import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devPaymentsAllowed, markPaid } from "@/lib/payments";
import { currentUser } from "@/lib/session";

// Local testing only: completes a "dev" order without Razorpay. Disabled when Razorpay keys exist.
export async function POST(req: Request) {
  if (!devPaymentsAllowed()) return new NextResponse("Not found", { status: 404 });
  const user = await currentUser();
  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  const mine = user && orderId ? await db.purchase.findFirst({ where: { providerOrderId: orderId, userId: user.id, provider: "dev" } }) : null;
  if (!mine) return NextResponse.json({ error: "Unknown order" }, { status: 400 });
  await markPaid(orderId!, `devpay_${Date.now()}`);
  return NextResponse.json({ ok: true });
}
