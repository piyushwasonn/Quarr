import { NextResponse } from "next/server";
import { markPaid, webhookSignatureValid } from "@/lib/payments";

// Razorpay webhook (payment.captured / order.paid). Backs up the checkout handler
// when the buyer closes the tab before we hear back.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!webhookSignatureValid(raw, req.headers.get("x-razorpay-signature") ?? "")) return new NextResponse("Bad signature", { status: 400 });
  const evt = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string } }; order?: { entity?: { id: string } } } };
  const payment = evt.payload?.payment?.entity;
  if ((evt.event === "payment.captured" || evt.event === "order.paid") && payment?.order_id) await markPaid(payment.order_id, payment.id);
  return NextResponse.json({ ok: true });
}
