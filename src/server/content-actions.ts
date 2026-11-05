"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { LIMITS } from "@/lib/domain";
import {
  clientInputSchema,
  postInputSchema,
  postUpdateSchema,
  type ClientInput,
  type PostInput,
  type PostUpdate,
} from "@/lib/schemas";
import { fail, toDate, userError, type Result } from "./util";

const refresh = () => revalidatePath("/", "layout");

async function ownClient(userId: string, clientId: string) {
  const c = await db.client.findFirst({ where: { id: clientId, userId }, select: { id: true } });
  if (!c) throw userError("Cliente não encontrado");
}

async function ownMember(userId: string, memberId: string | null | undefined) {
  if (!memberId) return;
  const m = await db.member.findFirst({ where: { id: memberId, userId }, select: { id: true } });
  if (!m) throw userError("Colaborador não encontrado");
}

async function ownPost(userId: string, postId: string) {
  const p = await db.post.findFirst({ where: { id: postId, client: { userId } } });
  if (!p) throw userError("Post não encontrado");
  return p;
}

/* ---------------- Clientes ---------------- */

export async function createClient(input: ClientInput): Promise<Result<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    const data = clientInputSchema.parse(input);
    await ownMember(user.id, data.ownerId);
    const c = await db.client.create({ data: { ...data, targetDate: toDate(data.targetDate), userId: user.id } });
    refresh();
    return { ok: true, data: { id: c.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateClient(id: string, input: ClientInput): Promise<Result> {
  try {
    const user = await getCurrentUser();
    await ownClient(user.id, id);
    const data = clientInputSchema.parse(input);
    await ownMember(user.id, data.ownerId);
    await db.client.update({ where: { id }, data: { ...data, targetDate: toDate(data.targetDate) } });
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- Posts ---------------- */

function validatePost(p: { type: string; media: unknown[]; aspectRatio: string; collaborators: string[] }) {
  if (p.type !== "POST" && p.media.length > 1) throw userError("Reels e Stories aceitam apenas uma mídia");
  if (p.type !== "POST" && p.aspectRatio !== "9:16") p.aspectRatio = "9:16";
  if (p.type === "POST" && p.aspectRatio === "9:16") p.aspectRatio = "4:5";
}

async function checkPinned(clientId: string, exceptId?: string) {
  const count = await db.post.count({ where: { clientId, pinned: true, NOT: exceptId ? { id: exceptId } : undefined } });
  if (count >= LIMITS.pinned) throw userError(`O Instagram permite fixar no máximo ${LIMITS.pinned} posts`);
}

/** Vincula as mídias enviadas ao post, na ordem informada. */
async function attachMedia(postId: string, media: { id: string; alt?: string | null }[]) {
  const ids = media.map((m) => m.id);
  const found = await db.mediaAsset.findMany({ where: { id: { in: ids }, OR: [{ postId: null }, { postId }] }, select: { id: true } });
  if (found.length !== ids.length) throw userError("Alguma mídia não foi encontrada. Envie novamente.");
  // desvincula as que saíram (o arquivo é mantido: links antigos de cliente podem usá-lo)
  await db.mediaAsset.updateMany({ where: { postId, id: { notIn: ids } }, data: { postId: null } });
  await Promise.all(
    media.map((m, order) => db.mediaAsset.update({ where: { id: m.id }, data: { postId, order, alt: m.alt ?? null } })),
  );
}

export async function createPost(input: PostInput): Promise<Result<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    const data = postInputSchema.parse(input);
    await ownClient(user.id, data.clientId);
    validatePost(data);
    if (data.pinned) await checkPinned(data.clientId);

    // novos itens entram no topo da grade (como no Instagram)
    const top = await db.post.aggregate({ where: { clientId: data.clientId }, _min: { feedPosition: true } });
    const { media, scheduledAt, ...rest } = data;
    const post = await db.post.create({
      data: { ...rest, scheduledAt: toDate(scheduledAt), feedPosition: (top._min.feedPosition ?? 1) - 1 },
    });
    await attachMedia(post.id, media);
    refresh();
    return { ok: true, data: { id: post.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePost(input: PostUpdate): Promise<Result> {
  try {
    const user = await getCurrentUser();
    const { id, media, scheduledAt, ...rest } = postUpdateSchema.parse(input);
    const current = await ownPost(user.id, id);
    if (rest.clientId && rest.clientId !== current.clientId) await ownClient(user.id, rest.clientId);
    const merged = {
      type: rest.type ?? current.type,
      aspectRatio: rest.aspectRatio ?? current.aspectRatio,
      collaborators: rest.collaborators ?? current.collaborators,
      media: media ?? [],
    };
    if (media) validatePost(merged);
    if (rest.pinned && !current.pinned) await checkPinned(current.clientId, id);

    await db.post.update({
      where: { id },
      data: { ...rest, aspectRatio: media ? merged.aspectRatio : rest.aspectRatio, scheduledAt: toDate(scheduledAt) },
    });
    if (media) await attachMedia(id, media);
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePost(id: string): Promise<Result> {
  try {
    const user = await getCurrentUser();
    await ownPost(user.id, id);
    await db.mediaAsset.updateMany({ where: { postId: id }, data: { postId: null } });
    await db.post.delete({ where: { id } });
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function duplicatePost(id: string): Promise<Result<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    const src = await db.post.findFirst({ where: { id, client: { userId: user.id } }, include: { media: true } });
    if (!src) throw userError("Post não encontrado");
    const { id: _id, createdAt: _c, updatedAt: _u, media, ...rest } = src;
    void _id; void _c; void _u;
    const copy = await db.post.create({
      data: {
        ...rest,
        status: "DRAFT",
        pinned: false,
        feedPosition: src.feedPosition - 0.5,
        media: { create: media.map(({ kind, url, mimeType, width, height, duration, alt, order }) => ({ kind, url, mimeType, width, height, duration, alt, order })) },
      },
    });
    refresh();
    return { ok: true, data: { id: copy.id } };
  } catch (e) {
    return fail(e);
  }
}

/** Reordena a grade: recebe os ids na nova ordem (topo → fim). */
export async function reorderPosts(clientId: string, orderedIds: string[]): Promise<Result> {
  try {
    const user = await getCurrentUser();
    await ownClient(user.id, clientId);
    const owned = await db.post.count({ where: { clientId, id: { in: orderedIds } } });
    if (owned !== orderedIds.length) throw userError("Lista de posts inválida");
    await db.$transaction(orderedIds.map((id, i) => db.post.update({ where: { id }, data: { feedPosition: i } })));
    refresh();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
