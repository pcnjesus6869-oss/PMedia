"use client";

import { useActionState, useState } from "react";
import { EyeIcon, EyeOffIcon, LoaderIcon, LockIcon } from "lucide-react";
import { login, type LoginState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="text-sm font-medium">Senha da equipe</label>
      <div className="relative">
        <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          autoFocus
          required
          className="h-11 w-full rounded-xl border bg-muted/40 pl-9 pr-10 text-sm outline-none focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/40"
          aria-invalid={Boolean(state.error)}
        />
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground">
          {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending} className="h-11 rounded-xl">
        {pending && <LoaderIcon className="animate-spin" />} Entrar
      </Button>
      <p className="text-center text-xs text-muted-foreground">Clientes não precisam de senha: o link de prévia abre direto.</p>
    </form>
  );
}
