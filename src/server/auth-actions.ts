"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSessionValue, safeNext, SESSION_COOKIE, SESSION_DAYS, teamPassword } from "@/lib/team-auth";

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!teamPassword()) return { error: "Senha da equipe não configurada (TEAM_PASSWORD)." };
  const ok = await checkPassword(String(form.get("password") ?? ""));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // freia tentativas em sequência
    return { error: "Senha incorreta." };
  }
  (await cookies()).set(SESSION_COOKIE, await createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
