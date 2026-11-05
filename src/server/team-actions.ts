"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { memberInputSchema, type MemberInput } from "@/lib/schemas";
import { fail, userError, type Result } from "./util";

const refresh = () => revalidatePath("/", "layout");

export async function createMember(input: MemberInput): Promise<Result<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    const data = memberInputSchema.parse(input);
    const m = await db.member.create({ data: { ...data, role: data.role || null, userId: user.id } });
    refresh();
    return { ok: true, data: { id: m.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMember(id: string, input: MemberInput): Promise<Result> {
  try {
    const user = await getCurrentUser();
    const data = memberInputSchema.parse(input);
    const res = await db.member.updateMany({ where: { id, userId: user.id }, data: { ...data, role: data.role || null } });
    if (!res.count) throw userError("Colaborador não encontrado");
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Remove o colaborador; clientes e tarefas dele ficam sem responsável. */
export async function deleteMember(id: string): Promise<Result> {
  try {
    const user = await getCurrentUser();
    const res = await db.member.deleteMany({ where: { id, userId: user.id } });
    if (!res.count) throw userError("Colaborador não encontrado");
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
