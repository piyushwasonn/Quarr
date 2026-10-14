import type { Prisma, RunStatus } from "@prisma/client";
import Link from "next/link";
import { db } from "@/lib/db";

const FILTERS: Record<string, { label: string; statuses?: RunStatus[] }> = {
  review: { label: "Needs review", statuses: ["IN_REVIEW", "DRAFTED", "APPROVED"] },
  working: { label: "In progress", statuses: ["QUEUED", "CRAWLING", "CRAWLED", "CHECKED"] },
  sent: { label: "Published", statuses: ["PUBLISHED", "DELIVERED"] },
  failed: { label: "Failed / rejected", statuses: ["CRAWL_FAILED", "REJECTED"] },
  all: { label: "All" },
};

const ago = (d: Date) => {
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 60) return `${m}m`;
  if (m < 48 * 60) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
};

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export default async function Queue({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "review" } = await searchParams;
  const filter = FILTERS[f] ?? FILTERS.review;
  const where: Prisma.RunWhereInput = filter.statuses ? { status: { in: filter.statuses } } : {};
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [runs, byStatus, reviewed, funnelRuns] = await Promise.all([
    db.run.findMany({ where, orderBy: { createdAt: f === "review" ? "asc" : "desc" }, take: 100, include: { _count: { select: { findings: { where: { selected: true, state: { not: "DROPPED" } } } } } } }),
    db.run.groupBy({ by: ["status"], _count: { _all: true } }),
    db.run.findMany({ where: { reviewSeconds: { not: null }, publishedAt: { gte: since } }, select: { reviewSeconds: true } }),
    db.run.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, deliveredAt: true, publishedAt: true, repliedAt: true, paidAt: true, source: true, findings: { where: { selected: true, position: 0 }, select: { checkId: true } } },
    }),
  ]);
  const count = (s: RunStatus[]) => byStatus.filter((x) => s.includes(x.status)).reduce((a, x) => a + x._count._all, 0);
  const queueDepth = count(["QUEUED", "CRAWLING", "CRAWLED", "CHECKED", "DRAFTED", "IN_REVIEW"]);
  const oldest = await db.run.findFirst({ where: { status: { in: ["QUEUED", "CRAWLING", "IN_REVIEW", "DRAFTED"] }, source: "PUBLIC" }, orderBy: { createdAt: "asc" } });
  const oldestHours = oldest ? (Date.now() - oldest.createdAt.getTime()) / 3600000 : 0;
  const med = median(reviewed.map((r) => r.reviewSeconds!));

  const sent = funnelRuns.filter((r) => r.publishedAt);
  const replied = sent.filter((r) => r.repliedAt);
  const paid = sent.filter((r) => r.paidAt);
  const byFirst = new Map<string, { sent: number; replied: number; paid: number }>();
  for (const r of sent) {
    const k = r.findings[0]?.checkId ?? "(none)";
    const row = byFirst.get(k) ?? { sent: 0, replied: 0, paid: 0 };
    row.sent++;
    if (r.repliedAt) row.replied++;
    if (r.paidAt) row.paid++;
    byFirst.set(k, row);
  }

  return (
    <div className="stack" style={{ ["--stack" as string]: "20px" }}>
      <div className="spread">
        <h1>Queue</h1>
        <Link href="/bench/new" className="btn btn-primary btn-sm">Queue outreach runs</Link>
      </div>

      {queueDepth > 5 ? <p className="alert">Queue depth is {queueDepth}. The promise is 12 hours.</p> : null}
      {oldestHours > 8 ? <p className="alert">The oldest founder request ({oldest!.domain}) has waited {oldestHours.toFixed(1)} hours.</p> : null}

      <div className="tiles">
        <div className="card"><div className="n">{count(["IN_REVIEW", "DRAFTED", "APPROVED"])}</div><div className="t">waiting for review</div></div>
        <div className="card"><div className="n">{count(["QUEUED", "CRAWLING", "CRAWLED", "CHECKED"])}</div><div className="t">queued or crawling</div></div>
        <div className="card"><div className="n">{med === null ? "–" : `${(med / 60).toFixed(1)}m`}</div><div className="t">median review time (30d)</div></div>
        <div className="card"><div className="n">{sent.length}</div><div className="t">published (30d)</div></div>
        <div className="card"><div className="n">{sent.length ? `${Math.round((replied.length / sent.length) * 100)}%` : "–"}</div><div className="t">replied</div></div>
        <div className="card"><div className="n">{paid.length}</div><div className="t">paid journeys</div></div>
      </div>

      <div className="tabs">
        {Object.entries(FILTERS).map(([k, v]) => (
          <Link key={k} href={`/bench?f=${k}`} className={k === f ? "on" : ""}>{v.label}</Link>
        ))}
      </div>

      <div className="card table-wrap" style={{ boxShadow: "none" }}>
        <table className="data">
          <thead>
            <tr><th>Store</th><th>Source</th><th>Status</th><th>Findings</th><th>Waiting</th><th></th></tr>
          </thead>
          <tbody>
            {runs.length ? (
              runs.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.domain}</strong>{r.storeName ? <div className="mini">{r.storeName}</div> : null}</td>
                  <td><span className={`chip ${r.source === "PUBLIC" ? "brass" : ""}`}>{r.source === "PUBLIC" ? "Founder" : "Outreach"}</span></td>
                  <td>
                    <span className={`chip ${r.status === "CRAWL_FAILED" || r.status === "REJECTED" ? "fail" : ["PUBLISHED", "DELIVERED"].includes(r.status) ? "pass" : ""}`}>{r.status.replace("_", " ").toLowerCase()}</span>
                    {r.failureCode ? <div className="mini">{r.failureCode}</div> : null}
                  </td>
                  <td>{r._count.findings}{r.otherIssues ? <span className="mini"> + {r.otherIssues} more</span> : null}</td>
                  <td className="mini">{ago(r.createdAt)}</td>
                  <td><Link href={`/bench/runs/${r.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="muted" style={{ padding: 28, textAlign: "center" }}>Nothing here.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card card-pad stack" style={{ boxShadow: "none" }}>
        <h3>Funnel by first finding shown (30 days)</h3>
        <p className="mini">Published → replied → paid, grouped by the check that led the report. This tells you which findings make owners act.</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>First finding</th><th>Published</th><th>Replied</th><th>Paid</th></tr></thead>
            <tbody>
              {[...byFirst.entries()].sort((a, b) => b[1].sent - a[1].sent).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{v.sent}</td><td>{v.replied}</td><td>{v.paid}</td></tr>
              ))}
              {!byFirst.size ? <tr><td colSpan={4} className="muted">No published reports yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
