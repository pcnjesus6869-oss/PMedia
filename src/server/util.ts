import { z } from "zod";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join("; ") };
  if (e instanceof Error && e.name === "UserError") return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Erro inesperado" };
}

/** Erro com mensagem segura para mostrar ao usuário. */
export function userError(message: string) {
  const e = new Error(message);
  e.name = "UserError";
  return e;
}

export const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(v) : null);
