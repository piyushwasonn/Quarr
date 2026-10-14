"use client";

import { useActionState } from "react";
import { login } from "@/app/bench/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {} as { error?: string });
  return (
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="pw">Password</label>
        <input id="pw" name="password" type="password" className="input" autoFocus autoComplete="current-password" />
      </div>
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>Sign in</button>
    </form>
  );
}
