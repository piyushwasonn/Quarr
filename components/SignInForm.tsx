"use client";

import { useActionState } from "react";
import { signInStep, type SignInState } from "@/app/signin/actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInStep, { step: "email", next });
  return (
    <form action={action} className="stack" style={{ ["--stack" as string]: "14px" }}>
      <input type="hidden" name="next" value={next} />
      {state.step === "email" ? (
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" className="input" placeholder="you@yourbrand.in" autoComplete="email" required defaultValue={state.email} autoFocus />
        </div>
      ) : (
        <>
          <p className="small muted">We sent a 6-digit code to <strong>{state.email}</strong>. It works for 10 minutes.</p>
          <div className="field">
            <label htmlFor="code">Sign-in code</label>
            <input id="code" name="code" className="input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} placeholder="123456" autoFocus style={{ letterSpacing: "0.3em", fontSize: 22 }} />
          </div>
        </>
      )}
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "One moment…" : state.step === "email" ? "Email me a code" : "Sign in"}
      </button>
      {state.step === "code" ? (
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-quiet btn-sm" name="intent" value="resend" disabled={pending}>Send a new code</button>
          <button className="btn btn-quiet btn-sm" name="intent" value="restart" disabled={pending}>Use a different email</button>
        </div>
      ) : null}
    </form>
  );
}
