import Link from "next/link";
import { CHECKS } from "@/engine/checks";
import { CHECK_LENS, FRAMEWORK_LENSES, QIM_PRINCIPLES, REASONING_RULES, STORIES, WHY_BUYERS_CARE, sourceName, storiesFor } from "@/engine/framework";
import { checkStats } from "@/engine/promotion";

// The QUARR framework, as the engine uses it: QIM principles, journey lenses, which checks
// answer each lens, the research behind it, and where there is nothing yet (the build list).
export default async function Framework() {
  const stats = await checkStats().catch(() => []);
  const byCheck = new Map(stats.map((s) => [s.checkId, s]));

  return (
    <div className="stack" style={{ ["--stack" as string]: "24px" }}>
      <div className="stack" style={{ ["--stack" as string]: "6px" }}>
        <h1>Framework</h1>
        <p className="muted small" style={{ maxWidth: 780 }}>
          QUARR reads a business through the questions its buyer has to answer, plus one about what the founder really knows. Checks answer what a website can show. What it can&apos;t show is reported as Unknown, with questions for the founder (QIM 2). The research explains findings; it never creates one. {STORIES.length} stories ({STORIES.filter((s) => s.kind === "customer").length} buyer, {STORIES.filter((s) => s.kind === "founder").length} founder) and {REASONING_RULES.length} reasoning rules are loaded.
        </p>
      </div>

      <details className="card card-pad">
        <summary><strong>QUARR Intelligence Model v1.0</strong> <span className="mini">locked</span></summary>
        <ol className="small" style={{ marginTop: 10 }}>
          {QIM_PRINCIPLES.map((p) => <li key={p.n}><strong>{p.name}.</strong> {p.rule}</li>)}
        </ol>
      </details>

      <div className="card table-wrap" style={{ boxShadow: "none" }}>
        <table className="data">
          <thead>
            <tr><th>Lens</th><th>Buyer&apos;s question</th><th>Website shows it</th><th>Checks</th><th>Reviewed (AUTO)</th><th>Stories</th><th>Rules</th><th>State</th></tr>
          </thead>
          <tbody>
            {FRAMEWORK_LENSES.map((l) => {
              const checks = CHECKS.filter((c) => CHECK_LENS[c.id] === l.id);
              const reviewed = checks.reduce((n, c) => n + (byCheck.get(c.id)?.reviewed ?? 0), 0);
              const auto = checks.filter((c) => byCheck.get(c.id)?.mode === "AUTO").length;
              const rules = REASONING_RULES.filter((r) => r.lens === l.id).length;
              const gap = !checks.length && l.website !== "no";
              return (
                <tr key={l.id}>
                  <td><a href={`#${l.id}`}><strong>{l.name}</strong></a><div className="mini">{l.stage}</div></td>
                  <td className="small">{l.buyerQuestion}</td>
                  <td>{l.website}</td>
                  <td className="mini">{checks.length ? checks.map((c) => c.id).join(", ") : "none"}</td>
                  <td>{reviewed} ({auto})</td>
                  <td>{storiesFor(l.id).length}</td>
                  <td>{rules}</td>
                  <td>{gap ? <span className="chip fail">gap: no check yet</span> : !checks.length ? <span className="chip unseen">founder questions</span> : <span className="chip pass">checked</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card card-pad stack">
        <h2>Reasoning rules</h2>
        <p className="small muted">From your Customer Thinking Stories. Each comes from one person&apos;s buying decisions, so it stays a hypothesis until Step 0 reviews of real stores support it. Rules shown on findings: {Object.values(WHY_BUYERS_CARE).filter((w) => w.rule).length} placements.</p>
        <ul className="list-clean small">
          {REASONING_RULES.map((r) => (
            <li key={r.id}><span className="mini">{r.id} · {r.lens} · {r.status}</span><br />{r.rule} <span className="mini">({r.source}{r.checks ? `; backs ${r.checks.join(", ")}` : ""})</span></li>
          ))}
        </ul>
      </div>

      {FRAMEWORK_LENSES.map((l) => {
        const stories = storiesFor(l.id);
        return (
          <details className="card card-pad" key={l.id} id={l.id}>
            <summary><strong>{l.name}</strong> <span className="mini">{stories.length} stories</span></summary>
            <div className="stack" style={{ ["--stack" as string]: "10px", marginTop: 10 }}>
              <p className="small"><strong>Ask the founder:</strong> {l.founderQuestions.join(" ")}</p>
              <ul className="list-clean small">
                {stories.map((s) => (
                  <li key={s.key} style={{ marginBottom: 10 }}>
                    <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> <span className="mini">{s.kind} · {sourceName(s.url)} · evidence {s.evidence.toLowerCase()}</span>
                    <br /><span className="muted">{s.gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        );
      })}
      <p className="mini">Regenerate the stories with <code>scripts/corpus.py</code> after adding to the Drive corpora. See also <Link href="/bench/checks">Checks</Link>.</p>
    </div>
  );
}
