"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDaysIcon, CalendarIcon, ClapperboardIcon, Grid3x3Icon, MapPinIcon, PrinterIcon, UsersIcon, XIcon } from "lucide-react";
import { gridPosts, POST_STATUS_COLOR, POST_STATUS_LABEL, POST_TYPE_LABEL, storyPosts, type PostDTO, type ShareSnapshot } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Caption, GridTile, MediaCarousel, PostCover, PostPreview, ProfileHeader, StoriesRow, StoryViewer } from "../feed/ig";
import { PautaCalendar, TYPE_TONE } from "./pauta-calendar";

type Props = { title: string; message: string | null; createdAt: string; snapshot: ShareSnapshot };

export function ShareView({ title, message, createdAt, snapshot }: Props) {
  const { client, posts } = snapshot;
  const [tab, setTab] = useState<"feed" | "pauta">("feed");
  const [open, setOpen] = useState<PostDTO | null>(null);
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const grid = gridPosts(posts);
  const stories = storyPosts(posts);
  const agenda = [...posts]
    .filter((p) => p.status !== "PUBLISHED")
    .sort((a, b) => (a.scheduledAt ?? "9").localeCompare(b.scheduledAt ?? "9"));

  return (
    <div className="min-h-screen bg-neutral-50 pb-16 dark:bg-neutral-900">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur print:static dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tr from-fuchsia-600 to-amber-500 text-xs font-bold text-white">P</div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">Prévia enviada em {format(new Date(createdAt), "d 'de' MMMM, HH:mm", { locale: ptBR })}</p>
          </div>
          <button type="button" onClick={() => window.print()} className="hidden items-center gap-1 rounded-md border px-2.5 py-1 text-xs sm:inline-flex print:hidden">
            <PrinterIcon className="size-3.5" /> Imprimir
          </button>
        </div>
        <nav className="mx-auto flex max-w-3xl px-4 print:hidden">
          {([["feed", "Feed", Grid3x3Icon], ["pauta", "Pauta", CalendarDaysIcon]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn("inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium", tab === id ? "border-foreground" : "border-transparent text-muted-foreground")}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className={cn("mx-auto px-3 pt-4 sm:px-4", tab === "pauta" ? "max-w-5xl" : "max-w-3xl")}>
        {message && (
          <div className="mx-auto mb-4 max-w-md rounded-xl border bg-white p-3 text-sm whitespace-pre-line shadow-xs dark:bg-neutral-950">{message}</div>
        )}

        {tab === "feed" ? (
          <section className="mx-auto max-w-md overflow-hidden rounded-2xl border bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100">
            <ProfileHeader client={client} postCount={grid.length} />
            <StoriesRow stories={stories} onOpen={setStoryIndex} />
            <div className="flex border-t">
              <span className="flex flex-1 justify-center border-t-2 border-neutral-900 py-2.5 dark:border-white">
                <Grid3x3Icon className="size-5" />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-0.5">
              {grid.map((p) => (
                <button key={p.id} type="button" onClick={() => setOpen(p)} className="text-left" aria-label={`Abrir ${POST_TYPE_LABEL[p.type]}`}>
                  <GridTile post={p} showStatus={p.status !== "PUBLISHED"} className={cn(p.status === "PUBLISHED" && "opacity-75")} />
                </button>
              ))}
            </div>
            <p className="px-4 py-3 text-center text-xs text-neutral-500">Toque em um post para ver a legenda completa.</p>
          </section>
        ) : (
          <PautaCalendar posts={agenda} onOpen={setOpen} renderDetail={(p) => <AgendaItem post={p} handle={client.handle} onOpen={() => setOpen(p)} />} />
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">Prévia ilustrativa · gerada com PMedia</p>
      </main>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:p-6" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl dark:bg-neutral-950" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white/95 px-3 py-2 text-xs backdrop-blur dark:bg-neutral-950/95">
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium", TYPE_TONE[open.type].chip)}>{POST_TYPE_LABEL[open.type]}</span>
              <span className="min-w-0 flex-1 truncate font-medium first-letter:uppercase">
                {open.scheduledAt ? format(new Date(open.scheduledAt), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR }) : "Data a definir"}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", POST_STATUS_COLOR[open.status])} />
                {POST_STATUS_LABEL[open.status]}
              </span>
              <button type="button" onClick={() => setOpen(null)} aria-label="Fechar" className="ml-1 rounded-full p-1 hover:bg-muted">
                <XIcon className="size-4" />
              </button>
            </div>
            <PostPreview client={client} post={open} />
            {open.type === "REEL" && open.caption && (
              <div className="p-3"><Caption handle={client.handle} text={open.caption} truncate={false} /></div>
            )}
          </div>
        </div>
      )}
      {storyIndex !== null && <StoryViewer client={client} stories={stories} start={storyIndex} onClose={() => setStoryIndex(null)} />}
    </div>
  );
}

function AgendaItem({ post, handle, onOpen }: { post: PostDTO; handle: string; onOpen: () => void }) {
  return (
    <article className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-2xl border bg-white p-3 shadow-xs break-inside-avoid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4 sm:p-4 dark:bg-neutral-950">
      {/* celular: miniatura que abre a prévia · telas maiores: carrossel navegável */}
      <button type="button" onClick={onOpen} aria-label="Ver prévia" className="self-start overflow-hidden rounded-lg sm:hidden">
        <div className={cn("relative", post.type === "POST" ? "aspect-[4/5]" : "aspect-[9/16]")}>
          <PostCover post={post} />
          {post.media.length > 1 && <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">1/{post.media.length}</span>}
        </div>
      </button>
      <div className="hidden overflow-hidden rounded-xl sm:block">
        {post.type === "POST" ? (
          <MediaCarousel media={post.media} aspect={post.aspectRatio} />
        ) : (
          <div className="relative aspect-[9/16]">
            <PostCover post={post} />
          </div>
        )}
      </div>
      <div className="grid content-start gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 font-medium dark:bg-neutral-800">
            {post.type === "REEL" ? <ClapperboardIcon className="size-3" /> : null}
            {POST_TYPE_LABEL[post.type]}
            {post.type === "POST" && post.media.length > 1 ? ` · carrossel ${post.media.length}` : ""}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", POST_STATUS_COLOR[post.status])} />
            {POST_STATUS_LABEL[post.status]}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm font-semibold first-letter:uppercase">
          <CalendarIcon className="size-4" />
          {post.scheduledAt ? format(new Date(post.scheduledAt), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR }) : "Data a definir"}
        </p>
        {post.caption ? <Caption handle={post.type === "STORY" ? undefined : handle} text={post.caption} truncate={false} /> : <p className="text-sm italic text-muted-foreground">Sem legenda</p>}
        {post.firstComment && (
          <p className="text-xs text-muted-foreground"><b>1º comentário:</b> {post.firstComment}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {post.location && <span className="inline-flex items-center gap-1"><MapPinIcon className="size-3" />{post.location}</span>}
          {post.collaborators.length > 0 && <span className="inline-flex items-center gap-1"><UsersIcon className="size-3" />{post.collaborators.map((c) => `@${c}`).join(", ")}</span>}
        </div>
      </div>
    </article>
  );
}
