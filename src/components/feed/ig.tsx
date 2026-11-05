"use client";

/**
 * Componentes visuais no estilo do Instagram, usados no editor e no link do cliente.
 * Não usam a marca nem o logotipo do Instagram: só a disposição dos elementos.
 */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BookmarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClapperboardIcon,
  CopyIcon,
  HeartIcon,
  ImageIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  MusicIcon,
  PinIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  aspectValue,
  LIMITS,
  POST_STATUS_COLOR,
  POST_STATUS_LABEL,
  type ClientDTO,
  type MediaDTO,
  type PostDTO,
} from "@/lib/domain";

export type IgClient = Pick<ClientDTO, "name" | "handle" | "bio" | "website" | "avatarUrl" | "color">;

const fmtDate = (iso: string) => format(new Date(iso), "d 'de' MMM 'às' HH:mm", { locale: ptBR });

/* ---------------- Básicos ---------------- */

export function Avatar({ client, size = 32, ring = false, seen = false }: { client: IgClient; size?: number; ring?: boolean; seen?: boolean }) {
  const inner = client.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={client.avatarUrl} alt="" className="size-full rounded-full object-cover" />
  ) : (
    <span className="flex size-full items-center justify-center rounded-full text-white" style={{ background: client.color, fontSize: size * 0.4 }}>
      {client.name.charAt(0)}
    </span>
  );
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full", ring && "p-[2px]", ring && (seen ? "bg-neutral-300" : "bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600"))}
      style={{ width: size, height: size }}
    >
      <span className={cn("block size-full rounded-full", ring && "border-2 border-white dark:border-neutral-950")}>{inner}</span>
    </span>
  );
}

