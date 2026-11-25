import Link from "next/link";
import { LENSES, QIM_PRINCIPLES, REASONING_RULES, STAGES, STORIES, WHY_BUYERS_CARE, checksFor, lensesCheckedAutomatically, sourceName, storiesFor } from "@/engine/framework";
import { checkStats } from "@/engine/promotion";

// The QUARR framework, as the engine uses it: QIM principles, the 19 lenses, which checks
// answer each lens, what else each needs, the research behind it, and where there is
// nothing yet (the build list).
export default async function Framework() {
  const stats = await checkStats().catch(() => []);
  const byCheck = new Map(stats.map((s) => [s.checkId, s]));

  return (
    <div className="stack" style={{ ["--stack" as string]: "24px" }}>
      <div className="stack" style={{ ["--stack" as string]: "6px" }}>
        <h1>Framework</h1>
        <p className="muted small" style={{ maxWidth: 780 }}>
          QUARR reads a store through 19 lenses, from a buyer finding it to recommending it. Checks answer what a website can show: today {lensesCheckedAutomatically()} of the 19 have at least one. The rest need a person to try them (the paid assessment) or the founder&apos;s own numbers, and the report says which instead of guessing (QIM 2). The research explains findings; it never creates one. {STORIES.length} stories ({STORIES.filter((s) => s.kind === "customer").length} buyer, {STORIES.filter((s) => s.kind === "founder").length} founder) and {REASONING_RULES.length} reasoning rules are loaded.
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
            <tr><th>Lens</th><th>Definition and buyer&apos;s question</th><th>Website shows it</th><th>Also needs</th><th>Checks</th><th>Reviewed (AUTO)</th><th>Stories</th><th>Rules</th><th>State</th></tr>
          </thead>
          <tbody>
            {LENSES.map((l) => {
              const checks = checksFor(l.id);
              const reviewed = checks.reduce((n, c) => n + (byCheck.get(c.id)?.reviewed ?? 0), 0);
              const auto = checks.filter((c) => byCheck.get(c.id)?.mode === "AUTO").length;
              const rules = REASONING_RULES.filter((r) => r.lens === l.id).length;
              const gap = !checks.length && l.site !== "no";
              return (
                <tr key={l.id}>
                  <td><a href={`#${l.id}`}><strong>{l.code}</strong></a><div className="small">{l.name}</div><div className="mini">{STAGES.find((s) => s.id === l.stage)?.name}</div></td>
                  <td className="small" style={{ minWidth: 260 }}>{l.definition}<div className="mini" style={{ marginTop: 4 }}>&ldquo;{l.buyerQuestion}&rdquo;{l.appliesWhen ? ` ${l.appliesWhen}` : ""}</div></td>
                  <td>{l.site}</td>
                  <td className="mini">{l.needs.length ? l.needs.map((n) => (n === "person" ? "a person" : "founder data")).join(", ") : "nothing"}</td>
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
            <li key={r.id}><span className="mini">{r.id} · {r.lens ?? "founder's evidence"} · {r.status}</span><br />{r.rule} <span className="mini">({r.source}{r.checks ? `; backs ${r.checks.join(", ")}` : ""})</span></li>
          ))}
        </ul>
      </div>

      {LENSES.map((l) => {
        const stories = storiesFor(l.id);
        return (
          <details className="card card-pad" key={l.id} id={l.id}>
            <summary><strong>{l.code} · {l.name}</strong> <span className="mini">{stories.length} stories</span></summary>
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
      {(() => {
        const founder = STORIES.filter((st) => !st.lenses.length);
        return founder.length ? (
          <details className="card card-pad">
            <summary><strong>The founder&apos;s own evidence</strong> <span className="mini">{founder.length} stories, no store lens (QIM 4 and 6)</span></summary>
            <ul className="list-clean small" style={{ marginTop: 10 }}>
              {founder.map((st) => (
                <li key={st.key} style={{ marginBottom: 10 }}>
                  <a href={st.url} target="_blank" rel="noreferrer">{st.title}</a> <span className="mini">{st.kind} · {sourceName(st.url)}</span>
                  <br /><span className="muted">{st.gap}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null;
      })()}
      <p className="mini">Regenerate the stories with <code>scripts/corpus.py</code> after adding to the Drive corpora. See also <Link href="/bench/checks">Checks</Link>.</p>
    </div>
  );
}
