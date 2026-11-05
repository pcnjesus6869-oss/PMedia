"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { updateTask } from "@/server/task-actions";
import { updatePost } from "@/server/content-actions";
import { effectiveAssignee, lifecycleDates, type ClientDTO, type MemberDTO, type PostDTO, type PostType, type ShareLinkDTO, type TaskDTO } from "@/lib/domain";
import type { PostUpdate, TaskUpdate } from "@/lib/schemas";

export type ShareLinkRow = ShareLinkDTO & { clientId: string };

type Ctx = {
  tasks: TaskDTO[];
  /** Tarefas raiz (sem parentId) filtradas pelo cliente selecionado */
  rootTasks: TaskDTO[];
  /** Todas as tarefas raiz (visões gerais: Kanban, Roadmap, Matriz) */
  allRootTasks: TaskDTO[];
  members: MemberDTO[];
  memberById: Map<string, MemberDTO>;
  /** Responsável efetivo da tarefa (dela ou do cliente) */
  assigneeOf: (task: TaskDTO) => string | null;
  memberFilter: string | "ALL";
  setMemberFilter: (id: string | "ALL") => void;
  teamOpen: boolean;
  setTeamOpen: (open: boolean) => void;
  clients: ClientDTO[];
  clientById: Map<string, ClientDTO>;
  /** Posts do cliente selecionado (ou de todos) */
  posts: PostDTO[];
  allPosts: PostDTO[];
  shareLinks: ShareLinkRow[];
  subtasksOf: (id: string) => TaskDTO[];
  clientFilter: string | "ALL";
  setClientFilter: (id: string | "ALL") => void;
  /** Cliente ativo (o filtrado ou, em "Todos", o primeiro) */
  activeClient: ClientDTO | null;
  patchTask: (patch: TaskUpdate) => void;
  patchPost: (patch: PostUpdate) => void;
  /** Substitui localmente a ordem (otimista) */
  setPostOrder: (orderedIds: string[]) => void;
  openTask: (task: TaskDTO | null, defaults?: Partial<TaskDTO>) => void;
  editing: { task: TaskDTO | null; defaults?: Partial<TaskDTO> } | null;
  closeTask: () => void;
  openPost: (post: PostDTO | null, defaults?: { type?: PostType; scheduledAt?: string }) => void;
  composing: { post: PostDTO | null; defaults?: { type?: PostType; scheduledAt?: string } } | null;
  closePost: () => void;
  openClient: (client: ClientDTO | null) => void;
  clientEditing: { client: ClientDTO | null } | null;
  closeClient: () => void;
  error: string | null;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace fora do WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({
  initialTasks,
  initialPosts,
  clients,
  members,
  shareLinks,
  children,
}: {
  initialTasks: TaskDTO[];
  initialPosts: PostDTO[];
  clients: ClientDTO[];
  members: MemberDTO[];
  shareLinks: ShareLinkRow[];
  children: React.ReactNode;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [posts, setPosts] = useState(initialPosts);
  const [clientFilter, setClientFilter] = useState<string | "ALL">(() => clients[0]?.id ?? "ALL");
  const [editing, setEditing] = useState<Ctx["editing"]>(null);
  const [composing, setComposing] = useState<Ctx["composing"]>(null);
  const [clientEditing, setClientEditing] = useState<Ctx["clientEditing"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<string | "ALL">("ALL");
  const [teamOpen, setTeamOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Dados novos do servidor (após revalidatePath) substituem o estado otimista.
  const [server, setServer] = useState({ initialTasks, initialPosts });
  if (server.initialTasks !== initialTasks || server.initialPosts !== initialPosts) {
    setServer({ initialTasks, initialPosts });
    setTasks(initialTasks);
    setPosts(initialPosts);
  }

  const patchTask = useCallback((patch: TaskUpdate) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== patch.id) return t;
        const rest = { ...patch };
        delete rest.tagNames;
        delete rest.startDate;
        const dates =
          patch.status && patch.status !== t.status
            ? Object.fromEntries(Object.entries(lifecycleDates(patch.status, t)).map(([k, v]) => [k, v ? v.toISOString() : null]))
            : {};
        return { ...t, ...(rest as Partial<TaskDTO>), ...dates };
      }),
    );
    startTransition(async () => {
      const res = await updateTask(patch);
      setError(res.ok ? null : res.error);
    });
  }, []);

  const patchPost = useCallback((patch: PostUpdate) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== patch.id || patch.media) return p;
        return { ...p, ...(patch as Partial<PostDTO>) };
      }),
    );
    startTransition(async () => {
      const res = await updatePost(patch);
      setError(res.ok ? null : res.error);
    });
  }, []);

  const setPostOrder = useCallback((orderedIds: string[]) => {
    const pos = new Map(orderedIds.map((id, i) => [id, i]));
    setPosts((prev) => prev.map((p) => (pos.has(p.id) ? { ...p, feedPosition: pos.get(p.id)! } : p)));
  }, []);

  const value = useMemo<Ctx>(() => {
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const children = new Map<string, TaskDTO[]>();
    for (const t of tasks) {
      if (!t.parentId) continue;
      children.set(t.parentId, [...(children.get(t.parentId) ?? []), t]);
    }
    const inFilter = (id: string | null) => clientFilter === "ALL" || id === clientFilter;
    const assigneeOf = (t: TaskDTO) => effectiveAssignee(t, (cid) => clientById.get(cid)?.ownerId);
    return {
      tasks,
      rootTasks: tasks.filter((t) => !t.parentId && inFilter(t.clientId)),
      allRootTasks: tasks.filter((t) => !t.parentId),
      members,
      memberById: new Map(members.map((m) => [m.id, m])),
      assigneeOf,
      memberFilter,
      setMemberFilter,
      teamOpen,
      setTeamOpen,
      clients,
      clientById,
      posts: posts.filter((p) => inFilter(p.clientId)),
      allPosts: posts,
      shareLinks,
      subtasksOf: (id) => children.get(id) ?? [],
      clientFilter,
      setClientFilter,
      activeClient: clientById.get(clientFilter) ?? null,
      patchTask,
      patchPost,
      setPostOrder,
      openTask: (task, defaults) => setEditing({ task, defaults }),
      editing,
      closeTask: () => setEditing(null),
      openPost: (post, defaults) => setComposing({ post, defaults }),
      composing,
      closePost: () => setComposing(null),
      openClient: (client) => setClientEditing({ client }),
      clientEditing,
      closeClient: () => setClientEditing(null),
      error,
    };
  }, [tasks, posts, clients, members, memberFilter, teamOpen, shareLinks, clientFilter, patchTask, patchPost, setPostOrder, editing, composing, clientEditing, error]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
