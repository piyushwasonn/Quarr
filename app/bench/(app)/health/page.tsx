import { headers } from "next/headers";
import { wakeNow } from "@/app/bench/actions";
import { runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

export default async function Health() {
  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host");
  const checks = await runHealthChecks(host);
  const broken = checks.filter((c) => c.ok === false).length;
  return (
    <div className="stack" style={{ ["--stack" as string]: "16px", maxWidth: 900 }}>
      <div className="spread">
        <h1>System health</h1>
        <form action={wakeNow}><button className="btn btn-ghost btn-sm">Wake the crawler now</button></form>
      </div>
      <p className={broken ? "alert" : "muted small"}>{broken ? `${broken} ${broken === 1 ? "thing needs" : "things need"} fixing. Each one says where.` : "Everything that's set up is working."}</p>
      <div className="stack" style={{ ["--stack" as string]: "10px" }}>
        {checks.map((c) => (
          <div key={c.name} className="card card-pad" style={{ boxShadow: "none", padding: "16px 20px", display: "grid", gap: 6 }}>
            <div className="spread">
              <strong style={{ color: "var(--navy-900)" }}>{c.name}</strong>
              <span className={`chip status ${c.ok === true ? "pass" : c.ok === false ? "fail" : "unseen"}`}>{c.ok === true ? "Working" : c.ok === false ? "Needs fixing" : "Not set up"}</span>
            </div>
            <p className="small" style={{ color: "var(--ink-2)", overflowWrap: "anywhere" }}>{c.detail}</p>
            {c.fix && c.ok !== true ? <p className="small muted">How to fix: {c.fix}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
