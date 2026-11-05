"use client";

import { useState, useSyncExternalStore } from "react";
import { BriefcaseIcon, CalendarDaysIcon, GanttChartIcon, Grid2x2Icon, ImagePlusIcon, KanbanSquareIcon, LayoutGridIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { logout } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClientDTO, MemberDTO, PostDTO, TaskDTO } from "@/lib/domain";
import { TeamDialog } from "./team";
import { AiCommandBar } from "./ai-command-bar";
import { ClientDialog } from "./client-dialog";
import { FeedView } from "./feed/feed-view";
import { PostComposer } from "./feed/post-composer";
import { TaskDialog } from "./task-dialog";
import { CalendarView } from "./views/calendar-view";
import { ClientView } from "./views/client-view";
import { KanbanView } from "./views/kanban-view";
import { MatrixView } from "./views/matrix-view";
import { RoadmapView } from "./views/roadmap-view";
import { useWorkspace, WorkspaceProvider, type ShareLinkRow } from "./workspace-context";

/** Visões que trabalham por cliente; as demais mostram a agência inteira. */
const PER_CLIENT: readonly string[] = ["feed", "calendar", "client"];

const VIEWS = [
  { id: "feed", label: "Feed", icon: LayoutGridIcon, Component: FeedView },
  { id: "calendar", label: "Agenda", icon: CalendarDaysIcon, Component: CalendarView },
  { id: "client", label: "Cliente", icon: BriefcaseIcon, Component: ClientView },
  { id: "kanban", label: "Kanban", icon: KanbanSquareIcon, Component: KanbanView },
  { id: "roadmap", label: "Roadmap", icon: GanttChartIcon, Component: RoadmapView },
  { id: "matrix", label: "Matriz", icon: Grid2x2Icon, Component: MatrixView },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

const NEW_CLIENT = "__new__";
const noopSubscribe = () => () => {};
function readSavedView(): ViewId {
  try {
    const saved = localStorage.getItem("pmedia:view");
    if (VIEWS.some((v) => v.id === saved)) return saved as ViewId;
  } catch {}
  return "feed";
}

export function Workspace(props: { tasks: TaskDTO[]; posts: PostDTO[]; clients: ClientDTO[]; members: MemberDTO[]; shareLinks: ShareLinkRow[] }) {
  return (
    <WorkspaceProvider initialTasks={props.tasks} initialPosts={props.posts} clients={props.clients} members={props.members} shareLinks={props.shareLinks}>
      <Shell />
      <TaskDialog />
      <PostComposer />
      <ClientDialog />
      <TeamDialog />
    </WorkspaceProvider>
  );
}

function Shell() {
  const { clients, clientFilter, setClientFilter, openTask, openPost, openClient, error } = useWorkspace();
  // Drag-and-drop depende do DOM; as visões só renderizam no cliente.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [picked, setView] = useState<ViewId | null>(null);
  const view = picked ?? (mounted ? readSavedView() : "feed");

  const changeView = (v: ViewId) => {
    setView(v);
    try {
      localStorage.setItem("pmedia:view", v);
    } catch {}
  };

  return (
    <Tabs value={view} onValueChange={(v) => changeView(v as ViewId)} className="min-h-screen gap-0">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-fuchsia-600 to-amber-500 text-sm font-bold text-white">P</div>
            <span className="text-lg font-semibold tracking-tight">PMedia</span>
          </div>

          <TabsList className="order-last w-full justify-start overflow-x-auto [scrollbar-width:none] md:order-none md:w-auto [&::-webkit-scrollbar]:hidden">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="flex-none px-2.5">
                <Icon /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="ml-auto flex items-center gap-2">
            {PER_CLIENT.includes(view) ? (
            <select
              aria-label="Cliente"
              value={clientFilter}
              onChange={(e) => (e.target.value === NEW_CLIENT ? openClient(null) : setClientFilter(e.target.value))}
              className="h-8 max-w-[180px] rounded-lg border border-input bg-transparent px-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {view === "calendar" && <option value="ALL">Todos os clientes</option>}
              <option value={NEW_CLIENT}>+ Novo cliente</option>
            </select>
            ) : (
              <span className="hidden text-xs text-muted-foreground sm:inline">Visão geral · todos os clientes</span>
            )}
            {view === "feed" ? (
              <Button size="sm" onClick={() => openPost(null, { type: "POST" })}>
                <ImagePlusIcon /> <span className="hidden sm:inline">Novo post</span>
              </Button>
            ) : (
              <Button size="sm" onClick={() => openTask(null, view === "calendar" && clientFilter !== "ALL" ? { clientId: clientFilter } : undefined)}>
                <PlusIcon /> <span className="hidden sm:inline">Nova tarefa</span>
              </Button>
            )}
            <form action={logout}>
              <Button type="submit" size="icon-sm" variant="ghost" aria-label="Sair" title="Sair">
                <LogOutIcon />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-5 sm:px-6">
        {view !== "feed" && view !== "client" && <AiCommandBar />}
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Falha ao salvar: {error}</p>}
        {VIEWS.map(({ id, Component }) => (
          <TabsContent key={id} value={id}>
            {mounted ? <Component /> : <div className="h-64 animate-pulse rounded-xl bg-muted/50" />}
          </TabsContent>
        ))}
      </main>
    </Tabs>
  );
}
