import { handleRemoval } from "@/app/bench/actions";
import { db } from "@/lib/db";

export default async function Removals() {
  const reqs = await db.removalRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="stack" style={{ ["--stack" as string]: "16px" }}>
      <h1>Removal requests</h1>
      <p className="muted small">Handling a request deletes every run, screenshot and finding for that domain. The domain stays blocked from future requests.</p>
      <div className="card table-wrap" style={{ boxShadow: "none" }}>
        <table className="data">
          <thead><tr><th>Domain</th><th>Email</th><th>Note</th><th>Received</th><th></th></tr></thead>
          <tbody>
            {reqs.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.domain}</strong></td><td>{r.email}</td><td className="mini">{r.note}</td><td className="mini">{r.createdAt.toLocaleString("en-IN")}</td>
                <td>{r.handledAt ? <span className="chip pass">done</span> : <form action={handleRemoval}><input type="hidden" name="id" value={r.id} /><button className="btn btn-danger btn-sm">Delete data</button></form>}</td>
              </tr>
            ))}
            {!reqs.length ? <tr><td colSpan={5} className="muted">No requests.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
