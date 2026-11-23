import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkoutSignatureValid, markPaid } from "@/lib/payments";
import { currentUser } from "@/lib/session";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  if (!b.razorpay_order_id || !b.razorpay_payment_id || !b.razorpay_signature) return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
  const mine = await db.purchase.findFirst({ where: { providerOrderId: b.razorpay_order_id, userId: user.id } });
  if (!mine || !checkoutSignatureValid(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    return NextResponse.json({ error: "We couldn't verify that payment. If money left your account, it will be confirmed shortly or refunded." }, { status: 400 });
  }
  await markPaid(b.razorpay_order_id, b.razorpay_payment_id);
  return NextResponse.json({ ok: true });
}
