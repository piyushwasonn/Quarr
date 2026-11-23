import { createHmac, timingSafeEqual } from "node:crypto";
import type { Product, User } from "@prisma/client";
import { db } from "./db";
import { appUrl, sendEmail } from "./email";

// Prices in paise, before GST. GST_RATE must be 0 if QUARR is not GST-registered.
export const PRODUCTS: Record<Product, { name: string; basePaise: number; blurb: string }> = {
  JOURNEY: { name: "First-purchase journey", basePaise: Number(process.env.PRICE_JOURNEY_PAISE || 500_000), blurb: "A QUARR Expert walks your whole path to a first order and gives you a prioritised action guide." },
  RECHECK: { name: "Re-check credit", basePaise: Number(process.env.PRICE_RECHECK_PAISE || 49_900), blurb: "Re-walk your store after fixes and see what's fixed, still open or new." },
};

export const gstRate = () => Number(process.env.GST_RATE ?? "0.18");

export function priceOf(product: Product) {
  const base = PRODUCTS[product].basePaise;
  const gst = Math.round(base * gstRate());
  return { basePaise: base, gstPaise: gst, amountPaise: base + gst };
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const keyId = () => process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET ?? "";
export const razorpayConfigured = () => !!(keyId() && keySecret());
export const devPaymentsAllowed = () => !razorpayConfigured() && process.env.PAYMENTS_DEV === "1";

export async function createOrder(user: User, product: Product, runId: string | null) {
  const run = runId ? await db.run.findFirst({ where: { id: runId, userId: user.id } }) : null;
  const price = priceOf(product);
  const purchase = await db.purchase.create({
    data: { userId: user.id, product, runId: run?.id ?? null, domain: run?.domain ?? null, ...price, provider: razorpayConfigured() ? "razorpay" : "dev" },
  });

  if (razorpayConfigured()) {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: price.amountPaise, currency: "INR", receipt: purchase.id, notes: { product, purchaseId: purchase.id, domain: run?.domain ?? "" } }),
    });
    if (!res.ok) {
      await db.purchase.update({ where: { id: purchase.id }, data: { status: "FAILED", note: `Order failed: ${res.status}` } });
      throw new Error(`Razorpay order failed: ${res.status}`);
    }
    const order = (await res.json()) as { id: string };
    await db.purchase.update({ where: { id: purchase.id }, data: { providerOrderId: order.id } });
    return { mode: "razorpay" as const, orderId: order.id, keyId: keyId(), amount: price.amountPaise, name: PRODUCTS[product].name, email: user.email };
  }
  if (!devPaymentsAllowed()) throw new Error("Payments are not configured");
  const orderId = `dev_${purchase.id}`;
  await db.purchase.update({ where: { id: purchase.id }, data: { providerOrderId: orderId } });
  return { mode: "dev" as const, orderId, keyId: "", amount: price.amountPaise, name: PRODUCTS[product].name, email: user.email };
}

const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Signature from Razorpay Checkout: HMAC-SHA256(order_id|payment_id, key secret).
export function checkoutSignatureValid(orderId: string, paymentId: string, signature: string) {
  return razorpayConfigured() && same(hmacHex(keySecret(), `${orderId}|${paymentId}`), signature);
}

// Webhook signature: HMAC-SHA256(raw body, webhook secret).
export function webhookSignatureValid(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  return !!secret && same(hmacHex(secret, rawBody), signature);
}

// Idempotent: called by the checkout handler and again by the webhook.
export async function markPaid(orderId: string, paymentId: string) {
  const updated = await db.purchase.updateMany({ where: { providerOrderId: orderId, status: "CREATED" }, data: { status: "PAID", paymentId, paidAt: new Date() } });
  if (!updated.count) return;
  const p = await db.purchase.findUniqueOrThrow({ where: { providerOrderId: orderId }, include: { user: true } });
  if (p.product === "JOURNEY") {
    if (p.runId) await db.run.update({ where: { id: p.runId }, data: { paidAt: new Date() } }).catch(() => {});
    const admin = process.env.ADMIN_EMAIL;
    if (admin) {
      await sendEmail(admin, `Journey paid: ${p.domain ?? p.user.email}`, `<p>${p.user.email} paid ${rupees(p.amountPaise)} for a journey on ${p.domain ?? "(no store)"}.</p><p><a href="${appUrl("/bench/orders")}">Open orders</a></p>`, `${p.user.email} paid ${rupees(p.amountPaise)} for a journey on ${p.domain ?? "(no store)"}. ${appUrl("/bench/orders")}`).catch(() => {});
    }
    await sendEmail(
      p.user.email,
      "Your QUARR journey is booked",
      `<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1F2933;max-width:520px"><p>Thank you. Your first-purchase journey${p.domain ? ` for <strong>${p.domain}</strong>` : ""} is booked.</p><p>We'll email you within one working day to confirm the scope. If the scope doesn't fit what you need, we'll refund you in full.</p><p>QUARR</p></div>`,
      `Thank you. Your first-purchase journey${p.domain ? ` for ${p.domain}` : ""} is booked. We'll email you within one working day to confirm the scope. If the scope doesn't fit, we'll refund you in full.`,
    ).catch(() => {});
  }
}
