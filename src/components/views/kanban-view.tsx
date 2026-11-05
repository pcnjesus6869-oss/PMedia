"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_HINT, STATUS_LABEL, STATUS_TONE, STATUSES, type Status, type TaskDTO } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { TaskCard } from "../task-card";
import { useWorkspace } from "../workspace-context";
import { MemberFilter, useMemberFilteredTasks } from "../team";


/** Calcula a nova `position` como ponto médio entre os vizinhos (evita reindexar a coluna). */
function positionBetween(list: TaskDTO[], index: number) {
  const before = list[index - 1]?.position;
  const after = list[index]?.position;
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

export function KanbanView() {
  const { allRootTasks, patchTask, openTask, memberFilter } = useWorkspace();
  const rootTasks = useMemberFilteredTasks(allRootTasks);
  const newDefaults = memberFilter !== "ALL" && memberFilter !== "NONE" ? { assigneeId: memberFilter } : {};

  const columns = Object.fromEntries(
    STATUSES.map((s) => [s, rootTasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position)]),
  ) as Record<Status, TaskDTO[]>;

  const onDragEnd = ({ draggableId, source, destination }: DropResult) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const status = destination.droppableId as Status;
    const target = columns[status].filter((t) => t.id !== draggableId);
    patchTask({ id: draggableId, status, position: positionBetween(target, destination.index) });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="mb-4"><MemberFilter tasks={allRootTasks} /></div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 [scrollbar-width:thin]">
        {STATUSES.map((status) => (
          <section key={status} className="flex min-h-[260px] w-[272px] shrink-0 snap-start flex-col rounded-2xl bg-muted/50 p-3" title={STATUS_HINT[status]}>
            <header className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn("size-2 rounded-full", STATUS_TONE[status].dot)} />
                {STATUS_LABEL[status]}
                <span className="font-normal text-muted-foreground">{columns[status].length}</span>
              </h3>
              <Button variant="ghost" size="icon-sm" aria-label={`Nova tarefa em ${STATUS_LABEL[status]}`} onClick={() => openTask(null, { status, ...newDefaults })}>
                <PlusIcon />
              </Button>
            </header>
            <Droppable droppableId={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn("flex flex-1 flex-col gap-2 rounded-lg transition-colors", snapshot.isDraggingOver && "bg-primary/5")}
                >
                  {columns[status].map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(p, s) => (
                        <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={cn(s.isDragging && "rotate-1")}>
                          <TaskCard task={task} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </section>
        ))}
      </div>
    </DragDropContext>
  );
}
