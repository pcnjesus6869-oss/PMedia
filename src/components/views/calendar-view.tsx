"use client";

import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ImagePlusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { POST_STATUS_COLOR, POST_STATUS_LABEL, POST_TYPE_LABEL, POST_TYPES, PRIORITY_COLOR, type PostDTO, type TaskDTO } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { PostCover } from "../feed/ig";
import { TYPE_TONE } from "../share/pauta-calendar";
import { TaskCard } from "../task-card";
import { MemberAvatar } from "../team";
import { useWorkspace } from "../workspace-context";

const DAY_FMT = "yyyy-MM-dd";
const NO_DATE = "no-date";
const POST_PREFIX = "post:";
const MAX_IN_CELL = 4;
const opts = { locale: ptBR, weekStartsOn: 1 as const };

/** Agenda editorial: mês inteiro com posts e tarefas do cliente selecionado. */
export function CalendarView() {
  const { rootTasks, patchTask, posts, patchPost, openPost, openTask, clientFilter } = useWorkspace();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<Date>(() => new Date());

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), opts), end: endOfWeek(endOfMonth(cursor), opts) });
  const postsOn = (day: Date) =>
    posts.filter((p) => p.scheduledAt && isSameDay(new Date(p.scheduledAt), day)).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  const tasksOn = (day: Date) =>
    rootTasks.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day)).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const undated = rootTasks.filter((t) => !t.dueDate && t.status !== "DONE");

  const monthPosts = posts.filter((p) => p.scheduledAt && isSameMonth(new Date(p.scheduledAt), cursor));
  const monthTasks = rootTasks.filter((t) => t.dueDate && isSameMonth(new Date(t.dueDate), cursor));

  const go = (n: number) => {
    const next = addMonths(cursor, n);
    setCursor(next);
    setSelected(startOfMonth(next));
  };
  const goToday = () => {
    setCursor(new Date());
    setSelected(new Date());
  };

  const atDay = (dayId: string, prevIso: string | null, fallbackHour: number) => {
    const target = parse(dayId, DAY_FMT, new Date());
    const prev = prevIso ? new Date(prevIso) : null;
    target.setHours(prev?.getHours() ?? fallbackHour, prev?.getMinutes() ?? 0, 0, 0);
    return target.toISOString();
  };

  const onDragEnd = ({ draggableId, destination, source }: DropResult) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    if (draggableId.startsWith(POST_PREFIX)) {
      const post = posts.find((p) => p.id === draggableId.slice(POST_PREFIX.length));
      if (!post || destination.droppableId === NO_DATE) return;
      return patchPost({ id: post.id, scheduledAt: atDay(destination.droppableId, post.scheduledAt, 12) });
    }
    const task = rootTasks.find((t) => t.id === draggableId);
    if (!task) return;
    if (destination.droppableId === NO_DATE) return patchTask({ id: task.id, dueDate: null });
    patchTask({ id: task.id, dueDate: atDay(destination.droppableId, task.dueDate, 18) });
  };

  const dayIso = (hour: number) => new Date(new Date(selected).setHours(hour, 0, 0, 0)).toISOString();
  const selPosts = postsOn(selected);
  const selTasks = tasksOn(selected);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          {/* Cabeçalho do mês */}
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-3 sm:px-4">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon-sm" onClick={() => go(-1)} aria-label="Mês anterior">
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
              <Button variant="outline" size="icon-sm" onClick={() => go(1)} aria-label="Próximo mês">
                <ChevronRightIcon />
              </Button>
            </div>
            <h2 className="text-base font-semibold first-letter:uppercase">{format(cursor, "MMMM yyyy", opts)}</h2>
            <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {POST_TYPES.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", TYPE_TONE[t].dot)} />
                  <b className="text-foreground">{monthPosts.filter((p) => p.type === t).length}</b> {POST_TYPE_LABEL[t]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm border-2 border-neutral-400" />
                <b className="text-foreground">{monthTasks.length}</b> Tarefas
              </span>
            </div>
          </header>

          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {days.slice(0, 7).map((d) => (
              <div key={d.toISOString()} className="py-1.5">
                <span className="sm:hidden">{format(d, "EEEEE", opts)}</span>
                <span className="hidden sm:inline">{format(d, "EEE", opts).replace(".", "")}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => (
              <DayCell
                key={day.toISOString()}
                day={day}
                posts={postsOn(day)}
                tasks={tasksOn(day)}
                outside={!isSameMonth(day, cursor)}
                active={isSameDay(day, selected)}
                showClient={clientFilter === "ALL"}
                onSelect={() => setSelected(day)}
              />
            ))}
          </div>
          <p className="px-4 py-2 text-xs text-muted-foreground">Arraste posts e tarefas entre os dias para reagendar. Clique em um dia para ver o detalhe.</p>
        </section>

        {/* Painel do dia */}
        <aside className="grid gap-4">
          <section className="rounded-2xl border bg-card p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold first-letter:uppercase">{format(selected, "EEEE, d 'de' MMMM", opts)}</h3>
              {isToday(selected) && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Hoje</span>}
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => openPost(null, { type: "POST", scheduledAt: dayIso(12) })} disabled={clientFilter === "ALL"} title={clientFilter === "ALL" ? "Escolha um cliente no topo" : undefined}>
                <ImagePlusIcon /> Post
              </Button>
              <Button size="sm" variant="outline" onClick={() => openTask(null, { dueDate: dayIso(18), ...(clientFilter !== "ALL" ? { clientId: clientFilter } : {}) })}>
                <PlusIcon /> Tarefa
              </Button>
            </div>
            {selPosts.length + selTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nada programado neste dia.</p>
            ) : (
              <div className="grid gap-2">
                {selPosts.map((p) => (
                  <PostRow key={p.id} post={p} onOpen={() => openPost(p)} />
                ))}
                {selTasks.map((t) => (
                  <TaskCard key={t.id} task={t} showStatusDot className="p-2.5" />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-muted/30 p-3">
            <h3 className="text-sm font-semibold">
              Tarefas sem data <span className="font-normal text-muted-foreground">· {undated.length}</span>
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">Arraste para um dia do calendário.</p>
            <Droppable droppableId={NO_DATE}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex min-h-12 flex-col gap-2">
                  {undated.map((task, i) => (
                    <Draggable key={task.id} draggableId={task.id} index={i}>
                      {(p) => (
                        <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                          <TaskCard task={task} className="p-2.5" />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </section>
        </aside>
      </div>
    </DragDropContext>
  );
}

function DayCell({
  day,
  posts,
  tasks,
  outside,
  active,
  showClient,
  onSelect,
}: {
  day: Date;
  posts: PostDTO[];
  tasks: TaskDTO[];
  outside: boolean;
  active: boolean;
  showClient: boolean;
  onSelect: () => void;
}) {
  const total = posts.length + tasks.length;
  const visiblePosts = posts.slice(0, MAX_IN_CELL);
  const visibleTasks = tasks.slice(0, Math.max(MAX_IN_CELL - visiblePosts.length, 0));
  const hidden = total - visiblePosts.length - visibleTasks.length;

  return (
    <Droppable droppableId={format(day, DAY_FMT)}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          onClick={onSelect}
          className={cn(
            "relative flex min-h-[84px] cursor-pointer flex-col gap-1 border-b border-r p-1 [&:nth-child(7n)]:border-r-0 sm:min-h-[128px] sm:p-1.5",
            outside && "bg-muted/30",
            active && "bg-primary/5 ring-2 ring-inset ring-primary",
            snapshot.isDraggingOver && "bg-primary/10",
          )}
        >
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center self-end rounded-full text-xs",
              outside && "text-muted-foreground/50",
              isToday(day) && "bg-primary font-semibold text-primary-foreground",
            )}
          >
            {format(day, "d")}
          </span>

          {visiblePosts.map((post, i) => (
            <Draggable key={post.id} draggableId={POST_PREFIX + post.id} index={i}>
              {(p, s) => (
                <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={cn(s.isDragging && "z-20")}>
                  <PostChip post={post} showClient={showClient} />
                </div>
              )}
            </Draggable>
          ))}
          {visibleTasks.map((task, i) => (
            <Draggable key={task.id} draggableId={task.id} index={visiblePosts.length + i}>
              {(p, s) => (
                <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={cn(s.isDragging && "z-20")}>
                  <TaskChip task={task} />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
          {hidden > 0 && <span className="px-1 text-[11px] font-medium text-muted-foreground">+{hidden} mais</span>}
        </div>
      )}
    </Droppable>
  );
}

function PostChip({ post, showClient }: { post: PostDTO; showClient: boolean }) {
  const { openPost, clientById } = useWorkspace();
  const client = clientById.get(post.clientId);
  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        openPost(post);
      }}
      title={`${POST_TYPE_LABEL[post.type]} · ${POST_STATUS_LABEL[post.status]}${post.caption ? `\n${post.caption.slice(0, 120)}` : ""}`}
      className={cn("flex items-center gap-1 rounded-md border p-0.5 text-left text-[11px] leading-tight sm:pr-1", TYPE_TONE[post.type].chip)}
    >
      <span className={cn("block shrink-0 overflow-hidden rounded-sm", post.type === "POST" ? "size-5 sm:size-6" : "h-6 w-3.5 sm:h-7 sm:w-4")}>
        <PostCover post={post} />
      </span>
      <span className="hidden min-w-0 flex-1 sm:block">
        <span className="flex items-center gap-1 font-semibold">
          {format(new Date(post.scheduledAt!), "HH:mm")}
          <span className={cn("size-1.5 shrink-0 rounded-full", POST_STATUS_COLOR[post.status])} />
        </span>
        <span className="block truncate opacity-80">{showClient && client ? client.name : POST_TYPE_LABEL[post.type]}</span>
      </span>
    </div>
  );
}

function TaskChip({ task }: { task: TaskDTO }) {
  const { openTask, memberById, assigneeOf } = useWorkspace();
  const assigneeId = assigneeOf(task);
  const done = task.status === "DONE";
  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        openTask(task);
      }}
      title={task.title}
      className="flex items-center gap-1 rounded-md border bg-background px-1 py-0.5 text-left text-[11px] leading-tight"
    >
      <span className={cn("flex size-3 shrink-0 items-center justify-center rounded-sm border", done ? "border-emerald-500 bg-emerald-500 text-white" : PRIORITY_COLOR[task.priority].split(" ")[0])}>
        {done && <CheckIcon className="size-2.5" />}
      </span>
      <span className={cn("hidden min-w-0 flex-1 truncate sm:block", done && "text-muted-foreground line-through")}>{task.title}</span>
      <span className="hidden sm:inline-flex">
        <MemberAvatar member={assigneeId ? memberById.get(assigneeId) : null} size={14} />
      </span>
    </div>
  );
}

function PostRow({ post, onOpen }: { post: PostDTO; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={cn("flex w-full items-center gap-2.5 rounded-lg border p-2 text-left", TYPE_TONE[post.type].chip)}>
      <span className={cn("block shrink-0 overflow-hidden rounded", post.type === "POST" ? "size-11" : "h-12 w-7")}>
        <PostCover post={post} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          {format(new Date(post.scheduledAt!), "HH:mm")} · {POST_TYPE_LABEL[post.type]}
        </span>
        <span className="block truncate text-xs opacity-80">{post.caption.split("\n")[0] || "Sem legenda"}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] opacity-80">
          <span className={cn("size-1.5 rounded-full", POST_STATUS_COLOR[post.status])} />
          {POST_STATUS_LABEL[post.status]}
        </span>
      </span>
    </button>
  );
}
