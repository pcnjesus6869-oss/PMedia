import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { getCurrentUser } from "./session";
import type { ClientDTO, MemberDTO, PostDTO, ShareLinkDTO, ShareSnapshot, TaskDTO } from "./domain";

export const postInclude = { media: { orderBy: { order: "asc" } } } satisfies Prisma.PostInclude;
type PostRow = Prisma.PostGetPayload<{ include: typeof postInclude }>;

export function toPostDTO(p: PostRow): PostDTO {
  return {
    id: p.id,
    clientId: p.clientId,
    type: p.type,
    status: p.status,
    caption: p.caption,
    script: p.script,
    firstComment: p.firstComment,
    location: p.location,
    collaborators: p.collaborators,
    aspectRatio: p.aspectRatio,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    pinned: p.pinned,
    shareToFeed: p.shareToFeed,
    coverUrl: p.coverUrl,
    coverTime: p.coverTime,
    feedPosition: p.feedPosition,
    media: p.media.map((m) => ({
      id: m.id,
      kind: m.kind,
      url: m.url,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
      alt: m.alt,
    })),
  };
}

export async function getWorkspaceData(): Promise<{
  tasks: TaskDTO[];
  clients: ClientDTO[];
  members: MemberDTO[];
  posts: PostDTO[];
  shareLinks: (ShareLinkDTO & { clientId: string })[];
}> {
  const user = await getCurrentUser();
  const [tasks, clients, posts, shareLinks, members] = await Promise.all([
    db.task.findMany({
      where: { userId: user.id },
      include: { tags: { select: { id: true, name: true, color: true } } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    db.client.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.post.findMany({ where: { client: { userId: user.id } }, include: postInclude, orderBy: { feedPosition: "asc" } }),
    db.shareLink.findMany({ where: { client: { userId: user.id } }, orderBy: { createdAt: "desc" }, omit: { snapshot: true } }),
    db.member.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      startDate: t.startDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      estimatedMinutes: t.estimatedMinutes,
      position: t.position,
      clientId: t.clientId,
      assigneeId: t.assigneeId,
      parentId: t.parentId,
      tags: t.tags,
    })),
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
      bio: c.bio,
      website: c.website,
      avatarUrl: c.avatarUrl,
      color: c.color,
      targetDate: c.targetDate?.toISOString() ?? null,
      ownerId: c.ownerId,
    })),
    members: members.map((m) => ({ id: m.id, name: m.name, role: m.role, color: m.color, avatarUrl: m.avatarUrl })),
    posts: posts.map(toPostDTO),
    shareLinks: shareLinks.map((s) => ({
      id: s.id,
      clientId: s.clientId,
      token: s.token,
      title: s.title,
      postCount: s.postCount,
      viewCount: s.viewCount,
      lastViewAt: s.lastViewAt?.toISOString() ?? null,
      revokedAt: s.revokedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

/** Página pública do cliente. Retorna null se o link não existe ou foi revogado. */
export async function getSharedPreview(token: string) {
  if (!/^[A-Za-z0-9]{10,64}$/.test(token)) return null;
  const link = await db.shareLink.findUnique({ where: { token } });
  if (!link || link.revokedAt) return null;
  await db.shareLink.update({ where: { id: link.id }, data: { viewCount: { increment: 1 }, lastViewAt: new Date() } });
  return {
    title: link.title,
    message: link.message,
    createdAt: link.createdAt.toISOString(),
    snapshot: link.snapshot as unknown as ShareSnapshot,
  };
}
