"use client";

import { useState, useTransition } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClockIcon, ClapperboardIcon, CircleDashedIcon, Grid3x3Icon, ImagePlusIcon, Link2Icon, PencilIcon, SortDescIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reorderPosts } from "@/server/content-actions";
import { gridPosts, POST_STATUS_COLOR, POST_STATUS_LABEL, POST_TYPE_LABEL, storyPosts, type PostDTO } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useWorkspace } from "../workspace-context";
import { GridTile, PostCover, ProfileHeader, StoriesRow, StoryViewer } from "./ig";
import { ShareDialog } from "./share-dialog";

export function FeedView() {
  const { activeClient, clients, setClientFilter, posts, openPost, openClient, setPostOrder } = useWorkspace();
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<"grid" | "reels">("grid");
  const [shareOpen, setShareOpen] = useState(false);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!activeClient) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h2 className="text-lg font-semibold">Escolha um cliente para ver o feed</h2>
        <div className="mt-4 grid gap-2">
          {clients.map((c) => (
            <Button key={c.id} variant="outline" onClick={() => setClientFilter(c.id)} className="justify-start">
              <span className="size-2.5 rounded-full" style={{ background: c.color }} /> {c.name} <span className="text-muted-foreground">@{c.handle}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const grid = gridPosts(posts);
  const pinned = grid.filter((p) => p.pinned);
  const sortable = grid.filter((p) => !p.pinned);
  const reels = grid.filter((p) => p.type === "REEL");
  const stories = storyPosts(posts);
  const upcoming = posts
    .filter((p) => p.status !== "PUBLISHED")
    .sort((a, b) => (a.scheduledAt ?? "9").localeCompare(b.scheduledAt ?? "9"));

  const persistOrder = (ids: string[]) => {
    setPostOrder(ids);
    startTransition(async () => {
      await reorderPosts(activeClient.id, ids);
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = sortable.map((p) => p.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    persistOrder([...pinned.map((p) => p.id), ...next]);
  };

  /** Ordena como o Instagram exibirá: data mais recente no topo; sem data fica acima de tudo. */
  const sortByDate = () => {
    const ordered = [...sortable].sort((a, b) => (b.scheduledAt ?? "9999").localeCompare(a.scheduledAt ?? "9999"));
    persistOrder([...pinned.map((p) => p.id), ...ordered.map((p) => p.id)]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-start">
      {/* Prévia do perfil */}
      <section className="overflow-hidden rounded-2xl border bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100">
        <ProfileHeader
          client={activeClient}
          postCount={grid.length}
          action={
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => openClient(activeClient)}>
                <PencilIcon /> Editar perfil
              </Button>
              <Button size="sm" onClick={() => setShareOpen(true)}>
                <Link2Icon /> Enviar link para cliente
              </Button>
            </div>
          }
        />
        <StoriesRow stories={stories} onOpen={setStoryIndex} onAdd={() => openPost(null, { type: "STORY" })} />

        <div className="flex border-t text-neutral-500">
          {([["grid", Grid3x3Icon], ["reels", ClapperboardIcon]] as const).map(([id, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-label={id === "grid" ? "Grade" : "Reels"}
              className={cn("flex flex-1 justify-center border-t-2 py-2.5", tab === id ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white" : "border-transparent")}
            >
              <Icon className="size-5" />
            </button>
          ))}
        </div>

        {tab === "grid" ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-3 gap-0.5">
              {pinned.map((p) => (
                <button key={p.id} type="button" onClick={() => openPost(p)} className="text-left">
                  <GridTile post={p} showStatus />
                </button>
              ))}
              <SortableContext items={sortable.map((p) => p.id)} strategy={rectSortingStrategy}>
                {sortable.map((p) => (
                  <SortableTile key={p.id} post={p} onOpen={() => openPost(p)} />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {reels.map((p) => (
              <button key={p.id} type="button" onClick={() => openPost(p)} className="text-left">
                <div className="relative aspect-[9/16] overflow-hidden">
                  <PostCover post={p} />
                </div>
              </button>
            ))}
          </div>
        )}
        {grid.length === 0 && <p className="p-8 text-center text-sm text-neutral-500">Nenhum post ainda. Crie o primeiro!</p>}
      </section>

      {/* Painel lateral */}
      <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openPost(null, { type: "POST" })}>
            <ImagePlusIcon /> Novo post
          </Button>
          <Button variant="outline" onClick={() => openPost(null, { type: "REEL" })}>
            <ClapperboardIcon /> Reels
          </Button>
          <Button variant="outline" onClick={() => openPost(null, { type: "STORY" })}>
            <CircleDashedIcon /> Story
          </Button>
          <Button variant="ghost" onClick={sortByDate} title="Reordena a grade pela data de publicação, como o Instagram exibirá">
            <SortDescIcon /> Organizar por data
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Arraste os posts na grade para planejar a estética do feed. Fixados (📌) ficam sempre no topo, como no Instagram.
        </p>

        <section className="rounded-xl border bg-card">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <CalendarClockIcon className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Programação</h3>
            <span className="text-xs text-muted-foreground">{upcoming.length} não publicados</span>
          </header>
          <ul className="divide-y">
            {upcoming.map((p) => (
              <UpcomingRow key={p.id} post={p} onOpen={() => openPost(p)} />
            ))}
            {upcoming.length === 0 && <li className="p-4 text-sm text-muted-foreground">Tudo publicado por aqui. 🎉</li>}
          </ul>
        </section>
      </aside>

      {storyIndex !== null && <StoryViewer client={activeClient} stories={stories} start={storyIndex} onClose={() => setStoryIndex(null)} />}
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} client={activeClient} />
    </div>
  );
}

function SortableTile({ post, onOpen }: { post: PostDTO; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab touch-none active:cursor-grabbing", isDragging && "z-10 opacity-80 shadow-xl")}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter") onOpen();
      }}
    >
      <GridTile post={post} showStatus />
    </div>
  );
}

function UpcomingRow({ post, onOpen }: { post: PostDTO; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50">
        <span className={cn("block shrink-0 overflow-hidden rounded", post.type === "POST" ? "size-11" : "h-12 w-7")}>
          <PostCover post={post} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{post.caption.split("\n")[0] || <i className="text-muted-foreground">Sem legenda</i>}</span>
          <span className="text-xs text-muted-foreground">
            {POST_TYPE_LABEL[post.type]}
            {post.type === "POST" && post.media.length > 1 ? ` · carrossel (${post.media.length})` : ""} ·{" "}
            {post.scheduledAt ? format(new Date(post.scheduledAt), "EEE, d MMM · HH:mm", { locale: ptBR }) : "sem data"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs">
          <span className={cn("size-2 rounded-full", POST_STATUS_COLOR[post.status])} />
          {POST_STATUS_LABEL[post.status]}
        </span>
      </button>
    </li>
  );
}
