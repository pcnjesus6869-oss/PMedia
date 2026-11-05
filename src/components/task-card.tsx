"use client";

import { differenceInCalendarDays, format, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ListChecksIcon, PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_COLOR, PRIORITY_LABEL, STATUS_LABEL, STATUS_TONE, type TaskDTO } from "@/lib/domain";
import { useWorkspace } from "./workspace-context";
import { MemberAvatar } from "./team";

export function PriorityBadge({ priority, className }: { priority: TaskDTO["priority"]; className?: string }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", PRIORITY_COLOR[priority], className)}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function TaskCard({
  task,
  compact = false,
  showPriority = true,
  /** Mostra o status (fora do Kanban, onde a coluna já indica) */
  showStatusDot = false,
  className,
}: {
  task: TaskDTO;
  compact?: boolean;
  showPriority?: boolean;
  showStatusDot?: boolean;
  className?: string;
}) {
  const { clientById, subtasksOf, openTask, memberById, assigneeOf } = useWorkspace();
  const client = task.clientId ? clientById.get(task.clientId) : undefined;
  const assigneeId = assigneeOf(task);
  const assignee = assigneeId ? memberById.get(assigneeId) : null;
  const subtasks = subtasksOf(task.id);
  const doneSubs = subtasks.filter((s) => s.status === "DONE").length;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && task.status !== "DONE" && isBefore(due, new Date()) && !isToday(due);
  const done = task.status === "DONE";

  return (
    <div
      role="button"
      onClick={() => openTask(task)}
      className={cn(
        "group w-full rounded-lg border bg-card text-left shadow-xs transition hover:border-foreground/20 hover:shadow-sm",
        compact ? "px-2 py-1" : "p-3",
        className,
      )}
      style={client ? { borderLeft: `3px solid ${client.color}` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("font-medium leading-snug", compact ? "text-xs" : "text-sm", done && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        {showPriority && !compact && <PriorityBadge priority={task.priority} className="shrink-0" />}
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <MemberAvatar member={assignee} size={20} />
          {due && (
            <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-rose-600 dark:text-rose-400")}>
              <CalendarIcon className="size-3" />
              {format(due, "d MMM, HH:mm", { locale: ptBR })}
            </span>
          )}
          {task.status === "IN_PROGRESS" && task.startDate && (
            <span className="inline-flex items-center gap-1 font-medium text-sky-700 dark:text-sky-300" title={`Iniciada em ${format(new Date(task.startDate), "d MMM, HH:mm", { locale: ptBR })}`}>
              <PlayIcon className="size-3 fill-current" />
              {(() => {
                const d = differenceInCalendarDays(new Date(), new Date(task.startDate));
                return d <= 0 ? "em andamento · hoje" : `em andamento · ${d}d`;
              })()}
            </span>
          )}
          {!showStatusDot ? null : (
            <span className="inline-flex items-center gap-1">
              <span className={cn("size-1.5 rounded-full", STATUS_TONE[task.status].dot)} />
              {STATUS_LABEL[task.status]}
            </span>
          )}
          {subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecksIcon className="size-3" />
              {doneSubs}/{subtasks.length}
            </span>
          )}
          {client && <span className="truncate">{client.name}</span>}
          {task.tags.map((tag) => (
            <span key={tag.id} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
              #{tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
