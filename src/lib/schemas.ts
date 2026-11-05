import { z } from "zod";
import { LIMITS, POST_STATUSES, POST_TYPES, PRIORITIES, STATUSES } from "./domain";

const isoDate = z.iso.datetime({ offset: true }).nullable();

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(200),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(STATUSES).default("NOT_STARTED"),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  dueDate: isoDate.optional(),
  startDate: isoDate.optional(),
  estimatedMinutes: z.number().int().min(0).max(100_000).nullable().optional(),
  clientId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  tagNames: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});
export type TaskInput = z.input<typeof taskInputSchema>;

export const taskUpdateSchema = taskInputSchema
  .partial()
  .extend({ id: z.string().min(1), position: z.number().optional() });
export type TaskUpdate = z.input<typeof taskUpdateSchema>;

/** URLs de mídia são sempre servidas pelo próprio app. */
const mediaUrl = z.string().regex(/^\/api\/media\/[\w-]+$/, "URL de mídia inválida");

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  handle: z
    .string()
    .trim()
    .transform((h) => h.replace(/^@/, ""))
    .pipe(z.string().regex(/^[\w.]{0,30}$/, "@ inválido (letras, números, _ e .)")),
  bio: z.string().max(150, "Bio do Instagram tem no máx. 150 caracteres").nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  avatarUrl: mediaUrl.nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  targetDate: isoDate.optional(),
  ownerId: z.string().nullable().optional(),
});
export type ClientInput = z.input<typeof clientInputSchema>;

export const memberInputSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  role: z.string().trim().max(60).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});
export type MemberInput = z.input<typeof memberInputSchema>;

/* ---------- Conteúdo ---------- */

export const postInputSchema = z.object({
  clientId: z.string().min(1),
  type: z.enum(POST_TYPES),
  status: z.enum(POST_STATUSES).default("DRAFT"),
  caption: z.string().max(LIMITS.caption, `Legenda passa de ${LIMITS.caption} caracteres`).default(""),
  script: z.string().max(10000).nullable().optional(),
  firstComment: z.string().max(LIMITS.caption).nullable().optional(),
  location: z.string().max(100).nullable().optional(),
  collaborators: z
    .array(z.string().trim().transform((h) => h.replace(/^@/, "")).pipe(z.string().regex(/^[\w.]{1,30}$/)))
    .max(LIMITS.collaborators, `Máximo de ${LIMITS.collaborators} colaboradores`)
    .default([]),
  aspectRatio: z.enum(["4:5", "1:1", "3:4", "1.91:1", "9:16"]).default("4:5"),
  scheduledAt: isoDate.optional(),
  pinned: z.boolean().default(false),
  shareToFeed: z.boolean().default(true),
  coverUrl: mediaUrl.nullable().optional(),
  coverTime: z.number().min(0).max(3600).default(0),
  /** Ids de MediaAsset já enviados, na ordem do carrossel */
  media: z
    .array(z.object({ id: z.string().min(1), alt: z.string().max(1000).nullable().optional() }))
    .max(LIMITS.carousel, `Carrossel aceita até ${LIMITS.carousel} mídias`),
});
export type PostInput = z.input<typeof postInputSchema>;

export const postUpdateSchema = postInputSchema.partial().extend({ id: z.string().min(1), feedPosition: z.number().optional() });
export type PostUpdate = z.input<typeof postUpdateSchema>;

export const shareInputSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1, "Dê um nome à prévia").max(120),
  message: z.string().max(2000).nullable().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  includeDrafts: z.boolean().default(false),
  includePublished: z.boolean().default(true),
});
export type ShareInput = z.input<typeof shareInputSchema>;

/* ---------- Módulo de IA ---------- */

export const parseTaskRequestSchema = z.object({
  text: z.string().trim().min(3).max(2000),
  /** Momento atual do cliente (ISO com offset) para resolver “amanhã”, “sexta”… */
  now: z.iso.datetime({ offset: true }).optional(),
  timeZone: z.string().max(64).optional(),
});

/** Contrato estrito de saída do LLM (e do fallback heurístico). */
export const parsedTaskSchema = z.object({
  title: z.string().describe("Título curto e claro, iniciando com verbo quando fizer sentido"),
  dueDate: z
    .string()
    .nullable()
    .describe("Data/hora ISO 8601 com offset, resolvida a partir do momento atual; null se não houver"),
  priority: z.enum(PRIORITIES).describe(
    "URGENT=urgente e importante, HIGH=importante não urgente, MEDIUM=urgente não importante, LOW=nenhum",
  ),
  estimatedMinutes: z.number().int().nullable().describe("Estimativa em minutos, se inferível"),
  subtasks: z.array(z.string()).describe("Subpassos identificados no texto (pode ser vazio)"),
});

export const parseTaskResponseSchema = z.object({
  tasks: z.array(parsedTaskSchema).describe("Uma entrada por tarefa independente encontrada no texto"),
});

export type ParsedTask = z.infer<typeof parsedTaskSchema>;
export type ParseTaskResponse = z.infer<typeof parseTaskResponseSchema> & {
  source: "claude" | "heuristic";
};
