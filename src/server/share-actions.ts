"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createShareToken } from "@/lib/ids";
import { postInclude, toPostDTO } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { shareInputSchema, type ShareInput } from "@/lib/schemas";
import type { ShareSnapshot } from "@/lib/domain";
import { fail, userError, type Result } from "./util";

/**
 * Gera um link somente leitura com uma CÓPIA da prévia atual.
 * Alterações feitas depois no PMedia não mudam o que o cliente já recebeu;
 * para enviar a versão nova, gera-se outro link.
 */
export async function createShareLink(input: ShareInput): Promise<Result<{ token: string; postCount: number }>> {
  try {
    const user = await getCurrentUser();
    const data = shareInputSchema.parse(input);
    const client = await db.client.findFirst({ where: { id: data.clientId, userId: user.id } });
    if (!client) throw userError("Cliente não encontrado");

    const statuses: Prisma.EnumPostStatusFilter["in"] = ["IN_REVIEW", "APPROVED", "SCHEDULED"];
    if (data.includeDrafts) statuses.push("DRAFT");
    if (data.includePublished) statuses.push("PUBLISHED");

    const dateFilter: Prisma.PostWhereInput =
      data.from || data.to
        ? {
            OR: [
              { scheduledAt: { gte: data.from ? new Date(data.from) : undefined, lte: data.to ? new Date(data.to) : undefined } },
              // posts publicados ficam como contexto da grade, mesmo fora do período
              ...(data.includePublished ? [{ status: "PUBLISHED" as const }] : []),
              { scheduledAt: null },
            ],
          }
        : {};

    const posts = await db.post.findMany({
      where: { clientId: client.id, status: { in: statuses }, ...dateFilter },
      include: postInclude,
      orderBy: { feedPosition: "asc" },
    });
    if (posts.length === 0) throw userError("Nenhum post nesse filtro. Ajuste o período ou inclua rascunhos.");

    const snapshot: ShareSnapshot = {
      client: {
        name: client.name,
        handle: client.handle,
        bio: client.bio,
        website: client.website,
        avatarUrl: client.avatarUrl,
        color: client.color,
      },
      posts: posts.map(toPostDTO),
      generatedAt: new Date().toISOString(),
    };

    const link = await db.shareLink.create({
      data: {
        token: createShareToken(),
        clientId: client.id,
        title: data.title,
        message: data.message || null,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        postCount: posts.length,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { token: link.token, postCount: posts.length } };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeShareLink(id: string): Promise<Result> {
  try {
    const user = await getCurrentUser();
    const res = await db.shareLink.updateMany({
      where: { id, client: { userId: user.id }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (res.count === 0) throw userError("Link não encontrado");
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
