"use client";

import { useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  ClapperboardIcon,
  CopyPlusIcon,
  ImageIcon,
  ImagePlusIcon,
  Loader2Icon,
  MapPinIcon,
  PinIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { createPost, deletePost, duplicatePost, updatePost } from "@/server/content-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ASPECTS,
  hashtagsOf,
  LIMITS,
  mentionsOf,
  POST_STATUSES,
  POST_STATUS_LABEL,
  POST_TYPE_LABEL,
  POST_TYPES,
  type ClientDTO,
  type MediaDTO,
  type PostDTO,
  type PostStatus,
  type PostType,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useWorkspace } from "../workspace-context";
import { uploadMedia } from "@/lib/upload-client";
import { GridTile, MediaView, PhoneFrame, PostPreview } from "./ig";

const TYPE_ICON = { POST: ImagePlusIcon, REEL: ClapperboardIcon, STORY: CircleDashedIcon } as const;
const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const toLocalInput = (iso: string | null | undefined) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");

export function PostComposer() {
  const { composing, closePost, activeClient, clients } = useWorkspace();
  const client = (composing?.post && clients.find((c) => c.id === composing.post!.clientId)) || activeClient || clients[0];
  return (
    <Dialog open={composing !== null} onOpenChange={(open) => !open && closePost()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-5xl" showCloseButton>
        {composing && client && <ComposerForm key={composing.post?.id ?? "new"} client={client} post={composing.post} defaults={composing.defaults} />}
      </DialogContent>
    </Dialog>
  );
}

function ComposerForm({ client, post, defaults }: { client: ClientDTO; post: PostDTO | null; defaults?: { type?: PostType; scheduledAt?: string } }) {
  const { closePost } = useWorkspace();
  const [type, setType] = useState<PostType>(post?.type ?? defaults?.type ?? "POST");
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "DRAFT");
  const [media, setMedia] = useState<(MediaDTO & { duration?: number })[]>(post?.media ?? []);
  const [aspect, setAspect] = useState(post?.aspectRatio ?? (type === "POST" ? "4:5" : "9:16"));
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [script, setScript] = useState(post?.script ?? "");
  const [firstComment, setFirstComment] = useState(post?.firstComment ?? "");
  const [location, setLocation] = useState(post?.location ?? "");
  const [collabs, setCollabs] = useState((post?.collaborators ?? []).map((c) => `@${c}`).join(", "));
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(post?.scheduledAt ?? defaults?.scheduledAt));
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [shareToFeed, setShareToFeed] = useState(post?.shareToFeed ?? true);
  const [coverUrl, setCoverUrl] = useState(post?.coverUrl ?? null);
  const [coverTime, setCoverTime] = useState(post?.coverTime ?? 0);
  const [selected, setSelected] = useState(0);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const multi = type === "POST";
  const hashtags = hashtagsOf(caption).length;
  const mentions = mentionsOf(caption).length;
  const collaborators = collabs.split(/[,\s]+/).map((c) => c.replace(/^@/, "").trim()).filter(Boolean);
  const video = media.find((m) => m.kind === "VIDEO");

  const changeType = (t: PostType) => {
    setType(t);
    setAspect(t === "POST" ? (aspect === "9:16" ? "4:5" : aspect) : "9:16");
    if (t !== "POST" && media.length > 1) setMedia(media.slice(0, 1));
  };

  const onFiles = async (files: FileList | null, asCover = false) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files);
    const room = asCover ? 1 : multi ? LIMITS.carousel - media.length : 1;
    if (room <= 0) return setError(`Carrossel aceita até ${LIMITS.carousel} mídias`);
    setUploading((n) => n + Math.min(list.length, room));
    for (const file of list.slice(0, room)) {
      try {
        const m = await uploadMedia(file);
        if (asCover) {
          if (m.kind !== "IMAGE") throw new Error("A capa precisa ser uma imagem");
          setCoverUrl(m.url);
        } else {
          setMedia((prev) => (multi ? [...prev, m] : [m]));
          if (!multi) setSelected(0);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha no upload");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= media.length) return;
    const next = [...media];
    [next[i], next[j]] = [next[j], next[i]];
    setMedia(next);
    setSelected(j);
  };

  const preview: PostDTO = {
    id: post?.id ?? "preview",
    clientId: client.id,
    type,
    status,
    caption,
    script: script || null,
    firstComment: firstComment || null,
    location: location || null,
    collaborators,
    aspectRatio: aspect,
    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    pinned,
    shareToFeed,
    coverUrl,
    coverTime,
    feedPosition: post?.feedPosition ?? 0,
    media,
  };

  const save = (nextStatus?: PostStatus) =>
    startTransition(async () => {
      setError(null);
      const payload = {
        clientId: client.id,
        type,
        status: nextStatus ?? status,
        caption,
        script: script || null,
        firstComment: type === "STORY" ? null : firstComment || null,
        location: type === "STORY" ? null : location || null,
        collaborators: type === "STORY" ? [] : collaborators,
        aspectRatio: aspect as "4:5",
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        pinned: type === "STORY" ? false : pinned,
        shareToFeed,
        coverUrl: type === "REEL" ? coverUrl : null,
        coverTime,
        media: media.map((m) => ({ id: m.id, alt: m.alt })),
      };
      const res = post ? await updatePost({ id: post.id, ...payload }) : await createPost(payload);
      if (res.ok) closePost();
      else setError(res.error);
    });

  const remove = () =>
    startTransition(async () => {
      if (!post || !confirm("Excluir este conteúdo?")) return;
      const res = await deletePost(post.id);
      if (res.ok) closePost();
      else setError(res.error);
    });

  const duplicate = () =>
    startTransition(async () => {
      if (!post) return;
      const res = await duplicatePost(post.id);
      if (res.ok) closePost();
      else setError(res.error);
    });

  const current = media[selected];

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Formulário */}
      <div className="grid content-start gap-5 p-5">
        <div className="flex items-center justify-between gap-3 pr-8">
          <DialogTitle>{post ? "Editar conteúdo" : "Criar conteúdo"}</DialogTitle>
          <span className="truncate text-sm text-muted-foreground">@{client.handle}</span>
        </div>

        {/* Formato */}
        <div className="inline-flex w-fit rounded-lg border p-0.5">
          {POST_TYPES.map((t) => {
            const Icon = TYPE_ICON[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => changeType(t)}
                className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Icon className="size-4" /> {POST_TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>

        {/* Mídia */}
        <section className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Mídia</Label>
            <span className="text-xs text-muted-foreground">
              {multi ? `Foto ou carrossel · ${media.length}/${LIMITS.carousel}` : type === "REEL" ? "Vídeo vertical 9:16" : "Imagem ou vídeo 9:16"}
            </span>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFiles(e.dataTransfer.files);
            }}
            className="flex flex-wrap gap-2 rounded-xl border-2 border-dashed p-2"
          >
            {media.map((m, i) => (
              <div key={m.id + i} className={cn("group relative h-24 w-20 overflow-hidden rounded-lg border-2", i === selected ? "border-primary" : "border-transparent")}>
                <button type="button" className="size-full" onClick={() => setSelected(i)} aria-label={`Selecionar mídia ${i + 1}`}>
                  <MediaView media={m} />
                </button>
                <button type="button" onClick={() => { setMedia(media.filter((_, j) => j !== i)); setSelected(0); }} aria-label="Remover mídia" className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white">
                  <XIcon className="size-3" />
                </button>
                {multi && media.length > 1 && (
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
                    <button type="button" onClick={() => move(i, -1)} aria-label="Mover para a esquerda"><ChevronLeftIcon className="size-4" /></button>
                    <span className="text-[10px]">{i + 1}</span>
                    <button type="button" onClick={() => move(i, 1)} aria-label="Mover para a direita"><ChevronRightIcon className="size-4" /></button>
                  </div>
                )}
              </div>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <div key={`up-${i}`} className="flex h-24 w-20 items-center justify-center rounded-lg bg-muted">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ))}
            {(multi ? media.length < LIMITS.carousel : media.length === 0) && (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-24 min-w-20 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-xs text-muted-foreground hover:bg-muted/60">
                <ImageIcon className="size-5" />
                {media.length ? "Adicionar" : "Arraste ou clique para enviar"}
              </button>
            )}
            {!multi && media.length === 1 && (
              <button type="button" onClick={() => fileRef.current?.click()} className="self-center px-2 text-xs text-primary underline">Trocar</button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple={multi}
            accept={type === "REEL" ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {current?.kind === "IMAGE" && (
            <Input
              value={current.alt ?? ""}
              onChange={(e) => setMedia(media.map((m, i) => (i === selected ? { ...m, alt: e.target.value } : m)))}
              placeholder="Texto alternativo (acessibilidade) da mídia selecionada"
              className="text-xs"
            />
          )}
        </section>

        {type === "POST" && (
          <div className="grid gap-1.5">
            <Label>Proporção</Label>
            <div className="flex flex-wrap gap-1.5">
              {ASPECTS.POST.map((a) => (
                <button key={a} type="button" onClick={() => setAspect(a)} className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", aspect === a ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
                  {a === "1.91:1" ? "Paisagem 1.91:1" : a === "1:1" ? "Quadrado 1:1" : a === "4:5" ? "Retrato 4:5" : "Vertical 3:4"}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === "REEL" && (
          <section className="grid gap-2 rounded-xl border p-3">
            <Label>Capa do Reels</Label>
            {video && !coverUrl && (
              <div className="grid gap-1">
                <input type="range" min={0} max={Math.max(video.duration ?? 30, 1)} step={0.1} value={coverTime} onChange={(e) => setCoverTime(Number(e.target.value))} aria-label="Escolher frame da capa" />
                <span className="text-xs text-muted-foreground">Frame em {coverTime.toFixed(1)}s</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => coverRef.current?.click()}>
                {coverUrl ? "Trocar capa" : "Enviar capa da galeria"}
              </Button>
              {coverUrl && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setCoverUrl(null)}>
                  Usar frame do vídeo
                </Button>
              )}
            </div>
            <input ref={coverRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { onFiles(e.target.files, true); e.target.value = ""; }} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={shareToFeed} onChange={(e) => setShareToFeed(e.target.checked)} />
              Também mostrar na grade do feed
            </label>
          </section>
        )}

        {/* Legenda */}
        <section className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="caption">{type === "STORY" ? "Notas do story (texto, stickers, link…)" : "Legenda"}</Label>
            <span className={cn("text-xs tabular-nums", caption.length > LIMITS.caption ? "text-destructive" : "text-muted-foreground")}>
              {caption.length}/{LIMITS.caption}
            </span>
          </div>
          <Textarea id="caption" rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={type === "STORY" ? "Ex.: Enquete “quente ou gelado?” + link para o site" : "Escreva uma legenda… use #hashtags e @menções"} />
          {type !== "STORY" && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className={cn(hashtags > LIMITS.hashtags && "font-medium text-destructive")}># {hashtags}/{LIMITS.hashtags} hashtags</span>
              <span className={cn(mentions > LIMITS.mentions && "font-medium text-destructive")}>@ {mentions}/{LIMITS.mentions} menções</span>
            </div>
          )}
        </section>

        {/* Roteiro */}
        <section className="grid gap-1.5">
          <Label htmlFor="script">Roteiro {type === "POST" ? "/ briefing da arte" : "(cenas, falas, textos de tela)"}</Label>
          <Textarea
            id="script"
            rows={type === "POST" ? 3 : 5}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={type === "POST" ? "Ex.: Foto do produto em mesa de madeira, luz natural, texto “30% OFF”" : "Cena 1 (0–3s): gancho…\nCena 2: …\nTexto na tela: …\nCTA: …"}
            className="font-mono text-xs"
          />
        </section>

        {type !== "STORY" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="first">Primeiro comentário</Label>
              <Input id="first" value={firstComment} onChange={(e) => setFirstComment(e.target.value)} placeholder="Ex.: hashtags extras ou informações do link" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="loc"><MapPinIcon className="size-3.5" /> Localização</Label>
              <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Adicionar localização" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="collab"><UsersIcon className="size-3.5" /> Colaboradores (até {LIMITS.collaborators})</Label>
              <Input id="collab" value={collabs} onChange={(e) => setCollabs(e.target.value)} placeholder="@parceiro, @marca" aria-invalid={collaborators.length > LIMITS.collaborators} />
            </div>
          </div>
        )}

        {/* Programação */}
        <section className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="when">Data e hora da publicação</Label>
            <Input id="when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="status">Status</Label>
            <select id="status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as PostStatus)}>
              {POST_STATUSES.map((s) => (
                <option key={s} value={s}>{POST_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          {type !== "STORY" && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-primary" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              <PinIcon className="size-3.5" /> Fixar no topo do perfil
            </label>
          )}
        </section>

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {post && (
            <>
              <Button type="button" variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>
                <Trash2Icon /> Excluir
              </Button>
              <Button type="button" variant="ghost" onClick={duplicate} disabled={pending}>
                <CopyPlusIcon /> Duplicar
              </Button>
            </>
          )}
          <div className="ml-auto flex gap-2">
            {status === "DRAFT" && (
              <Button type="button" variant="outline" onClick={() => save("IN_REVIEW")} disabled={pending || uploading > 0}>
                Enviar para aprovação
              </Button>
            )}
            <Button type="button" onClick={() => save()} disabled={pending || uploading > 0}>
              {pending && <Loader2Icon className="animate-spin" />}
              {post ? "Salvar alterações" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>

      {/* Prévia */}
      <aside className="grid content-start gap-4 border-t bg-muted/30 p-5 lg:border-l lg:border-t-0">
        <h3 className="text-sm font-semibold">Prévia</h3>
        <PhoneFrame>
          <PostPreview client={client} post={preview} />
        </PhoneFrame>
        {type !== "STORY" && (type === "POST" || shareToFeed) && (
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Na grade do perfil (recorte 3:4)</span>
            <div className="w-28 overflow-hidden rounded-md border">
              <GridTile post={preview} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
