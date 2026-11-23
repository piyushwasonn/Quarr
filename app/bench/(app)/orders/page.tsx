import { markFulfilled } from "@/app/bench/actions";
import { db } from "@/lib/db";
import { rupees } from "@/lib/payments";

export default async function Orders() {
  const orders = await db.purchase.findMany({ where: { status: { in: ["PAID", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { email: true } } } });
  const open = orders.filter((o) => o.product === "JOURNEY" && o.status === "PAID" && !o.fulfilledAt);
  return (
    <div className="stack" style={{ ["--stack" as string]: "16px" }}>
      <h1>Orders</h1>
      {open.length ? <p className="alert">{open.length} paid {open.length === 1 ? "journey is" : "journeys are"} waiting. Email the founder within one working day to confirm scope.</p> : null}
      <div className="card table-wrap" style={{ boxShadow: "none" }}>
        <table className="data">
          <thead><tr><th>Paid</th><th>Founder</th><th>Product</th><th>Store</th><th>Amount</th><th>Payment</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="mini">{o.paidAt?.toLocaleString("en-IN") ?? "–"}</td>
                <td><a href={`mailto:${o.user.email}`}>{o.user.email}</a></td>
                <td><span className={`chip ${o.product === "JOURNEY" ? "brass" : ""}`}>{o.product === "JOURNEY" ? "Journey" : "Re-check credit"}</span></td>
                <td>{o.domain ?? "–"}{o.runId ? <div className="mini"><a href={`/bench/runs/${o.runId}`}>run</a></div> : null}</td>
                <td>{rupees(o.amountPaise)}<div className="mini">{rupees(o.basePaise)} + {rupees(o.gstPaise)} GST</div></td>
                <td className="mini">{o.provider}{o.paymentId ? ` · ${o.paymentId}` : ""}{o.status === "REFUNDED" ? " · refunded" : ""}</td>
                <td>
                  {o.product === "JOURNEY" && o.status === "PAID" ? (
                    o.fulfilledAt ? <span className="chip pass">delivered</span> : (
                      <form action={markFulfilled}><input type="hidden" name="id" value={o.id} /><button className="btn btn-ghost btn-sm">Mark delivered</button></form>
                    )
                  ) : null}
                </td>
              </tr>
            ))}
            {!orders.length ? <tr><td colSpan={7} className="muted">No paid orders yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
