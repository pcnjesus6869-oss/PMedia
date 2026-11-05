"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2Icon, SparklesIcon, XIcon } from "lucide-react";
import { saveParsedTasks } from "@/server/task-actions";
import { Button } from "@/components/ui/button";
import { PRIORITIES, PRIORITY_LABEL, type Priority } from "@/lib/domain";
import type { ParsedTask, ParseTaskResponse } from "@/lib/schemas";
import { PriorityBadge } from "./task-card";
import { useWorkspace } from "./workspace-context";

/** ISO local com offset, ex.: 2026-11-04T10:00:00-03:00 */
function nowWithOffset() {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export function AiCommandBar() {
  const { clients, clientFilter } = useWorkspace();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedTask[] | null>(null);
  const [source, setSource] = useState<ParseTaskResponse["source"] | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [parsing, startParsing] = useTransition();
  const [saving, startSaving] = useTransition();

  const parseText = () =>
    startParsing(async () => {
      setError(null);
      const res = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, now: nowWithOffset(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!res.ok) {
        setError("Não consegui interpretar o texto. Tente reformular.");
        return;
      }
      const data = (await res.json()) as ParseTaskResponse;
      setPreview(data.tasks);
      setSource(data.source);
      setClientId(clientFilter === "ALL" ? "" : clientFilter);
    });

  const save = () =>
    startSaving(async () => {
      if (!preview?.length) return;
      const res = await saveParsedTasks({ tasks: preview, clientId: clientId || null });
      if (!res.ok) return setError(res.error);
      setPreview(null);
      setText("");
    });

  const update = (i: number, patch: Partial<ParsedTask>) =>
    setPreview((p) => p && p.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 3) parseText();
        }}
      >
        <SparklesIcon className="size-4 shrink-0 text-violet-500" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Ex.: "Reunião com a equipe quinta às 14h e preparar apresentação até sexta"'
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Descreva suas tarefas em linguagem natural"
        />
        <Button type="submit" size="sm" disabled={parsing || text.trim().length < 3}>
          {parsing ? <Loader2Icon className="animate-spin" /> : null}
          Interpretar
        </Button>
      </form>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {preview && (
        <div className="mt-3 grid gap-2 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {preview.length} tarefa(s) identificada(s) ·{" "}
              {source === "claude" ? "via Claude" : "via parser local (configure ANTHROPIC_API_KEY para usar IA)"}
            </span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-7 rounded-md border bg-transparent px-2 text-xs"
              aria-label="Cliente das novas tarefas"
            >
              <option value="">Sem cliente</option>
              {clients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {preview.map((t, i) => (
            <div key={i} className="rounded-lg border bg-muted/30 p-2.5">
              <div className="flex items-start gap-2">
                <input
                  value={t.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                  aria-label="Título"
                />
                <select
                  value={t.priority}
                  onChange={(e) => update(i, { priority: e.target.value as Priority })}
                  className="h-6 rounded border bg-transparent px-1 text-xs"
                  aria-label="Prioridade"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setPreview((p) => p && p.filter((_, j) => j !== i))} aria-label="Remover" className="text-muted-foreground hover:text-foreground">
                  <XIcon className="size-4" />
                </button>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <PriorityBadge priority={t.priority} />
                {t.dueDate ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="size-3" />
                    {format(new Date(t.dueDate), "EEEE, d MMM 'às' HH:mm", { locale: ptBR })}
                  </span>
                ) : (
                  <span>sem prazo</span>
                )}
                {t.estimatedMinutes ? <span>~{t.estimatedMinutes} min</span> : null}
              </div>
              {t.subtasks.length > 0 && (
                <ul className="mt-1.5 list-inside list-disc pl-1 text-xs text-muted-foreground">
                  {t.subtasks.map((s, j) => (
                    <li key={j}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={saving || preview.length === 0}>
              {saving ? <Loader2Icon className="animate-spin" /> : null}
              Adicionar {preview.reduce((n, t) => n + 1 + t.subtasks.length, 0)} item(ns)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
