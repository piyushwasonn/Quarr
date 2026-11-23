"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Order = { mode: "razorpay" | "dev"; orderId: string; keyId: string; amount: number; name: string; email: string; error?: string };
type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckout() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay"));
    document.body.appendChild(s);
  });
}

export function BuyButton({ product, runId, label, className = "btn btn-primary" }: { product: "JOURNEY" | "RECHECK"; runId?: string; label: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = async (path: string, body: unknown) => {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new Error(j.error ?? "Payment could not be confirmed.");
    router.refresh();
  };

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/pay/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product, runId }) });
      const order = (await r.json()) as Order;
      if (!r.ok) throw new Error(order.error ?? "We couldn't start the payment.");
      if (order.mode === "dev") {
        if (window.confirm(`Test mode: simulate paying ₹${(order.amount / 100).toLocaleString("en-IN")} for "${order.name}"?`)) await done("/api/pay/dev-complete", { orderId: order.orderId });
        setBusy(false);
        return;
      }
      await loadCheckout();
      const rz = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: "INR",
        name: "QUARR",
        description: order.name,
        order_id: order.orderId,
        prefill: { email: order.email },
        theme: { color: "#1c3354" },
        handler: (resp: RazorpayResponse) => {
          done("/api/pay/verify", resp)
            .catch((e: Error) => setError(e.message))
            .finally(() => setBusy(false));
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ ["--stack" as string]: "8px" }}>
      <button type="button" className={className} onClick={buy} disabled={busy}>{busy ? "Opening payment…" : label}</button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
