"use client";

import { useActionState } from "react";
import { requestRemoval } from "@/app/actions";

export function RemovalForm() {
  const [state, action, pending] = useActionState(requestRemoval, {} as { done?: boolean; error?: string });
  if (state.done) return <p className="card card-pad">Thank you. We&apos;ll confirm by email once your data is removed and your domain is excluded.</p>;
  return (
    <form action={action} className="card card-pad stack" style={{ marginTop: 24 }}>
      <div className="field"><label htmlFor="r-url">Store address</label><input id="r-url" name="url" className="input" placeholder="yourbrand.in" required /></div>
      <div className="field"><label htmlFor="r-email">Your email</label><input id="r-email" name="email" type="email" className="input" required /></div>
      <div className="field"><label htmlFor="r-note">Anything we should know (optional)</label><textarea id="r-note" name="note" className="textarea" /></div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending} style={{ justifySelf: "start" }}>Send request</button>
    </form>
  );
}
