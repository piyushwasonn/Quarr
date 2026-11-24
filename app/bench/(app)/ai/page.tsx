import { Prisma } from "@prisma/client";
import Link from "next/link";
import { compareProviders, costUsd, type ProviderScore } from "@/engine/ai/compare";
import { db } from "@/lib/db";

// Which AI provider gets your stores right? Scored against your own Bench decisions.
export default async function AiComparison() {
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const runs = await db.run.findMany({
    where: { crawledAt: { gte: since }, ai: { not: Prisma.DbNull } },
    orderBy: { crawledAt: "desc" },
    take: 300,
    select: {
      ai: true,
      findings: { select: { checkId: true, state: true, editReason: true, checkResult: { select: { ai: true, detail: true } } } },
      results: { where: { checkId: { startsWith: "AI-" } }, select: { checkId: true, outcome: true } },
    },
  });
  const scores = compareProviders(
    runs.map((r) => ({ ai: r.ai, results: r.results, findings: r.findings.map((f) => ({ checkId: f.checkId, state: f.state, editReason: f.editReason, ai: f.checkResult.ai, detail: f.checkResult.detail })) })),
  );
  const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "–");
  const inr = Number(process.env.INR_PER_USD ?? 90);

  return (
    <div className="stack" style={{ ["--stack" as string]: "20px" }}>
      <div className="stack" style={{ ["--stack" as string]: "6px" }}>
        <h1>AI comparison</h1>
        <p className="muted small" style={{ maxWidth: 800 }}>
          Each provider is scored against your Bench decisions on the same findings: approved or edited means the finding was real; dropped as false positive or wrong evidence means it wasn&apos;t. The <strong>shadow</strong> provider reads the same pages but never changes what a founder sees. Turn it on with the GitHub variable <code>QUARR_AI_SHADOW</code>. The most costly mistake is <strong>hid a real problem</strong>: the AI overturned a finding you kept.
        </p>
      </div>
      {!scores.length ? (
        <p className="card card-pad muted">No AI runs in the last 90 days yet. Add a key (docs/DEPLOY.md step 7), walk a few stores and review them.</p>
      ) : (
        <div className="card table-wrap" style={{ boxShadow: "none" }}>
          <table className="data">
            <thead>
              <tr>
                <th>Provider</th><th>Role</th><th title="Runs, and runs where the AI actually ran">Runs</th><th title="Findings you approved, edited, or dropped as wrong">Reviewed</th><th>Agreed</th><th title="Overturned a finding you kept">Hid real</th><th title="Confirmed a finding you dropped as wrong">Let wrong</th><th>Unsure</th><th title="AI-judged findings you kept">AI checks</th><th title="AI-judged failures only the shadow raised; nobody has reviewed these">Shadow-only</th><th>Time</th><th>Cost / run</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s: ProviderScore) => {
                const cost = costUsd(s.model, s.usage);
                return (
                  <tr key={`${s.role}${s.provider}${s.model}`}>
                    <td><strong>{s.provider}</strong><div className="mini">{s.model}</div></td>
                    <td>{s.role}</td>
                    <td>{s.runs} ({s.ran})</td>
                    <td>{s.reviewed}</td>
                    <td>{s.agreed} <span className="mini">{pct(s.agreed, s.reviewed)}</span></td>
                    <td>{s.hidReal ? <span className="chip fail">{s.hidReal}</span> : 0}</td>
                    <td>{s.letWrong}</td>
                    <td>{s.unsure}</td>
                    <td>{s.judgedReviewed ? `${s.judgedAgreed} of ${s.judgedReviewed}` : "–"}</td>
                    <td>{s.role === "shadow" ? s.shadowOnlyFails : "–"}</td>
                    <td>{s.runs ? `${Math.round(s.ms / s.runs / 1000)} s` : "–"}</td>
                    <td>{cost !== null && s.runs ? `$${(cost / s.runs).toFixed(3)} (₹${Math.round((cost / s.runs) * inr)})` : <span className="mini">price not set</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mini muted">
        Cost uses list prices: built in for Claude Opus 5.5 and Sonnet 5.5; for any other model add <code>AI_PRICES</code> in Netlify, for example <code>{`{"model-id":[input,output,cacheRead,cacheWrite]}`}</code> in US$ per million tokens, copied from the provider&apos;s pricing page. ₹ at {inr} per US$ (<code>INR_PER_USD</code>). Each run&apos;s own notes show what both providers said: open it from the <Link href="/bench">queue</Link>.
      </p>
    </div>
  );
}
