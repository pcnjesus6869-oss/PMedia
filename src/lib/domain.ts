/**
 * Tipos e regras de domínio compartilhados entre servidor e cliente.
 * (Sem imports de Prisma para poder ser usado em Client Components.)
 */

/** Ordem do fluxo (colunas do Kanban). */
export const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "AWAITING_APPROVAL", "AWAITING_RETURN", "EXTERNAL", "DONE"] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em desenvolvimento",
  AWAITING_APPROVAL: "Ag. aprovação",
  AWAITING_RETURN: "Aguardando retorno",
  EXTERNAL: "Externo",
  DONE: "Concluída",
};

export const STATUS_HINT: Record<Status, string> = {
  NOT_STARTED: "Ainda não começou",
  IN_PROGRESS: "Em andamento: pode continuar nos próximos dias",
  AWAITING_APPROVAL: "Aguardando o cliente ou o gestor aprovar",
  AWAITING_RETURN: "Esperando material ou resposta de alguém",
  EXTERNAL: "Depende de fornecedor ou parceiro externo",
  DONE: "Finalizada",
};

/** Cor de cada status: ponto (dot) e pílula selecionada (pill). */
export const STATUS_TONE: Record<Status, { dot: string; pill: string }> = {
  NOT_STARTED: { dot: "bg-slate-400", pill: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" },
  IN_PROGRESS: { dot: "bg-sky-500", pill: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  AWAITING_APPROVAL: { dot: "bg-violet-500", pill: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  AWAITING_RETURN: { dot: "bg-amber-500", pill: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  EXTERNAL: { dot: "bg-orange-500", pill: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200" },
  DONE: { dot: "bg-emerald-500", pill: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
};

/**
 * Datas automáticas: o início é registrado quando a tarefa entra em andamento
 * (não necessariamente no dia em que foi criada) e a conclusão ao finalizar.
 */
export function lifecycleDates(
  next: Status,
  current: { startDate: string | Date | null; completedAt?: string | Date | null } | null,
  now = new Date(),
) {
  const started = next !== "NOT_STARTED";
  return {
    startDate: started ? (current?.startDate ? new Date(current.startDate) : now) : null,
    completedAt: next === "DONE" ? (current?.completedAt ? new Date(current.completedAt) : now) : null,
  };
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  HIGH: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  URGENT: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

/**
 * Matriz de Eisenhower ↔ prioridade (1:1, para que arrastar entre quadrantes
 * seja apenas uma troca de prioridade).
 */
export type Quadrant = "DO" | "SCHEDULE" | "DELEGATE" | "ELIMINATE";

export const QUADRANTS: {
  id: Quadrant;
  priority: Priority;
  title: string;
  subtitle: string;
  urgent: boolean;
  important: boolean;
  tone: string;
}[] = [
  { id: "DO", priority: "URGENT", title: "Fazer agora", subtitle: "Urgente · Importante", urgent: true, important: true, tone: "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30" },
  { id: "SCHEDULE", priority: "HIGH", title: "Agendar", subtitle: "Não urgente · Importante", urgent: false, important: true, tone: "border-sky-300 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/30" },
  { id: "DELEGATE", priority: "MEDIUM", title: "Delegar", subtitle: "Urgente · Não importante", urgent: true, important: false, tone: "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30" },
  { id: "ELIMINATE", priority: "LOW", title: "Eliminar", subtitle: "Não urgente · Não importante", urgent: false, important: false, tone: "border-slate-300 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30" },
];

export function quadrantOf(priority: Priority): Quadrant {
  return QUADRANTS.find((q) => q.priority === priority)!.id;
}

/** Formato serializável enviado do RSC para os Client Components. */
export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  estimatedMinutes: number | null;
  position: number;
  clientId: string | null;
  assigneeId: string | null;
  parentId: string | null;
  tags: { id: string; name: string; color: string }[];
};

export type ClientDTO = {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  website: string | null;
  avatarUrl: string | null;
  color: string;
  targetDate: string | null;
  ownerId: string | null;
};

export type MemberDTO = {
  id: string;
  name: string;
  role: string | null;
  color: string;
  avatarUrl: string | null;
};

/** Responsável efetivo: o da tarefa ou, se vazio, o responsável do cliente. */
export function effectiveAssignee(task: Pick<TaskDTO, "assigneeId" | "clientId">, clientOwner: (clientId: string) => string | null | undefined) {
  return task.assigneeId ?? (task.clientId ? clientOwner(task.clientId) ?? null : null);
}

/* ---------------- Conteúdo (Instagram) ---------------- */

export const POST_TYPES = ["POST", "REEL", "STORY"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_TYPE_LABEL: Record<PostType, string> = {
  POST: "Post",
  REEL: "Reels",
  STORY: "Story",
};

export const POST_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em aprovação",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
};

export const POST_STATUS_COLOR: Record<PostStatus, string> = {
  DRAFT: "bg-slate-500",
  IN_REVIEW: "bg-amber-500",
  APPROVED: "bg-sky-500",
  SCHEDULED: "bg-violet-500",
  PUBLISHED: "bg-emerald-500",
};

/** Proporções aceitas pelo Instagram por formato. */
export const ASPECTS: Record<PostType, string[]> = {
  POST: ["4:5", "1:1", "3:4", "1.91:1"],
  REEL: ["9:16"],
  STORY: ["9:16"],
};

/** "4:5" → 0.8 (largura / altura) */
export function aspectValue(ratio: string): number {
  const [w, h] = ratio.split(":").map(Number);
  return w && h ? w / h : 0.8;
}

export const LIMITS = {
  caption: 2200,
  hashtags: 30,
  mentions: 20,
  collaborators: 3,
  carousel: 20,
  pinned: 3,
  /** Instagram corta a legenda no feed com “… mais” por volta deste ponto */
  captionPreview: 125,
};

export type MediaDTO = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  alt: string | null;
};

export type PostDTO = {
  id: string;
  clientId: string;
  type: PostType;
  status: PostStatus;
  caption: string;
  script: string | null;
  firstComment: string | null;
  location: string | null;
  collaborators: string[];
  aspectRatio: string;
  scheduledAt: string | null;
  pinned: boolean;
  shareToFeed: boolean;
  coverUrl: string | null;
  coverTime: number;
  feedPosition: number;
  media: MediaDTO[];
};

/** Posts que aparecem na grade do perfil, na ordem do Instagram (fixados primeiro). */
export function gridPosts(posts: PostDTO[]): PostDTO[] {
  return posts
    .filter((p) => p.type === "POST" || (p.type === "REEL" && p.shareToFeed))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.feedPosition - b.feedPosition);
}

export function storyPosts(posts: PostDTO[]): PostDTO[] {
  return posts
    .filter((p) => p.type === "STORY")
    .sort((a, b) => (a.scheduledAt ?? "9").localeCompare(b.scheduledAt ?? "9") || a.feedPosition - b.feedPosition);
}

export function hashtagsOf(text: string) {
  return text.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.map((h) => h.trim()) ?? [];
}
export function mentionsOf(text: string) {
  return text.match(/(^|\s)@[\w.]+/g)?.map((h) => h.trim()) ?? [];
}

/** Conteúdo congelado num link de cliente. */
export type ShareSnapshot = {
  client: Pick<ClientDTO, "name" | "handle" | "bio" | "website" | "avatarUrl" | "color">;
  posts: PostDTO[];
  generatedAt: string;
};

export type ShareLinkDTO = {
  id: string;
  token: string;
  title: string;
  postCount: number;
  viewCount: number;
  lastViewAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
