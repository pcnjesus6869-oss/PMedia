"use client";

import { useState, useTransition } from "react";
import { endOfMonth, format, formatDistanceToNow, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckIcon, CopyIcon, ExternalLinkIcon, EyeIcon, Loader2Icon, MessageCircleIcon } from "lucide-react";
import { createShareLink, revokeShareLink } from "@/server/share-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClientDTO } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useWorkspace } from "../workspace-context";

const shareUrl = (token: string) => (typeof window === "undefined" ? `/share/${token}` : `${window.location.origin}/share/${token}`);

export function ShareDialog({ open, onOpenChange, client }: { open: boolean; onOpenChange: (o: boolean) => void; client: ClientDTO }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open && <ShareForm key={client.id} client={client} />}
      </DialogContent>
    </Dialog>
  );
}

function ShareForm({ client }: { client: ClientDTO }) {
  const { shareLinks } = useWorkspace();
  const now = new Date();
  const [title, setTitle] = useState(`Pauta ${format(now, "MMMM yyyy", { locale: ptBR })} · ${client.name}`);
  const [message, setMessage] = useState("Olá! Segue a prévia do feed para sua aprovação. Qualquer ajuste, é só me avisar 😊");
  const [usePeriod, setUsePeriod] = useState(false);
  const [from, setFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [includePublished, setIncludePublished] = useState(true);
  const [result, setResult] = useState<{ url: string; count: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const history = shareLinks.filter((l) => l.clientId === client.id);

  const generate = () =>
    startTransition(async () => {
      setError(null);
      const res = await createShareLink({
        clientId: client.id,
        title,
        message: message || null,
        from: usePeriod ? new Date(`${from}T00:00`).toISOString() : null,
        to: usePeriod ? new Date(`${to}T23:59:59`).toISOString() : null,
        includeDrafts,
        includePublished,
      });
      if (!res.ok) return setError(res.error);
      setResult({ url: shareUrl(res.data.token), count: res.data.postCount });
      setCopied(false);
    });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };

  const whatsapp = (url: string) => `https://wa.me/?text=${encodeURIComponent(`${message ? `${message}\n\n` : ""}${title}\n${url}`)}`;

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Enviar link para cliente</DialogTitle>
        <DialogDescription>
          Gera uma versão <b>somente leitura</b> da prévia de @{client.handle}. O cliente vê o feed, os stories e as legendas, sem precisar de login.
          Edições feitas depois não alteram este link; para enviar a versão nova, gere outro.
        </DialogDescription>
      </DialogHeader>

      {result ? (
        <div className="grid gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-sm font-medium">Link gerado com {result.count} conteúdo(s) ✅</p>
          <div className="flex gap-2">
            <Input readOnly value={result.url} onFocus={(e) => e.target.select()} className="bg-background text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={() => copy(result.url)} aria-label="Copiar link">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => copy(result.url)}>{copied ? "Copiado!" : "Copiar link"}</Button>
            <a href={whatsapp(result.url)} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium">
              <MessageCircleIcon className="size-3.5" /> Enviar no WhatsApp
            </a>
            <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium">
              <ExternalLinkIcon className="size-3.5" /> Ver como o cliente
            </a>
          </div>
          <button type="button" onClick={() => setResult(null)} className="justify-self-start text-xs text-muted-foreground underline">Gerar outra versão</button>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="share-title">Nome da prévia</Label>
            <Input id="share-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="share-msg">Mensagem para o cliente (aparece no topo do link)</Label>
            <Textarea id="share-msg" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={usePeriod} onChange={(e) => setUsePeriod(e.target.checked)} />
            Somente um período
          </label>
          {usePeriod && (
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={includePublished} onChange={(e) => setIncludePublished(e.target.checked)} />
            Incluir posts já publicados (contexto da grade)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} />
            Incluir rascunhos
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={generate} disabled={pending || !title.trim()}>
            {pending && <Loader2Icon className="animate-spin" />} Gerar link
          </Button>
        </div>
      )}

      {history.length > 0 && (
        <section className="grid gap-2 border-t pt-3">
          <h4 className="text-sm font-semibold">Links enviados</h4>
          <ul className="grid gap-1.5">
            {history.map((l) => (
              <HistoryRow key={l.id} link={l} onCopy={() => copy(shareUrl(l.token))} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function HistoryRow({ link, onCopy }: { link: ReturnType<typeof useWorkspace>["shareLinks"][number]; onCopy: () => void }) {
  const [pending, startTransition] = useTransition();
  const revoked = Boolean(link.revokedAt);
  return (
    <li className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", revoked && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{link.title}</div>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>{formatDistanceToNow(new Date(link.createdAt), { locale: ptBR, addSuffix: true })}</span>
          <span>· {link.postCount} itens</span>
          <span className="inline-flex items-center gap-1">· <EyeIcon className="size-3" /> {link.viewCount}</span>
          {revoked && <span className="text-destructive">· desativado</span>}
        </div>
      </div>
      {!revoked && (
        <>
          <Button size="icon-sm" variant="ghost" onClick={onCopy} aria-label="Copiar link"><CopyIcon /></Button>
          <a href={`/share/${link.token}`} target="_blank" rel="noreferrer" aria-label="Abrir link" className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted"><ExternalLinkIcon className="size-3.5" /></a>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={pending}
            onClick={() => startTransition(async () => { if (confirm("Desativar este link? O cliente não conseguirá mais abrir.")) await revokeShareLink(link.id); })}
          >
            Desativar
          </Button>
        </>
      )}
    </li>
  );
}
