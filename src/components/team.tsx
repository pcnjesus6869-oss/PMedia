"use client";

import { useState, useTransition } from "react";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { createMember, deleteMember, updateMember } from "@/server/team-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MemberDTO, TaskDTO } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./workspace-context";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export function MemberAvatar({ member, size = 22, className }: { member: MemberDTO | null | undefined; size?: number; className?: string }) {
  if (!member) {
    return (
      <span title="Sem responsável" className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground", className)} style={{ width: size, height: size, fontSize: size * 0.45 }}>
        ?
      </span>
    );
  }
  return (
    <span
      title={`${member.name}${member.role ? ` · ${member.role}` : ""}`}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: member.color, fontSize: size * 0.4 }}
    >
      {initials(member.name)}
    </span>
  );
}

/**
 * Filtro por colaborador (Kanban e Matriz). Mostra a carteira de clientes
 * de quem está selecionado.
 */
export function MemberFilter({ tasks }: { tasks: TaskDTO[] }) {
  const { members, memberFilter, setMemberFilter, assigneeOf, clients, setTeamOpen } = useWorkspace();
  const count = (id: string | null) => tasks.filter((t) => t.status !== "DONE" && assigneeOf(t) === id).length;
  const selected = members.find((m) => m.id === memberFilter);
  const portfolio = selected ? clients.filter((c) => c.ownerId === selected.id) : [];
  const unassigned = count(null);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip active={memberFilter === "ALL"} onClick={() => setMemberFilter("ALL")}>
          <UsersIcon className="size-3.5" /> Toda a equipe
        </FilterChip>
        {members.map((m) => (
          <FilterChip key={m.id} active={memberFilter === m.id} onClick={() => setMemberFilter(m.id)}>
            <MemberAvatar member={m} size={20} />
            {m.name.split(" ")[0]}
            <span className="tabular-nums opacity-60">{count(m.id)}</span>
          </FilterChip>
        ))}
        {unassigned > 0 && (
          <FilterChip active={memberFilter === "NONE"} onClick={() => setMemberFilter("NONE")}>
            <MemberAvatar member={null} size={20} /> Sem responsável <span className="opacity-60">{unassigned}</span>
          </FilterChip>
        )}
        <Button variant="ghost" size="sm" onClick={() => setTeamOpen(true)} className="ml-auto">
          Gerenciar equipe
        </Button>
      </div>
      {selected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <span className="font-medium">
            Agenda de {selected.name}
            {selected.role ? ` · ${selected.role}` : ""}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Clientes:</span>
          {portfolio.length ? (
            portfolio.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-medium">
                <span className="size-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">nenhum cliente fixo (tarefas atribuídas diretamente)</span>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
        active ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Filtra tarefas pelo colaborador escolhido. */
export function useMemberFilteredTasks(tasks: TaskDTO[]) {
  const { memberFilter, assigneeOf } = useWorkspace();
  if (memberFilter === "ALL") return tasks;
  if (memberFilter === "NONE") return tasks.filter((t) => assigneeOf(t) === null);
  return tasks.filter((t) => assigneeOf(t) === memberFilter);
}

/* ---------------- Gerenciar equipe ---------------- */

export function TeamDialog() {
  const { teamOpen, setTeamOpen, members, clients } = useWorkspace();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [color, setColor] = useState("#0ea5e9");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createMember({ name, role: role || null, color });
      if (!res.ok) return setError(res.error);
      setName("");
      setRole("");
      setError(null);
    });
  };

  return (
    <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Equipe</DialogTitle>
          <DialogDescription>
            Cada colaborador tem sua agenda no Kanban. Defina o responsável de cada cliente em “Editar perfil”; as tarefas do cliente vão para ele automaticamente, a menos que você atribua outra pessoa na tarefa.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} clientCount={clients.filter((c) => c.ownerId === m.id).length} />
          ))}
          {members.length === 0 && <li className="text-sm text-muted-foreground">Nenhum colaborador ainda.</li>}
        </ul>
        <form onSubmit={add} className="grid gap-2 border-t pt-3">
          <span className="text-sm font-medium">Adicionar colaborador</span>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required />
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Função (ex.: Designer)" />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Cor" className="h-8 w-10 shrink-0 rounded" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={pending || !name.trim()} className="justify-self-start">
            <PlusIcon /> Adicionar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({ member, clientCount }: { member: MemberDTO; clientCount: number }) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = name !== member.name || role !== (member.role ?? "");
  return (
    <li className="flex items-center gap-2 rounded-lg border p-2">
      <MemberAvatar member={{ ...member, name }} size={28} />
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7" aria-label="Nome" />
      <Input value={role} onChange={(e) => setRole(e.target.value)} className="h-7" placeholder="Função" aria-label="Função" />
      <span className="shrink-0 text-xs text-muted-foreground">{clientCount} cliente(s)</span>
      {dirty && (
        <Button size="sm" disabled={pending} onClick={() => startTransition(async () => void (await updateMember(member.id, { name, role: role || null, color: member.color })))}>
          Salvar
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Remover ${member.name}`}
        disabled={pending}
        onClick={() => startTransition(async () => { if (confirm(`Remover ${member.name}? Clientes e tarefas ficam sem responsável.`)) await deleteMember(member.id); })}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
