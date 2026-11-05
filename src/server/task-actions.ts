"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, toDate, type Result } from "./util";
import { lifecycleDates } from "@/lib/domain";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  parsedTaskSchema,
  taskInputSchema,
  taskUpdateSchema,
  type TaskInput,
  type TaskUpdate,
} from "@/lib/schemas";


async function connectTags(userId: string, names: string[] | undefined) {
  if (!names) return undefined;
  const tags = await Promise.all(
    [...new Set(names)].map((name) =>
      db.tag.upsert({
        where: { userId_name: { userId, name } },
        update: {},
        create: { userId, name },
        select: { id: true },
      }),
    ),
  );
  return tags;
}

async function assertOwnership(userId: string, clientId?: string | null, parentId?: string | null, assigneeId?: string | null) {
  if (assigneeId) await db.member.findFirstOrThrow({ where: { id: assigneeId, userId } });
  if (clientId) await db.client.findFirstOrThrow({ where: { id: clientId, userId } });
  if (parentId) await db.task.findFirstOrThrow({ where: { id: parentId, userId } });
}

export async function createTask(input: TaskInput): Promise<Result<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    const data = taskInputSchema.parse(input);
    await assertOwnership(user.id, data.clientId, data.parentId, data.assigneeId);
    const tags = await connectTags(user.id, data.tagNames);
    const last = await db.task.aggregate({ where: { userId: user.id, status: data.status }, _max: { position: true } });

    const task = await db.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        dueDate: toDate(data.dueDate),
        // início/conclusão são registrados automaticamente pelo status
        ...lifecycleDates(data.status, null),
        estimatedMinutes: data.estimatedMinutes ?? null,
        clientId: data.clientId ?? null,
        assigneeId: data.assigneeId ?? null,
        parentId: data.parentId ?? null,
        position: (last._max.position ?? 0) + 1,
        userId: user.id,
        tags: tags ? { connect: tags } : undefined,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id: task.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTask(input: TaskUpdate): Promise<Result> {
  try {
    const user = await getCurrentUser();
    // startDate vindo do cliente é ignorado: é derivado do status
    const { id, tagNames, dueDate, startDate: _ignored, ...rest } = taskUpdateSchema.parse(input);
    void _ignored;
    const current = await db.task.findFirstOrThrow({ where: { id, userId: user.id } });
    await assertOwnership(user.id, rest.clientId, rest.parentId, rest.assigneeId);
    if (rest.parentId === id) throw new Error("Uma tarefa não pode ser subtarefa de si mesma");
    const tags = await connectTags(user.id, tagNames);

    await db.task.update({
      where: { id },
      data: {
        ...rest,
        dueDate: toDate(dueDate),
        ...(rest.status && rest.status !== current.status ? lifecycleDates(rest.status, current) : {}),
        tags: tags ? { set: tags } : undefined,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string): Promise<Result> {
  try {
    const user = await getCurrentUser();
    await db.task.deleteMany({ where: { id, userId: user.id } });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Persiste o resultado do parser de IA: tarefas + subtarefas encadeadas. */
const saveParsedSchema = z.object({
  tasks: z.array(parsedTaskSchema).min(1).max(20),
  clientId: z.string().nullable().optional(),
});

export async function saveParsedTasks(input: z.input<typeof saveParsedSchema>): Promise<Result<{ count: number }>> {
  try {
    const user = await getCurrentUser();
    const { tasks, clientId } = saveParsedSchema.parse(input);
    await assertOwnership(user.id, clientId);

    let count = 0;
    await db.$transaction(async (tx) => {
      for (const t of tasks) {
        const due = t.dueDate && !Number.isNaN(Date.parse(t.dueDate)) ? new Date(t.dueDate) : null;
        await tx.task.create({
          data: {
            title: t.title.slice(0, 200),
            priority: t.priority,
            dueDate: due,
            estimatedMinutes: t.estimatedMinutes,
            clientId: clientId ?? null,
            userId: user.id,
            position: Date.now() / 1000,
            subtasks: {
              create: t.subtasks.map((title, i) => ({
                title: title.slice(0, 200),
                priority: t.priority,
                dueDate: due,
                clientId: clientId ?? null,
                userId: user.id,
                position: i,
              })),
            },
          },
        });
        count += 1 + t.subtasks.length;
      }
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { count } };
  } catch (e) {
    return fail(e);
  }
}
