"use client";

import { useActionState } from "react";
import { recheck } from "@/app/account/actions";

export function RecheckForm({ runId, credits }: { runId: string; credits: number }) {
  const [state, action, pending] = useActionState(recheck, {} as { error?: string });
  return (
    <form action={action} className="stack" style={{ ["--stack" as string]: "8px" }}>
      <input type="hidden" name="runId" value={runId} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Starting…" : `Re-check now (uses 1 of ${credits} ${credits === 1 ? "credit" : "credits"})`}</button>
      {state.error ? <p className="form-error">{state.error}</p> : null}
    </form>
  );
}
