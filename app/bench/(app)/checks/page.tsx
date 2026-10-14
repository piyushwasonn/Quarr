import { toggleSuspend } from "@/app/bench/actions";
import { CHECKS_BY_ID } from "@/engine/checks";
import { checkStats, PROMOTION_WINDOW } from "@/engine/promotion";
import { LENS_NAMES } from "@/engine/types";

const REASON_ORDER = ["WORDING", "SEVERITY", "EVIDENCE_WRONG", "FALSE_POSITIVE", "UNSAFE"];

export default async function Checks() {
  const stats = await checkStats();
  const auto = stats.filter((s) => s.mode === "AUTO").length;
  return (
    <div className="stack" style={{ ["--stack" as string]: "20px" }}>
      <div className="stack" style={{ ["--stack" as string]: "6px" }}>
        <h1>Checks</h1>
        <p className="muted small" style={{ maxWidth: 760 }}>
          Your review decisions are what improve the engine. A check is promoted to <strong>AUTO</strong> once its last {PROMOTION_WINDOW} reviewed findings had no wrong evidence, no false positive and nothing unsafe, with at most 10% severity re-ranks. Any one of those three bad reasons sends it back to <strong>REVIEW</strong>. A report publishes without you only when every finding in it comes from an AUTO check. {auto} of {stats.length} checks are AUTO today.
        </p>
      </div>
      <div className="card table-wrap" style={{ boxShadow: "none" }}>
        <table className="data">
          <thead>
            <tr>
              <th>Check</th><th>Mode</th><th>Fired</th><th>Shown</th><th>Passed</th><th>Not seen</th><th>Reviewed (window)</th>
              {REASON_ORDER.map((r) => <th key={r}>{r.replace("_", " ").toLowerCase()}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const def = CHECKS_BY_ID[s.checkId];
              const fireRate = s.firings + s.passes ? Math.round((s.firings / (s.firings + s.passes)) * 100) : null;
              return (
                <tr key={s.checkId}>
                  <td><strong>{s.checkId}</strong><div className="mini">{def.name} · {LENS_NAMES[def.lens]} · sev {def.severity}</div></td>
                  <td><span className={`chip ${s.mode === "AUTO" ? "pass" : s.mode === "SUSPENDED" ? "fail" : ""}`}>{s.mode}</span></td>
                  <td>{s.firings}{fireRate !== null ? <span className="mini"> ({fireRate}%)</span> : null}</td>
                  <td>{s.shown}</td>
                  <td>{s.passes}</td>
                  <td>{s.notObservable}</td>
                  <td>{s.reviewed}/{PROMOTION_WINDOW}</td>
                  {REASON_ORDER.map((r) => <td key={r} style={{ color: s.edits[r] && r !== "WORDING" ? "var(--fail)" : undefined }}>{s.edits[r] ?? 0}</td>)}
                  <td>
                    <form action={toggleSuspend}>
                      <input type="hidden" name="checkId" value={s.checkId} />
                      <button className="btn btn-ghost btn-sm">{s.mode === "SUSPENDED" ? "Resume" : "Suspend"}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
