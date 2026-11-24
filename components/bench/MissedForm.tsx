"use client";

import { useActionState, useEffect, useRef } from "react";
import { addLearning } from "@/app/bench/actions";

// "What did QUARR miss?" on a run: each note is a candidate for a new check (Bench → Learnings).
export function MissedForm({ runId, lenses }: { runId: string; lenses: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addLearning, {} as { error?: string; ok?: boolean });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="stack" style={{ ["--stack" as string]: "8px" }}>
      <input type="hidden" name="runId" value={runId} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select name="lens" className="input" style={{ maxWidth: 260 }} defaultValue="">
          <option value="">Which part of the journey?</option>
          {lenses.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select name="kind" className="input" style={{ maxWidth: 220 }} defaultValue="MISSED">
          <option value="MISSED">QUARR missed this</option>
          <option value="NOTE">Just a note</option>
        </select>
      </div>
      <textarea name="note" className="textarea" rows={2} placeholder="What would a first-time buyer trip over here that QUARR didn't flag? Where on the site?" />
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <div className="row">
        <button className="btn btn-ghost btn-sm" disabled={pending}>{pending ? "Saving…" : "Save to Learnings"}</button>
        {state.ok ? <span className="mini muted">Saved.</span> : null}
      </div>
    </form>
  );
}
