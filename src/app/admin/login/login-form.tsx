"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="mt-8 space-y-6">
      <div>
        <label htmlFor="email" className="block text-sm font-semibold">E-posta</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field-input" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-semibold">Parola</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field-input" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-err">{state.error}</p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
