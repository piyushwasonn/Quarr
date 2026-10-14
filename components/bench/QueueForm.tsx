"use client";

import { useActionState } from "react";
import { queueRuns } from "@/app/bench/actions";

export function QueueForm() {
  const [state, action, pending] = useActionState(queueRuns, {} as { error?: string; queued?: number });
  return (
    <form action={action} className="card card-pad stack" style={{ boxShadow: "none", maxWidth: 720 }}>
      <div className="field">
        <label htmlFor="urls">Store addresses, one per line</label>
        <textarea id="urls" name="urls" className="textarea" style={{ minHeight: 180 }} placeholder={"brandone.in\nbrandtwo.com"} />
      </div>
      <div className="field">
        <label htmlFor="em">Tie reports to this email</label>
        <input id="em" name="email" type="email" className="input" placeholder="you@quarr.in" />
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.queued !== undefined ? <p className="chip pass" style={{ justifySelf: "start" }}>{state.queued} queued</p> : null}
      <button className="btn btn-primary" disabled={pending} style={{ justifySelf: "start" }}>Queue runs</button>
    </form>
  );
}
