"use client";

import { useMemo, useState } from "react";
import { addMonths, format, isPast, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClapperboardIcon,
  CircleDashedIcon,
  FileTextIcon,
  ImageIcon,
  Link2Icon,
  MapPinIcon,
  MessageSquareIcon,
  PencilIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { POST_STATUS_COLOR, POST_STATUS_LABEL, POST_TYPES, type PostDTO, type PostType } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Avatar, PostCover } from "../feed/ig";
import { ShareDialog } from "../feed/share-dialog";
import { TYPE_TONE } from "../share/pauta-calendar";
import { MemberAvatar } from "../team";
import { useWorkspace } from "../workspace-context";

/** Nesta página o formato POST é chamado de "Feed", como a equipe fala. */
const LABEL: Record<PostType, string> = { POST: "Feed", REEL: "Reels", STORY: "Story" };
const ICON: Record<PostType, typeof ImageIcon> = { POST: ImageIcon, REEL: ClapperboardIcon, STORY: CircleDashedIcon };
const NO_DATE = "sem-data";
const DONE = new Set(["APPROVED", "SCHEDULED", "PUBLISHED"]);

/** Visão de entregas do cliente: um card por mês, que expande com os criativos. */
export function ClientView() {
  const { activeClient, clients, setClientFilter, posts, memberById, openPost } = useWorkspace();
  const [typeFilter, setTypeFilter] = useState<PostType | "ALL">("ALL");
  const [open, setOpen] = useState<Set<string> | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // janela de 6 meses (semestre: jan–jun / jul–dez); começa no semestre atual
  const [semester, setSemester] = useState(() => semesterStart(new Date()));

  const byMonth = useMemo(() => {
    const map = new Map<string, PostDTO[]>();
    for (const p of posts) {
      if (typeFilter !== "ALL" && p.type !== typeFilter) continue;
      const key = p.scheduledAt ? format(new Date(p.scheduledAt), "yyyy-MM") : NO_DATE;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    for (const items of map.values()) items.sort((x, y) => (x.scheduledAt ?? "9").localeCompare(y.scheduledAt ?? "9"));
    return map;
  }, [posts, typeFilter]);

  const isCurrentSemester = semester.getTime() === semesterStart(new Date()).getTime();
  const countIn = (start: Date) =>
    Array.from({ length: 6 }, (_, i) => byMonth.get(format(addMonths(start, i), "yyyy-MM"))?.length ?? 0).reduce((a, b) => a + b, 0);
  const prevStart = addMonths(semester, -6);
  const nextStart = addMonths(semester, 6);

  // os 6 meses da janela (mesmo vazios) + "Data a definir" no semestre atual
  const months = [
    ...Array.from({ length: 6 }, (_, i) => {
      const key = format(addMonths(semester, i), "yyyy-MM");
      return { key, items: byMonth.get(key) ?? [] };
    }),
    ...(isCurrentSemester && byMonth.has(NO_DATE) ? [{ key: NO_DATE, items: byMonth.get(NO_DATE)! }] : []),
  ];

  if (!activeClient) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h2 className="text-lg font-semibold">Escolha um cliente para ver as entregas</h2>
        <div className="mt-4 grid gap-2">
          {clients.map((c) => (
            <Button key={c.id} variant="outline" onClick={() => setClientFilter(c.id)} className="justify-start">
              <span className="size-2.5 rounded-full" style={{ background: c.color }} /> {c.name}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // por padrão, abre o mês atual (ou o primeiro com conteúdo)
  const currentKey = format(new Date(), "yyyy-MM");
  const defaultOpen = new Set([months.find((m) => m.key === currentKey)?.key ?? months.find((m) => m.items.length)?.key ?? ""]);
  const isOpen = (key: string) => (open ?? defaultOpen).has(key);
  const toggle = (key: string) => {
    const next = new Set(open ?? defaultOpen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpen(next);
  };

  const owner = activeClient.ownerId ? memberById.get(activeClient.ownerId) : null;
  const total = posts.length;
  const delivered = posts.filter((p) => DONE.has(p.status)).length;

  return (
    <div className="grid gap-5">
      {/* Cabeçalho do cliente */}
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs">
        <Avatar client={activeClient} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{activeClient.name}</h2>
          <p className="truncate text-sm text-muted-foreground">@{activeClient.handle}</p>
          {owner && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <MemberAvatar member={owner} size={18} /> Responsável: {owner.name}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <Stat label="Entregas" value={total} />
          <Stat label="Aprovadas+" value={delivered} />
          <Stat label="Meses" value={[...byMonth.keys()].filter((k) => k !== NO_DATE).length} />
        </div>
        <Button size="sm" onClick={() => setShareOpen(true)}>
          <Link2Icon /> Enviar link para cliente
        </Button>
      </section>

      {/* Filtro de formato */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["ALL", ...POST_TYPES] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            aria-pressed={typeFilter === t}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
              typeFilter === t ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {t !== "ALL" && <span className={cn("size-2 rounded-full", TYPE_TONE[t].dot)} />}
            {t === "ALL" ? "Todos os formatos" : LABEL[t]}
          </button>
        ))}

        {/* Navegação por semestre (6 meses), alinhada à direita */}
        <div className="ml-auto flex items-center gap-1.5">
          {!isCurrentSemester && (
            <Button variant="ghost" size="sm" onClick={() => setSemester(semesterStart(new Date()))}>
              Semestre atual
            </Button>
          )}
          <div className="inline-flex items-center rounded-full border bg-background p-0.5">
            <SemesterArrow dir="prev" count={countIn(prevStart)} label={semesterLabel(prevStart)} onClick={() => setSemester(prevStart)} />
            <span className="min-w-40 px-2 text-center text-xs font-medium">
              {semesterLabel(semester)}
              <span className="block text-[10px] font-normal text-muted-foreground first-letter:uppercase">
                {format(semester, "MMM", { locale: ptBR })} – {format(addMonths(semester, 5), "MMM yyyy", { locale: ptBR })}
              </span>
            </span>
            <SemesterArrow dir="next" count={countIn(nextStart)} label={semesterLabel(nextStart)} onClick={() => setSemester(nextStart)} />
          </div>
        </div>
      </div>

      {/* Meses do semestre */}
      <div className="grid gap-3">
        {months.map(({ key, items }) => (
          <MonthCard key={key} monthKey={key} items={items} open={isOpen(key) && items.length > 0} onToggle={() => toggle(key)} onOpenPost={openPost} handle={activeClient.handle} />
        ))}
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} client={activeClient} />
    </div>
  );
}

/** 1º semestre = jan–jun, 2º semestre = jul–dez. */
function semesterStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1);
}
function semesterLabel(start: Date) {
  return `${start.getMonth() === 0 ? "1º" : "2º"} semestre ${start.getFullYear()}`;
}

function SemesterArrow({ dir, count, label, onClick }: { dir: "prev" | "next"; count: number; label: string; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${dir === "prev" ? "Semestre anterior" : "Próximo semestre"}: ${label}`}
      title={`${label} · ${count} criativo(s)`}
      className="relative flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-4" />
      {count > 0 && (
        <span className="absolute -top-1 rounded-full bg-primary px-1 text-[9px] font-semibold leading-3.5 text-primary-foreground" style={{ [dir === "prev" ? "left" : "right"]: -4 }}>
          {count}
        </span>
      )}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function MonthCard({
  monthKey,
  items,
  open,
  onToggle,
  onOpenPost,
  handle,
}: {
  monthKey: string;
  items: PostDTO[];
  open: boolean;
  onToggle: () => void;
  onOpenPost: (p: PostDTO) => void;
  handle: string;
}) {
  const date = monthKey === NO_DATE ? null : new Date(`${monthKey}-01T12:00:00`);
  const isCurrent = date && isSameMonth(date, new Date());
  const past = date && !isCurrent && isPast(date);
  const done = items.filter((p) => DONE.has(p.status)).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const panelId = `month-${monthKey}`;

  if (items.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground/70 first-letter:uppercase">{date ? format(date, "MMMM yyyy", { locale: ptBR }) : "Data a definir"}</span>
        {isCurrent && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Mês atual</span>}
        <span className="ml-auto text-xs">Nenhum criativo neste mês</span>
      </section>
    );
  }

  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card shadow-xs transition", open && "ring-1 ring-foreground/10")}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 p-4 text-left hover:bg-muted/30">
        <div className="min-w-36">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold first-letter:uppercase">{date ? format(date, "MMMM yyyy", { locale: ptBR }) : "Data a definir"}</h3>
            {isCurrent && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Mês atual</span>}
            {past && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Encerrado</span>}
          </div>
          <p className="text-xs text-muted-foreground">{items.length} criativo(s)</p>
        </div>

        {/* contagem por formato */}
        <div className="flex flex-wrap gap-1.5">
          {POST_TYPES.map((t) => {
            const n = items.filter((p) => p.type === t).length;
            if (!n) return null;
            const Icon = ICON[t];
            return (
              <span key={t} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", TYPE_TONE[t].chip)}>
                <Icon className="size-3" /> {n} {LABEL[t]}
              </span>
            );
          })}
        </div>

        {/* miniaturas */}
        <div className="hidden flex-1 justify-end -space-x-2 md:flex">
          {items.slice(0, 6).map((p) => (
            <span key={p.id} className="block size-9 overflow-hidden rounded-lg border-2 border-card">
              <PostCover post={p} />
            </span>
          ))}
          {items.length > 6 && <span className="flex size-9 items-center justify-center rounded-lg border-2 border-card bg-muted text-xs font-medium">+{items.length - 6}</span>}
        </div>

        {/* progresso */}
        <div className="flex w-32 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{done}/{items.length}</span>
        </div>

        <ChevronDownIcon className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      {/* menu suspenso com os criativos do mês */}
      <div id={panelId} className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <ul className="divide-y border-t">
            {items.map((p) => (
              <CreativeRow key={p.id} post={p} handle={handle} onOpen={() => onOpenPost(p)} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CreativeRow({ post, handle, onOpen }: { post: PostDTO; handle: string; onOpen: () => void }) {
  const [showScript, setShowScript] = useState(false);
  const Icon = ICON[post.type];
  const firstLine = post.caption.split("\n").find((l) => l.trim()) ?? "";

  return (
    <li className="grid gap-3 p-4 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
      <button type="button" onClick={onOpen} aria-label="Abrir no editor" className={cn("overflow-hidden rounded-lg border", post.type === "POST" ? "aspect-[4/5] w-16 sm:w-[72px]" : "aspect-[9/16] w-12 sm:w-14")}>
        <PostCover post={post} />
      </button>

      <div className="grid min-w-0 content-start gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium", TYPE_TONE[post.type].chip)}>
            <Icon className="size-3" /> {LABEL[post.type]}
            {post.type === "POST" && post.media.length > 1 ? ` · carrossel ${post.media.length}` : ""}
          </span>
          <span className="font-semibold first-letter:uppercase">
            {post.scheduledAt ? format(new Date(post.scheduledAt), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR }) : "Data a definir"}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", POST_STATUS_COLOR[post.status])} />
            {POST_STATUS_LABEL[post.status]}
          </span>
        </div>

        <p className="line-clamp-2 text-sm">
          {post.type !== "STORY" && <b className="mr-1">{handle}</b>}
          {firstLine || <i className="text-muted-foreground">Sem legenda</i>}
        </p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {post.firstComment && <span className="inline-flex items-center gap-1"><MessageSquareIcon className="size-3" /> 1º comentário</span>}
          {post.location && <span className="inline-flex items-center gap-1"><MapPinIcon className="size-3" /> {post.location}</span>}
          {post.collaborators.length > 0 && <span className="inline-flex items-center gap-1"><UsersIcon className="size-3" /> {post.collaborators.map((c) => `@${c}`).join(", ")}</span>}
          {post.script ? (
            <button type="button" onClick={() => setShowScript((v) => !v)} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline" aria-expanded={showScript}>
              <FileTextIcon className="size-3" /> {showScript ? "Ocultar roteiro" : "Ver roteiro"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><FileTextIcon className="size-3" /> sem roteiro</span>
          )}
        </div>

        {showScript && post.script && (
          <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed">{post.script}</pre>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onOpen} className="self-start justify-self-start">
        <PencilIcon /> Editar
      </Button>
    </li>
  );
}