export function MediaView({ media, className, coverTime = 0, controls = false, autoPlay = false }: { media: MediaDTO; className?: string; coverTime?: number; controls?: boolean; autoPlay?: boolean }) {
  if (media.kind === "VIDEO") {
    return (
      <video
        src={controls || autoPlay ? media.url : `${media.url}#t=${coverTime}`}
        className={cn("size-full object-cover", className)}
        preload="metadata"
        muted={!controls}
        playsInline
        loop={autoPlay}
        autoPlay={autoPlay}
        controls={controls}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.url} alt={media.alt ?? ""} className={cn("size-full object-cover", className)} draggable={false} />;
}

/** Capa exibida na grade: capa do reel, frame escolhido, ou primeira mídia. */
export function PostCover({ post, className }: { post: PostDTO; className?: string }) {
  if (post.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={post.coverUrl} alt="" className={cn("size-full object-cover", className)} draggable={false} />;
  }
  const first = post.media[0];
  if (!first) {
    return (
      <div className={cn("flex size-full flex-col items-center justify-center gap-1 bg-neutral-100 text-neutral-400 dark:bg-neutral-800", className)}>
        <ImageIcon className="size-6" />
        <span className="text-[10px]">sem mídia</span>
      </div>
    );
  }
  return <MediaView media={first} coverTime={post.coverTime} className={className} />;
}

export function MediaCarousel({ media, aspect, coverTime, playVideo = false, className }: { media: MediaDTO[]; aspect: string; coverTime?: number; playVideo?: boolean; className?: string }) {
  const [index, setIndex] = useState(0);
  const i = Math.min(index, Math.max(media.length - 1, 0));
  const current = media[i];
  return (
    <div className={cn("relative w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900", className)} style={{ aspectRatio: aspectValue(aspect) }}>
      {current ? (
        <MediaView key={current.id} media={current} coverTime={coverTime} autoPlay={playVideo} />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 text-neutral-400">
          <ImageIcon className="size-8" />
          <span className="text-xs">Adicione uma imagem ou vídeo</span>
        </div>
      )}
      {media.length > 1 && (
        <>
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
            {i + 1}/{media.length}
          </span>
          {i > 0 && (
            <button type="button" aria-label="Anterior" onClick={() => setIndex(i - 1)} className="absolute left-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-neutral-800 shadow">
              <ChevronLeftIcon className="size-4" />
            </button>
          )}
          {i < media.length - 1 && (
            <button type="button" aria-label="Próxima" onClick={() => setIndex(i + 1)} className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-neutral-800 shadow">
              <ChevronRightIcon className="size-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function CarouselDots({ count, active = 0 }: { count: number; active?: number }) {
  if (count < 2) return null;
  return (
    <div className="flex justify-center gap-1">
      {Array.from({ length: Math.min(count, 10) }, (_, i) => (
        <span key={i} className={cn("size-1.5 rounded-full", i === active ? "bg-sky-500" : "bg-neutral-300")} />
      ))}
    </div>
  );
}

/** Legenda com #hashtags e @menções destacadas e corte “… mais”. */
export function Caption({ handle, text, truncate = true, className }: { handle?: string; text: string; truncate?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const cut = truncate && !open && (text.length > LIMITS.captionPreview || text.split("\n").length > 2);
  const shown = cut ? text.split("\n").slice(0, 2).join(" ").slice(0, LIMITS.captionPreview).trimEnd() : text;
  const parts = shown.split(/((?:^|\s)[#@][\p{L}\p{N}_.]+)/u);
  return (
    <p className={cn("whitespace-pre-wrap break-words text-[13px] leading-snug", className)}>
      {handle && <span className="mr-1 font-semibold">{handle}</span>}
      {parts.map((p, i) =>
        /^\s?[#@]/.test(p) ? (
          <span key={i} className="text-sky-700 dark:text-sky-400">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
      {cut && (
        <button type="button" onClick={() => setOpen(true)} className="text-neutral-500">
          … mais
        </button>
      )}
    </p>
  );
}

/* ---------------- Perfil ---------------- */

export function ProfileHeader({ client, postCount, action }: { client: IgClient; postCount: number; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <div className="flex items-center gap-5">
        <Avatar client={client} size={76} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{client.handle || client.name}</div>
          <div className="mt-2 flex gap-5 text-sm">
            <span><b>{postCount}</b> posts</span>
            <span className="text-neutral-400"><b className="text-foreground">—</b> seguidores</span>
          </div>
        </div>
      </div>
      <div className="text-[13px] leading-snug">
        <div className="font-semibold">{client.name}</div>
        {client.bio && <p className="whitespace-pre-line">{client.bio}</p>}
        {client.website && <span className="font-medium text-sky-800 dark:text-sky-300">{client.website}</span>}
      </div>
      {action}
    </div>
  );
}

export function StoriesRow({ stories, onOpen, onAdd }: { stories: PostDTO[]; onOpen: (index: number) => void; onAdd?: () => void }) {
  if (!stories.length && !onAdd) return null;
  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
      {onAdd && (
        <button type="button" onClick={onAdd} className="flex w-16 shrink-0 flex-col items-center gap-1 text-[11px]">
          <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 text-2xl text-neutral-400">+</span>
          Novo story
        </button>
      )}
      {stories.map((st, i) => (
        <button key={st.id} type="button" onClick={() => onOpen(i)} className="flex w-16 shrink-0 flex-col items-center gap-1 text-[11px]">
          <span className="relative size-16 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
            <span className="block size-full overflow-hidden rounded-full border-2 border-white dark:border-neutral-950">
              <PostCover post={st} />
            </span>
          </span>
          <span className="w-full truncate text-center">{st.scheduledAt ? format(new Date(st.scheduledAt), "dd/MM HH'h'") : "sem data"}</span>
        </button>
      ))}
    </div>
  );
}

export function GridTile({ post, showStatus = false, className }: { post: PostDTO; showStatus?: boolean; className?: string }) {
  return (
    <div className={cn("group relative aspect-[3/4] overflow-hidden bg-neutral-100 dark:bg-neutral-900", className)}>
      <PostCover post={post} />
      <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
        {post.pinned && <PinIcon className="size-4 rotate-45 fill-white" />}
        {post.type === "REEL" && <ClapperboardIcon className="size-4" />}
        {post.type === "POST" && post.media.length > 1 && <CopyIcon className="size-4" />}
      </div>
      {showStatus && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-medium text-white">
          <span className={cn("size-1.5 shrink-0 rounded-full", POST_STATUS_COLOR[post.status])} />
          <span className="truncate">{post.scheduledAt ? format(new Date(post.scheduledAt), "dd/MM HH:mm") : POST_STATUS_LABEL[post.status]}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Mockups de publicação ---------------- */

export function FeedPostMock({ client, post }: { client: IgClient; post: PostDTO }) {
  const handle = client.handle || client.name;
  return (
    <article className="bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center gap-2.5 px-3 py-2">
        <Avatar client={client} size={32} ring={false} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold">
            {handle}
            {post.collaborators.length > 0 && <span className="font-normal"> e {post.collaborators.length === 1 ? `@${post.collaborators[0]}` : `${post.collaborators.length} outros`}</span>}
          </div>
          {post.location && <div className="truncate text-[11px]">{post.location}</div>}
        </div>
        <MoreHorizontalIcon className="size-5" />
      </header>
      <MediaCarousel media={post.media} aspect={post.type === "POST" ? post.aspectRatio : "4:5"} coverTime={post.coverTime} />
      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <HeartIcon className="size-6" />
        <MessageCircleIcon className="size-6 -scale-x-100" />
        <SendIcon className="size-6" />
        <div className="flex-1"><CarouselDots count={post.media.length} /></div>
        <BookmarkIcon className="size-6" />
      </div>
      <div className="space-y-1 px-3 pb-3 pt-2">
        <Caption handle={handle} text={post.caption || " "} />
        {post.firstComment && (
          <p className="text-[13px] text-neutral-500">
            Ver 1 comentário
            <span className="mt-0.5 block text-neutral-900 dark:text-neutral-100">
              <b className="mr-1">{handle}</b>
              {post.firstComment}
            </span>
          </p>
        )}
        <p className="text-[11px] uppercase tracking-wide text-neutral-400">{post.scheduledAt ? fmtDate(post.scheduledAt) : "Sem data definida"}</p>
      </div>
    </article>
  );
}

export function ReelMock({ client, post }: { client: IgClient; post: PostDTO }) {
  const handle = client.handle || client.name;
  const media = post.media[0];
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden bg-black text-white">
      {media ? <MediaView media={media} autoPlay={media.kind === "VIDEO"} coverTime={post.coverTime} /> : <PostCover post={post} />}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 text-sm font-semibold drop-shadow">
        Reels
        <ClapperboardIcon className="size-5" />
      </div>
      <div className="absolute bottom-16 right-2 flex flex-col items-center gap-4 drop-shadow">
        <HeartIcon className="size-6" />
        <MessageCircleIcon className="size-6 -scale-x-100" />
        <SendIcon className="size-6" />
        <MoreHorizontalIcon className="size-6" />
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/80 to-transparent p-3 pr-12 pt-10">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Avatar client={client} size={28} />
          {handle}
          <span className="rounded-md border border-white/70 px-2 py-0.5 text-[11px]">Seguir</span>
        </div>
        <Caption text={post.caption} className="text-white [&_span.text-sky-700]:text-white [&_span]:dark:text-white" />
        <div className="flex items-center gap-1.5 text-[11px] opacity-90">
          <MusicIcon className="size-3" /> Áudio original · {handle}
        </div>
      </div>
    </div>
  );
}

export function StoryMock({ client, post, progress }: { client: IgClient; post: PostDTO; progress?: { index: number; total: number } }) {
  const media = post.media[0];
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-neutral-900 text-white">
      {media ? <MediaView media={media} autoPlay={media.kind === "VIDEO"} /> : <PostCover post={post} />}
      <div className="absolute inset-x-0 top-0 space-y-2 bg-gradient-to-b from-black/50 to-transparent p-2.5 pb-6">
        <div className="flex gap-1">
          {Array.from({ length: progress?.total ?? 1 }, (_, i) => (
            <span key={i} className={cn("h-0.5 flex-1 rounded-full", i <= (progress?.index ?? 0) ? "bg-white" : "bg-white/40")} />
          ))}
        </div>
        <div className="flex items-center gap-2 text-[13px] font-semibold drop-shadow">
          <Avatar client={client} size={28} />
          {client.handle || client.name}
          <span className="font-normal opacity-80">{post.scheduledAt ? format(new Date(post.scheduledAt), "dd/MM HH:mm") : ""}</span>
        </div>
      </div>
    </div>
  );
}

export function PostPreview({ client, post }: { client: IgClient; post: PostDTO }) {
  if (post.type === "REEL") return <ReelMock client={client} post={post} />;
  if (post.type === "STORY") return <StoryMock client={client} post={post} />;
  return <FeedPostMock client={client} post={post} />;
}

export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[340px] rounded-[2.2rem] border-[10px] border-neutral-900 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950", className)}>
      <div className="mx-auto mt-1.5 h-4 w-20 rounded-full bg-neutral-900 dark:bg-neutral-700" />
      <div className="mt-1.5 max-h-[620px] overflow-y-auto overflow-x-hidden rounded-b-[1.4rem] [scrollbar-width:thin]">{children}</div>
    </div>
  );
}

/* ---------------- Visualizador de stories ---------------- */

export function StoryViewer({ client, stories, start, onClose }: { client: IgClient; stories: PostDTO[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const story = stories[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, stories.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stories.length, onClose]);

  if (!story) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Stories">
      <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 text-white">
        <XIcon className="size-7" />
      </button>
      <div className="relative w-full max-w-[380px]">
        <StoryMock client={client} post={story} progress={{ index, total: stories.length }} />
        {story.caption && <p className="mt-3 text-center text-sm text-white/80">{story.caption}</p>}
        <button type="button" aria-label="Story anterior" className="absolute inset-y-0 left-0 w-1/3" onClick={() => setIndex(Math.max(index - 1, 0))} />
        <button type="button" aria-label="Próximo story" className="absolute inset-y-0 right-0 w-1/3" onClick={() => (index < stories.length - 1 ? setIndex(index + 1) : onClose())} />
      </div>
    </div>
  );
}
