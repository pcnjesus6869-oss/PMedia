"use client";

import { useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { POST_TYPE_LABEL, POST_TYPES, type PostDTO, type PostType } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { PostCover } from "../feed/ig";

const opts = { locale: ptBR, weekStartsOn: 1 as const };

/** Cor por formato, para leitura rápida da pauta no mês. */
export const TYPE_TONE: Record<PostType, { dot: string; chip: string }> = {
  POST: { dot: "bg-sky-500", chip: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100" },
  REEL: { dot: "bg-fuchsia-500", chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-900 dark:bg-fuchsia-950/50 dark:text-fuchsia-100" },
  STORY: { dot: "bg-amber-500", chip: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100" },
};

const monthKey = (d: Date) => format(d, "yyyy-MM");
const MAX_IN_CELL = 3;

export function PautaCalendar({
  posts,
  renderDetail,
  onOpen,
}: {
  /** Posts da pauta (sem os já publicados) */
  posts: PostDTO[];
  renderDetail: (post: PostDTO) => React.ReactNode;
  onOpen: (post: PostDTO) => void;
}) {
  const dated = useMemo(
    () => posts.filter((p) => p.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!)),
    [posts],
  );
  const undated = posts.filter((p) => !p.scheduledAt);

  const months = useMemo(() => [...new Set(dated.map((p) => monthKey(new Date(p.scheduledAt!))))].sort(), [dated]);
  // começa no 1º mês com conteúdo a partir de hoje (ou no primeiro mês da pauta)
  const [cursor, setCursor] = useState(() => {
    const now = monthKey(new Date());
    const key = months.find((m) => m >= now) ?? months[0] ?? now;
    return new Date(`${key}-01T12:00:00`);
  });
  const [selected, setSelectedState] = useState<Date | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const setSelected = (day: Date | null) => {
    setSelectedState(day);
    // no celular o detalhe fica abaixo da grade: rola até ele
    if (day && window.matchMedia("(max-width: 639px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), opts), end: endOfWeek(endOfMonth(cursor), opts) });
  const byDay = (day: Date) => dated.filter((p) => isSameDay(new Date(p.scheduledAt!), day));
  const inMonth = dated.filter((p) => isSameMonth(new Date(p.scheduledAt!), cursor));

  // dia em destaque: o escolhido, ou o primeiro com conteúdo no mês
  const activeDay = selected && isSameMonth(selected, cursor) ? selected : inMonth[0] ? new Date(inMonth[0].scheduledAt!) : null;
  const dayPosts = activeDay ? byDay(activeDay) : [];

  const first = months[0], last = months[months.length - 1];
  const canPrev = first !== undefined && monthKey(cursor) > first;
  const canNext = last !== undefined && monthKey(cursor) < last;
  const go = (n: number) => {
    setCursor((c) => addMonths(c, n));
    setSelected(null);
  };

  const counts = POST_TYPES.map((t) => [t, inMonth.filter((p) => p.type === t).length] as const).filter(([, n]) => n > 0);

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-2xl border bg-white shadow-xs dark:bg-neutral-950">
        {/* Cabeçalho do mês */}
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-3 sm:px-4">
          <button type="button" onClick={() => go(-1)} disabled={!canPrev} aria-label="Mês anterior" className="rounded-md border p-1 disabled:opacity-30 print:hidden">
            <ChevronLeftIcon className="size-4" />
          </button>
          <h2 className="min-w-32 text-center text-base font-semibold first-letter:uppercase">{format(cursor, "MMMM yyyy", opts)}</h2>
          <button type="button" onClick={() => go(1)} disabled={!canNext} aria-label="Próximo mês" className="rounded-md border p-1 disabled:opacity-30 print:hidden">
            <ChevronRightIcon className="size-4" />
          </button>
          <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {counts.length ? (
              counts.map(([t, n]) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", TYPE_TONE[t].dot)} />
                  <b className="text-foreground">{n}</b> {POST_TYPE_LABEL[t]}
                </span>
              ))
            ) : (
              <span>Nenhum conteúdo neste mês</span>
            )}
          </div>
        </header>

        {/* Grade do mês */}
        <div className="grid grid-cols-7 border-b bg-neutral-50 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:bg-neutral-900">
          {days.slice(0, 7).map((d) => (
            <div key={d.toISOString()} className="py-1.5">
              <span className="sm:hidden">{format(d, "EEEEE", opts)}</span>
              <span className="hidden sm:inline">{format(d, "EEE", opts).replace(".", "")}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const items = byDay(day);
            const outside = !isSameMonth(day, cursor);
            const active = activeDay && isSameDay(day, activeDay);
            return (
              <div
                key={day.toISOString()}
                role={items.length ? "button" : undefined}
                tabIndex={items.length ? 0 : -1}
                onClick={() => items.length && setSelected(day)}
                onKeyDown={(e) => e.key === "Enter" && items.length && setSelected(day)}
                aria-label={items.length ? `${format(day, "d 'de' MMMM", opts)}: ${items.length} conteúdo(s)` : undefined}
                className={cn(
                  "relative flex min-h-[68px] flex-col gap-1 border-b border-r p-1 text-left [&:nth-child(7n)]:border-r-0 sm:min-h-[112px] sm:p-1.5",
                  outside && "bg-neutral-50/70 dark:bg-neutral-900/50",
                  items.length > 0 && "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900",
                  active && "bg-neutral-100 ring-2 ring-inset ring-neutral-900 dark:bg-neutral-900 dark:ring-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center self-end rounded-full text-xs",
                    outside && "text-neutral-300 dark:text-neutral-600",
                    isToday(day) && "bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900",
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* celular: miniaturas · telas maiores: chips com hora e formato */}
                <div className="flex flex-wrap gap-1 px-0.5 sm:hidden">
                  {items.slice(0, MAX_IN_CELL).map((p) => (
                    <span key={p.id} className={cn("relative block overflow-hidden rounded-sm ring-[1.5px]", p.type === "POST" ? "size-5" : "h-6 w-3.5", p.type === "POST" ? "ring-sky-500" : p.type === "REEL" ? "ring-fuchsia-500" : "ring-amber-500")}>
                      <PostCover post={p} />
                    </span>
                  ))}
                  {items.length > MAX_IN_CELL && <span className="text-[10px] font-semibold text-muted-foreground">+{items.length - MAX_IN_CELL}</span>}
                </div>
                <div className="hidden flex-col gap-1 sm:flex">
                  {items.slice(0, MAX_IN_CELL).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(p);
                      }}
                      className={cn("flex items-center gap-1 rounded-md border p-0.5 pr-1 text-left text-[11px] leading-tight", TYPE_TONE[p.type].chip)}
                    >
                      <span className={cn("block shrink-0 overflow-hidden rounded-sm", p.type === "POST" ? "size-6" : "h-7 w-4")}>
                        <PostCover post={p} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{format(new Date(p.scheduledAt!), "HH:mm")}</span>
                        <span className="block truncate opacity-80">{POST_TYPE_LABEL[p.type]}</span>
                      </span>
                    </button>
                  ))}
                  {items.length > MAX_IN_CELL && <span className="text-[11px] font-medium text-muted-foreground">+{items.length - MAX_IN_CELL} mais</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="px-4 py-2 text-xs text-muted-foreground print:hidden">Toque em um dia para ver os conteúdos e as legendas.</p>
      </section>

      {/* Detalhe do dia */}
      {activeDay && dayPosts.length > 0 && (
        <section ref={detailRef} className="grid scroll-mt-28 gap-3">
          <h3 className="text-sm font-semibold first-letter:uppercase">
            {format(activeDay, "EEEE, d 'de' MMMM", opts)} · {dayPosts.length} conteúdo(s)
          </h3>
          {dayPosts.map((p) => (
            <div key={p.id}>{renderDetail(p)}</div>
          ))}
        </section>
      )}

      {undated.length > 0 && (
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Data a definir · {undated.length}</h3>
          {undated.map((p) => (
            <div key={p.id}>{renderDetail(p)}</div>
          ))}
        </section>
      )}

      {posts.length === 0 && <p className="text-center text-sm text-muted-foreground">Nenhum conteúdo programado nesta prévia.</p>}
    </div>
  );
}
