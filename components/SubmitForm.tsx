"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitFirstLook, type SubmitState } from "@/app/actions";

export function SubmitForm() {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitFirstLook, {});
  return (
    <form action={action} className="stack" style={{ ["--stack" as string]: "16px" }} noValidate>
      <div className="field">
        <label htmlFor="url">Your store address</label>
        <input id="url" name="url" className="input" placeholder="yourbrand.in" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} required defaultValue={state.values?.url} />
      </div>
      <div className="field">
        <label htmlFor="email">Where should we send it?</label>
        <input id="email" name="email" type="email" className="input" placeholder="you@yourbrand.in" autoComplete="email" required defaultValue={state.values?.email} />
      </div>
      <div className="hp" aria-hidden>
        <label>Company <input name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="check">
        <input type="checkbox" name="consent" required />
        <span>
          I work on this store, and I&apos;m happy for QUARR to visit it with an automated browser, <Link href="/crawler">as described here</Link>.
        </span>
      </label>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", padding: "14px 20px" }}>
        {pending ? "Starting…" : "Walk my store"}
      </button>
      <p className="promise"><span className="dot" aria-hidden /> Free. No call, no card. Your First Look arrives by email.</p>
    </form>
  );
}
