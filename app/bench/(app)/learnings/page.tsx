import Link from "next/link";
import { setLearningStatus } from "@/app/bench/actions";
import { CHECKS_BY_ID } from "@/engine/checks";
import { FRAMEWORK_LENS_BY_ID, type FrameworkLensId } from "@/engine/framework/lenses";
import { aiMistakes, crawlGaps, goodPractice, isStoreRun, MIN_STORES_FOR_PATTERN, storePatterns, type LearnRun } from "@/engine/learn";
import { db } from "@/lib/db";

// What QUARR has learned from its crawls, so each one makes the next better.
export default async function Learnings() {
  const since = new Date(Date.now() - 180 * 24 * 3600 * 1000);
  const [rows, notes] = await Promise.all([
    db.run.findMany({
      where: { crawledAt: { gte: since } },
      orderBy: { crawledAt: "desc" },
      take: 500,
      select: {
        id: true,
        domain: true,
        kind: true,
        platform: true,
        crawledAt: true,
        pages: { select: { kind: true } },
        results: { select: { checkId: true, outcome: true, detail: true, ai: true } },
        findings: { select: { checkId: true, state: true, editReason: true } },
      },
    }),
    db.learning.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { run: { select: { id: true, domain: true } } } }),
  ]);
  const runs = rows as LearnRun[];
  const name = (id: string) => CHECKS_BY_ID[id]?.name ?? id;
  const lensName = (id: string | null) => (id ? FRAMEWORK_LENS_BY_ID[id as FrameworkLensId]?.name ?? id : "");

  const stores = runs.filter(isStoreRun);
  const outOfScope = runs.filter((r) => !isStoreRun(r));
  const gapCounts = new Map<string, { label: string; domains: string[] }>();
  for (const r of stores) for (const g of crawlGaps(r)) {
    const e = gapCounts.get(g.code) ?? { label: g.label, domains: [] };
    e.domains.push(`${r.domain}${r.platform ? ` (${r.platform})` : ""}`);
    gapCounts.set(g.code, e);
  }
  const mistakes = runs.flatMap(aiMistakes);
  const { reviewedStores, patterns, enough } = storePatterns(runs);
  const good = runs.flatMap(goodPractice).slice(0, 30);
  const open = notes.filter((n) => n.status === "OPEN");
  const closed = notes.filter((n) => n.status !== "OPEN");

  const research = [
    `QUARR crawl learnings (last 180 days): ${runs.length} walks, ${stores.length} online stores, ${outOfScope.length} not stores, ${reviewedStores} stores reviewed.`,
    ...[...gapCounts.values()].map((g) => `Crawler gap: ${g.label}: ${g.domains.length} store(s).`),
    ...mistakes.map((m) => `AI ${m.what === "HID_REAL" ? "overturned a real finding" : m.what === "LET_WRONG" ? "confirmed a wrong finding" : "check was wrong"}: ${name(m.checkId)} on ${m.domain}. ${m.reason}`),
    ...open.map((n) => `Missed by QUARR${n.lens ? ` (${lensName(n.lens)})` : ""}${n.run ? ` on ${n.run.domain}` : ""}: ${n.note}`),
    ...(enough ? patterns.slice(0, 10).map((p) => `Pattern: ${name(p.checkId)} confirmed on ${p.kept} of ${reviewedStores} reviewed stores.`) : [`Patterns: only ${reviewedStores} stores reviewed; ${MIN_STORES_FOR_PATTERN} needed before calling anything a pattern.`]),
  ].join("\n");

  return (
    <div className="stack" style={{ ["--stack" as string]: "24px" }}>
      <div className="stack" style={{ ["--stack" as string]: "6px" }}>
        <h1>Learnings</h1>
        <p className="muted small" style={{ maxWidth: 820 }}>
          What every crawl teaches QUARR, worked out from the pages it reached, the AI&apos;s verdicts and your Bench decisions. {runs.length} walks in the last 180 days: {stores.length} online stores, {outOfScope.length} not stores, {reviewedStores} stores you reviewed. These are lessons about QUARR and about stores, not proof of how buyers behave; that still needs real customer evidence.
        </p>
      </div>

      <section className="card card-pad stack">
        <h2>What QUARR missed ({open.length} open)</h2>
        <p className="small muted">Things you noticed on a store that no check caught. Each one is a candidate for a new check. Add them from any run page.</p>
        {open.length ? (
          <ul className="list-clean small">
            {open.map((n) => (
              <li key={n.id} style={{ marginBottom: 10 }}><div>
                <span className="mini">{n.kind === "NOTE" ? "Note" : "Missed"}{n.lens ? ` · ${lensName(n.lens)}` : ""}{n.run ? <> · <Link href={`/bench/runs/${n.run.id}`}>{n.run.domain}</Link></> : ""}</span>
                <br />{n.note}
                <span className="row" style={{ gap: 6, marginTop: 4 }}>
                  <form action={setLearningStatus}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="status" value="BUILT" /><button className="btn btn-quiet btn-sm">Became a check</button></form>
                  <form action={setLearningStatus}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="status" value="DISMISSED" /><button className="btn btn-quiet btn-sm">Dismiss</button></form>
                </span>
              </div></li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Nothing yet. On a run page, use &quot;What did QUARR miss?&quot;.</p>
        )}
        {closed.length ? <p className="mini muted">{closed.filter((n) => n.status === "BUILT").length} became checks, {closed.filter((n) => n.status === "DISMISSED").length} dismissed.</p> : null}
      </section>

      <section className="card card-pad stack">
        <h2>Where the crawler fell short</h2>
        <p className="small muted">Pages QUARR couldn&apos;t reach on online stores. A gap that repeats on one platform is a crawler fix; on one store, it may be the store.</p>
        {gapCounts.size ? (
          <ul className="list-clean small">
            {[...gapCounts.values()].sort((a, b) => b.domains.length - a.domains.length).map((g) => (
              <li key={g.label} style={{ marginBottom: 6 }}><div><strong>{g.label}</strong>: {g.domains.length} {g.domains.length === 1 ? "store" : "stores"} <span className="mini muted">({g.domains.slice(0, 8).join(", ")})</span></div></li>
            ))}
          </ul>
        ) : <p className="small muted">No gaps on the stores walked so far.</p>}
        {outOfScope.length ? (
          <p className="small"><strong>Not online stores ({outOfScope.length}):</strong> {outOfScope.slice(0, 12).map((r) => r.domain).join(", ")}. QUARR&apos;s checks are built for stores, so a clean result here means little. If several are real stores, product discovery needs work.</p>
        ) : null}
      </section>

      <section className="card card-pad stack">
        <h2>Where the AI got it wrong ({mistakes.length})</h2>
        <p className="small muted">Your decision contradicted the AI. Each one is a prompt or rule to fix. Bench → <Link href="/bench/ai">AI</Link> has the totals per provider.</p>
        {mistakes.length ? (
          <ul className="list-clean small">
            {mistakes.map((m, i) => (
              <li key={i} style={{ marginBottom: 8 }}><div>
                <span className={`chip ${m.what === "HID_REAL" ? "fail" : "unseen"}`}>{m.what === "HID_REAL" ? "Overturned a real finding" : m.what === "LET_WRONG" ? "Confirmed a wrong finding" : "AI check was wrong"}</span>{" "}
                <strong>{name(m.checkId)}</strong> on {m.domain}. <span className="muted">{m.reason}</span>
              </div></li>
            ))}
          </ul>
        ) : <p className="small muted">None yet among the findings you&apos;ve decided.</p>}
      </section>

      <section className="card card-pad stack">
        <h2>Patterns across stores</h2>
        <p className="small muted">
          How often each problem was confirmed on stores you reviewed. {enough ? "" : `Only ${reviewedStores} reviewed so far: ${MIN_STORES_FOR_PATTERN} are needed before calling anything a pattern, or quoting it in public.`}
        </p>
        {patterns.length ? (
          <div className="table-wrap" style={{ boxShadow: "none" }}>
            <table className="data">
              <thead><tr><th>Check</th><th>Lens</th><th>You kept it</th><th>Dropped as wrong</th><th>Fired, not reviewed</th></tr></thead>
              <tbody>
                {patterns.slice(0, 25).map((p) => (
                  <tr key={p.checkId}><td>{name(p.checkId)}<div className="mini">{p.checkId}</div></td><td>{lensName(p.lens)}</td><td>{p.kept} of {reviewedStores}</td><td>{p.droppedWrong}</td><td>{p.firedUnreviewed}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="small muted">Review a few stores first.</p>}
      </section>

      <section className="card card-pad stack">
        <h2>Good practice seen</h2>
        <p className="small muted">What stores do well, in their own words (AI-judged checks that passed with a verified quote). Useful as &quot;what good looks like&quot; when you advise a founder.</p>
        {good.length ? (
          <ul className="list-clean small">
            {good.map((g, i) => (
              <li key={i} style={{ marginBottom: 8 }}><div><span className="mini">{lensName(g.lens)} · {g.domain}</span><br />{g.quotes.map((q) => `"${q.text}"`).join(" / ")}</div></li>
            ))}
          </ul>
        ) : <p className="small muted">None yet.</p>}
      </section>

      <details className="card card-pad">
        <summary><strong>Copy for the research log</strong></summary>
        <p className="small muted" style={{ marginTop: 8 }}>Plain text to paste into Notion or a research doc.</p>
        <textarea className="textarea" rows={10} readOnly defaultValue={research} style={{ width: "100%", fontFamily: "var(--mono, monospace)", fontSize: 13 }} />
      </details>
    </div>
  );
}
