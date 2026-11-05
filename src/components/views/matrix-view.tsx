"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTask } from "@/server/task-actions";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { QUADRANTS, quadrantOf, type Quadrant } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { TaskCard } from "../task-card";
import { useWorkspace } from "../workspace-context";
import { MemberAvatar, MemberFilter, useMemberFilteredTasks } from "../team";

export function MatrixView() {
  const { allRootTasks, patchTask } = useWorkspace();
  const rootTasks = useMemberFilteredTasks(allRootTasks);
  const [showDone, setShowDone] = useState(false);
  const visible = rootTasks.filter((t) => showDone || t.status !== "DONE");

  const onDragEnd = ({ draggableId, destination }: DropResult) => {
    if (!destination) return;
    const q = QUADRANTS.find((x) => x.id === (destination.droppableId as Quadrant))!;
    const task = visible.find((t) => t.id === draggableId);
    if (task && task.priority !== q.priority) patchTask({ id: draggableId, priority: q.priority });
  };

  return (
    <div className="grid gap-3">
      <MemberFilter tasks={allRootTasks} />
      <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
        <input type="checkbox" className="size-4 accent-primary" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        Mostrar concluídas
      </label>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] grid-rows-[auto_1fr_1fr] gap-2 sm:gap-3">
          <div />
          <AxisLabel>Urgente</AxisLabel>
          <AxisLabel>Não urgente</AxisLabel>

          {(["important", "not-important"] as const).map((row) => (
            <Row key={row} row={row} tasks={visible} />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

function AxisLabel({ children, vertical }: { children: React.ReactNode; vertical?: boolean }) {
  return (
    <div
      className={cn(
        "text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        vertical && "flex items-center justify-center [writing-mode:vertical-rl] rotate-180",
      )}
    >
      {children}
    </div>
  );
}

function Row({ row, tasks }: { row: "important" | "not-important"; tasks: ReturnType<typeof useWorkspace>["rootTasks"] }) {
  const important = row === "important";
  const quads = QUADRANTS.filter((q) => q.important === important).sort((a, b) => Number(b.urgent) - Number(a.urgent));
  return (
    <>
      <AxisLabel vertical>{important ? "Importante" : "Não importante"}</AxisLabel>
      {quads.map((q) => {
        const items = tasks.filter((t) => quadrantOf(t.priority) === q.id);
        return (
          <section key={q.id} className={cn("flex min-h-[220px] flex-col rounded-xl border-2 p-3", q.tone)}>
            <header className="mb-2">
              <h3 className="text-sm font-semibold">
                {q.title} <span className="font-normal text-muted-foreground">· {items.length}</span>
              </h3>
              <p className="text-xs text-muted-foreground">{q.subtitle}</p>
            </header>
            <Droppable droppableId={q.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn("flex flex-1 flex-col gap-2 rounded-lg", snapshot.isDraggingOver && "bg-background/60")}
                >
                  {items.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(p) => (
                        <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                          <TaskCard task={task} showPriority={false} showStatusDot />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            <QuickAdd quadrant={q} />
          </section>
        );
      })}
    </>
  );
}

/**
 * Cria a tarefa direto no bloco: prioridade do quadrante, responsável = colaborador
 * filtrado (ou escolhido), status "Não iniciada". Aparece na hora no Kanban.
 */
function QuickAdd({ quadrant }: { quadrant: (typeof QUADRANTS)[number] }) {
  const { members, clients, memberFilter, memberById, openTask } = useWorkspace();
  const filtered = memberFilter !== "ALL" && memberFilter !== "NONE" ? memberFilter : "";
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string | null>(null); // null = segue o filtro
  const [clientId, setClientId] = useState<string | null>(null); // null = automático
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assigneeId = assignee ?? filtered;
  const portfolio = clients.filter((c) => c.ownerId === assigneeId);
  // cliente automático: se o colaborador atende um único cliente, já vem preenchido
  const effectiveClient = clientId ?? (portfolio.length === 1 ? portfolio[0].id : "");
  const member = assigneeId ? memberById.get(assigneeId) : null;

  const add = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await createTask({
        title,
        priority: quadrant.priority,
        status: "NOT_STARTED",
        assigneeId: assigneeId || null,
        clientId: effectiveClient || null,
      });
      if (!res.ok) return setError(res.error);
      setTitle("");
      setError(null);
    });
  };

  const selectCls = "h-7 min-w-0 rounded-md border border-input bg-background/80 px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

  return (
    <div className="mt-2 grid gap-1.5 rounded-xl border border-dashed border-foreground/15 bg-background/70 p-2">
      <div className="flex items-center gap-1.5">
        <MemberAvatar member={member} size={22} />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Adicionar tarefa…"
          aria-label={`Nova tarefa em ${quadrant.title}`}
          className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="button" size="icon-sm" variant="ghost" onClick={add} disabled={pending || !title.trim()} aria-label="Adicionar">
          {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        </Button>
      </div>
      {(title || assignee !== null || clientId !== null) && (
        <div className="grid grid-cols-2 gap-1.5">
          <select value={assigneeId} onChange={(e) => setAssignee(e.target.value)} aria-label="Responsável" className={selectCls}>
            <option value="">Sem responsável</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select value={effectiveClient} onChange={(e) => setClientId(e.target.value)} aria-label="Cliente" className={selectCls}>
            <option value="">Sem cliente</option>
            {[...portfolio, ...clients.filter((c) => !portfolio.includes(c))].map((c) => (
              <option key={c.id} value={c.id}>{c.name}{portfolio.includes(c) ? " ★" : ""}</option>
            ))}
          </select>
        </div>
      )}
      {title && (
        <button type="button" onClick={() => openTask(null, { title, priority: quadrant.priority, assigneeId: assigneeId || null, clientId: effectiveClient || null })} className="justify-self-start text-[11px] text-muted-foreground underline-offset-2 hover:underline">
          Abrir com mais detalhes
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
