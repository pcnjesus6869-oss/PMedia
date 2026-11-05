import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_COOKIE, verifySessionValue } from "./team-auth";

/**
 * Conta da agência. O acesso é protegido pela senha da equipe (proxy + esta checagem,
 * que vale para server actions e APIs mesmo se o proxy for contornado).
 * TODO(auth): login individual por colaborador (Auth.js / Clerk).
 */
export const getCurrentUser = cache(async () => {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionValue(session))) throw new Error("Não autorizado");
  return db.user.upsert({
    where: { email: "local@pmedia.dev" },
    update: {},
    create: { email: "local@pmedia.dev", name: "Você" },
  });
});
