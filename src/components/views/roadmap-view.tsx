"use client";

import { addDays, differenceInCalendarDays, eachWeekOfInterval, format, isWithinInterval, max, min, startOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FlagIcon } from "lucide-react";
import { POST_TYPE_LABEL, PRIORITY_COLOR, STATUS_LABEL, type ClientDTO, type PostDTO, type TaskDTO } from "@/lib/domain";
import { TYPE_TONE } from "../share/pauta-calendar";
import { MemberAvatar } from "../team";
import { cn } from "@/lib/utils";
import { useWorkspace } from "../workspace-context";

const WEEKS = 10;
const opts = { locale: ptBR, weekStartsOn: 1 as const };

/** Visão geral: todos os clientes numa timeline (semana anterior + 9 à frente), com tarefas e conteúdos programados. */
export function RoadmapView() {
  const { allRootTasks: rootTasks, clients, allPosts, memberById, subtasksOf, openTask, openPost } = useWorkspace();

  const start = subDays(startOfWeek(new Date(), opts), 7);
  const end = addDays(start, WEEKS * 7 - 1);
  const totalDays = WEEKS * 7;
  const weeks = eachWeekOfInterval({ start, end }, opts);
  const pct = (d: Date) => (Math.min(Math.max(differenceInCalendarDays(d, start), 0), totalDays) / totalDays) * 100;
  const todayPct = pct(new Date());

  const groups: { client: ClientDTO | null; tasks: TaskDTO[]; posts: PostDTO[] }[] = [
    ...clients.map((c) => ({
      client: c,
      tasks: rootTasks.filter((t) => t.clientId === c.id),
      posts: allPosts.filter((p) => p.clientId === c.id && p.scheduledAt && p.status !== "PUBLISHED"),
    })),
    { client: null, tasks: rootTasks.filter((t) => !t.clientId), posts: [] },
  ].filter((g) => g.client || g.tasks.length);

  return (
    <div className="overflow-x-auto rounded-xl border">
      <div className="min-w-[900px]">
        {/* Cabeçalho de semanas */}
        <div className="grid grid-cols-[220px_1fr] border-b bg-muted/50 text-xs text-muted-foreground">
          <div className="px-3 py-2 font-medium">Cliente / tarefa</div>
          <div className="relative flex">
            {weeks.map((w) => (
              <div key={w.toISOString()} className="flex-1 border-l px-2 py-2 capitalize">
                {format(w, "d MMM", opts)}
              </div>
            ))}
          </div>
        </div>

        {groups.map(({ client, tasks, posts }) => {
          const owner = client?.ownerId ? memberById.get(client.ownerId) : null;
          const inReview = posts.filter((p) => p.status === "IN_REVIEW").length;
          const done = tasks.filter((t) => t.status === "DONE").length;
          const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
          const target = client?.targetDate ? new Date(client.targetDate) : null;
          return (
            <div key={client?.id ?? "none"} className="border-b last:border-b-0">
              <div className="grid grid-cols-[220px_1fr] bg-muted/20">
                <div className="flex min-w-0 items-center gap-2 px-3 py-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: client?.color ?? "#94a3b8" }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{client?.name ?? "Sem cliente"}</span>
                    {client && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {posts.length} conteúdo(s){inReview ? ` · ${inReview} em aprovação` : ""} · {progress}% tarefas
                      </span>
                    )}
                  </span>
                  {client && <span className="ml-auto"><MemberAvatar member={owner} size={22} /></span>}
                </div>
                <div className="relative">
                  <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-muted">
                    <div className="h-1 rounded" style={{ width: `${progress}%`, background: client?.color ?? "#94a3b8" }} />
                  </div>
                  {target && isWithinInterval(target, { start, end }) && (
                    <div className="absolute top-0 flex h-full -translate-x-1/2 items-center" style={{ left: `${pct(target)}%` }} title={`Meta: ${format(target, "d MMM", opts)}`}>
                      <FlagIcon className="size-3.5" style={{ color: client?.color }} />
                    </div>
                  )}
                </div>
              </div>

              {posts.length > 0 && (
                <div className="grid grid-cols-[220px_1fr]">
                  <div className="px-3 py-1.5 pl-7 text-xs font-medium text-muted-foreground">Conteúdos programados</div>
                  <div className="relative h-8">
                    <div className="absolute inset-y-0 w-px bg-rose-500" style={{ left: `${todayPct}%` }} />
                    {posts.filter((p) => isWithinInterval(new Date(p.scheduledAt!), { start, end })).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openPost(p)}
                        title={`${POST_TYPE_LABEL[p.type]} · ${format(new Date(p.scheduledAt!), "d MMM HH:mm", opts)}`}
                        className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background transition hover:scale-150", TYPE_TONE[p.type].dot)}
                        style={{ left: `${pct(new Date(p.scheduledAt!))}%` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {tasks
                .sort((a, b) => (a.startDate ?? a.dueDate ?? "z").localeCompare(b.startDate ?? b.dueDate ?? "z"))
                .map((task) => {
                  const due = task.dueDate ? new Date(task.dueDate) : null;
                  const s = task.startDate ? new Date(task.startDate) : due;
                  const subs = subtasksOf(task.id);
                  return (
                    <div key={task.id} className="grid grid-cols-[220px_1fr] hover:bg-muted/30">
                      <button type="button" onClick={() => openTask(task)} className="truncate px-3 py-1.5 pl-7 text-left text-sm">
                        <span className={cn(task.status === "DONE" && "text-muted-foreground line-through")}>{task.title}</span>
                        {subs.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({subs.filter((x) => x.status === "DONE").length}/{subs.length})</span>}
                      </button>
                      <div className="relative h-8">
                        {weeks.map((w, i) => (
                          <div key={i} className="absolute inset-y-0 border-l border-dashed border-border/60" style={{ left: `${(i / WEEKS) * 100}%` }} />
                        ))}
                        <div className="absolute inset-y-0 w-px bg-rose-500" style={{ left: `${todayPct}%` }} />
                        {s && due && (
                          <button
                            type="button"
                            onClick={() => openTask(task)}
                            title={`${STATUS_LABEL[task.status]} · ${format(s, "d MMM", opts)} → ${format(due, "d MMM", opts)}`}
                            className={cn(
                              "absolute top-1.5 h-5 truncate rounded px-1.5 text-left text-[11px] font-medium",
                              PRIORITY_COLOR[task.priority],
                              task.status === "DONE" && "opacity-50",
                            )}
                            style={{
                              left: `${pct(min([s, due]))}%`,
                              width: `max(${pct(addDays(max([s, due]), 1)) - pct(min([s, due]))}%, 1.25rem)`,
                            }}
                          >
                            {format(due, "d/MM")}
                          </button>
                        )}
                        {!due && <span className="absolute left-2 top-1.5 text-xs text-muted-foreground">sem prazo</span>}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
