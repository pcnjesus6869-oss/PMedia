"use client";

import { useState, useTransition } from "react";
import { addDays, differenceInCalendarDays, format, nextFriday, setHours, setMinutes, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckIcon, CircleCheckBigIcon, Loader2Icon, PlayIcon, PlusIcon, SquareCheckBigIcon, Trash2Icon } from "lucide-react";
import { createTask, deleteTask } from "@/server/task-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  PRIORITIES,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_HINT,
  STATUS_LABEL,
  STATUS_TONE,
  type Priority,
  type Status,
  type TaskDTO,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./team";
import { useWorkspace } from "./workspace-context";

const toLocalInput = (iso: string | null | undefined) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const at18 = (d: Date) => format(setMinutes(setHours(startOfDay(d), 18), 0), "yyyy-MM-dd'T'HH:mm");

export function TaskDialog() {
  const { editing, closeTask } = useWorkspace();
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && closeTask()}>
      <DialogContent className="sm:max-w-xl">
        {editing && <TaskForm key={editing.task?.id ?? "new"} task={editing.task} defaults={editing.defaults} />}
      </DialogContent>
    </Dialog>
  );
}

/** Linha de propriedade: rótulo à esquerda, controle à direita (empilha no celular). */
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span className="pt-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="grid gap-1.5">
        {children}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function Pill({ active, onClick, className, children }: { active: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
        active ? className : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TaskForm({ task, defaults }: { task: TaskDTO | null; defaults?: Partial<TaskDTO> }) {
  const { clients, members, clientById, memberById, subtasksOf, patchTask, closeTask } = useWorkspace();
  const src = { ...defaults, ...task };
  const [title, setTitle] = useState(src.title ?? "");
  const [description, setDescription] = useState(src.description ?? "");
  const [status, setStatus] = useState<Status>(src.status ?? "NOT_STARTED");
  const [priority, setPriority] = useState<Priority>(src.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(toLocalInput(src.dueDate));
  const [clientId, setClientId] = useState(src.clientId ?? "");
  const [assigneeId, setAssigneeId] = useState(src.assigneeId ?? "");
  const [newSub, setNewSub] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const client = clientId ? clientById.get(clientId) : undefined;
  const clientOwner = client?.ownerId ? memberById.get(client.ownerId) : undefined;
  const subtasks = task ? subtasksOf(task.id) : [];
  const today = new Date();

  // Início registrado automaticamente quando a tarefa sai de "Não iniciada"
  const startInfo = (() => {
    if (status === "NOT_STARTED") return "O início é registrado automaticamente quando a tarefa entrar em andamento.";
    const start = task?.startDate && task.status !== "NOT_STARTED" ? new Date(task.startDate) : null;
    if (!start) return "Início será registrado agora, ao salvar.";
    const days = differenceInCalendarDays(today, start);
    return `Em andamento desde ${format(start, "d 'de' MMM", { locale: ptBR })}${days > 0 ? ` · ${days} dia${days > 1 ? "s" : ""}` : " · hoje"}`;
  })();

  const payload = (st: Status = status) => ({
    title,
    description: description || null,
    status: st,
    priority,
    dueDate: fromLocalInput(dueDate),
    clientId: clientId || null,
    assigneeId: assigneeId || null,
  });

  const commit = (st: Status = status) => {
    if (!title.trim()) return setError("Dê um título para a tarefa");
    startTransition(async () => {
      if (task) {
        patchTask({ id: task.id, ...payload(st) });
        closeTask();
      } else {
        const res = await createTask(payload(st));
        if (res.ok) closeTask();
        else setError(res.error);
      }
    });
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    commit();
  };

  const remove = () =>
    startTransition(async () => {
      if (!task || !confirm("Excluir esta tarefa?")) return;
      const res = await deleteTask(task.id);
      if (res.ok) closeTask();
      else setError(res.error);
    });

  const addSubtask = () =>
    startTransition(async () => {
      if (!task || !newSub.trim()) return;
      const res = await createTask({ title: newSub, parentId: task.id, clientId: task.clientId, assigneeId: task.assigneeId, priority: task.priority });
      if (res.ok) setNewSub("");
      else setError(res.error);
    });

  const quickDates: [string, Date][] = [
    ["Hoje", today],
    ["Amanhã", addDays(today, 1)],
    ["Sexta", nextFriday(today)],
    ["+1 semana", addDays(today, 7)],
  ];

  return (
    <form onSubmit={save} className="grid gap-5">
      <DialogHeader className="flex-row items-center gap-3 pr-8">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SquareCheckBigIcon className="size-5" />
        </span>
        <div className="grid gap-0.5">
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription className="text-xs">
            {task?.completedAt && task.status === "DONE"
              ? `Concluída em ${format(new Date(task.completedAt), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}`
              : "Fica visível no Kanban, na Agenda e na Matriz."}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="grid gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da tarefa"
          aria-label="Título"
          autoFocus
          className="h-11 rounded-xl border-0 bg-muted/50 px-3 text-base font-semibold shadow-none focus-visible:bg-background"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Descrição, briefing, links…"
          aria-label="Descrição"
          className="min-h-20 resize-y rounded-xl border-0 bg-muted/50 px-3 py-2 text-sm outline-none focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/40"
        />
      </div>

      <div className="grid gap-4 rounded-2xl border p-4">
        <Field
          label="Status"
          hint={
            <span className="inline-flex items-center gap-1.5">
              {status === "IN_PROGRESS" && <PlayIcon className="size-3 fill-current text-sky-500" />}
              {STATUS_HINT[status]}. {startInfo}
            </span>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <Pill key={s} active={status === s} onClick={() => setStatus(s)} className={STATUS_TONE[s].pill}>
                <span className={cn("size-1.5 rounded-full", STATUS_TONE[s].dot)} />
                {STATUS_LABEL[s]}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Prioridade">
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <Pill key={p} active={priority === p} onClick={() => setPriority(p)} className={cn("border-current/20", PRIORITY_COLOR[p])}>
                {PRIORITY_LABEL[p]}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Prazo">
          <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Prazo" className="w-full sm:w-60" />
          <div className="flex flex-wrap gap-1">
            {quickDates.map(([label, d]) => (
              <button key={label} type="button" onClick={() => setDueDate(at18(d))} className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                {label}
              </button>
            ))}
            {dueDate && (
              <button type="button" onClick={() => setDueDate("")} className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                Sem prazo
              </button>
            )}
          </div>
        </Field>

        <Field label="Cliente">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 size-2.5 -translate-y-1/2 rounded-full" style={{ background: client?.color ?? "#cbd5e1" }} />
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              aria-label="Cliente"
              className="h-8 w-full rounded-lg border border-input bg-transparent pl-7 pr-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-60"
            >
              <option value="">Sem cliente (interno)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Responsável">
          <div className="flex flex-wrap gap-1.5">
            <Pill active={assigneeId === ""} onClick={() => setAssigneeId("")} className="border-foreground/20 bg-foreground text-background">
              <MemberAvatar member={clientOwner ?? null} size={18} />
              {clientOwner ? `${clientOwner.name.split(" ")[0]} (resp. do cliente)` : "Sem responsável"}
            </Pill>
            {members
              .filter((m) => m.id !== clientOwner?.id)
              .map((m) => (
                <Pill key={m.id} active={assigneeId === m.id} onClick={() => setAssigneeId(m.id)} className="border-foreground/20 bg-foreground text-background">
                  <MemberAvatar member={m} size={18} />
                  {m.name.split(" ")[0]}
                </Pill>
              ))}
          </div>
        </Field>
      </div>

      {task && (
        <details className="group rounded-2xl border px-4 py-3" open={subtasks.length > 0 && subtasks.length <= 4}>
          <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Subtarefas {subtasks.length > 0 && `· ${subtasks.filter((s) => s.status === "DONE").length}/${subtasks.length}`}
          </summary>
          <ul className="mt-2 grid gap-1">
            {subtasks.map((s) => {
              const done = s.status === "DONE";
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => patchTask({ id: s.id, status: done ? "NOT_STARTED" : "DONE" })} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-muted/60">
                    <span className={cn("flex size-4 items-center justify-center rounded border", done && "border-emerald-500 bg-emerald-500 text-white")}>
                      {done && <CheckIcon className="size-3" />}
                    </span>
                    <span className={cn(done && "text-muted-foreground line-through")}>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex gap-2">
            <Input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder="Adicionar subtarefa…"
              className="h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubtask();
                }
              }}
            />
            <Button type="button" variant="outline" size="icon-sm" onClick={addSubtask} disabled={pending} aria-label="Adicionar subtarefa">
              <PlusIcon />
            </Button>
          </div>
        </details>
      )}

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <DialogFooter className="sm:justify-between">
        {task ? (
          <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={remove} disabled={pending}>
            <Trash2Icon /> Excluir
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={closeTask}>Cancelar</Button>
          {task && status !== "IN_PROGRESS" && status !== "DONE" && (
            <Button type="button" variant="secondary" onClick={() => commit("IN_PROGRESS")} disabled={pending} title="Salva como Em desenvolvimento e registra o início">
              <PlayIcon className="fill-current" /> Deixar em andamento
            </Button>
          )}
          {task && status !== "DONE" && (
            <Button type="button" variant="secondary" onClick={() => commit("DONE")} disabled={pending}>
              <CircleCheckBigIcon /> Concluir
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            {task ? "Salvar" : "Criar tarefa"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
