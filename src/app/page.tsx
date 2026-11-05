import { Suspense } from "react";
import { connection } from "next/server";
import { Workspace } from "@/components/workspace";
import { getWorkspaceData } from "@/lib/queries";

export default function Home() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <WorkspaceLoader />
    </Suspense>
  );
}

// Server Component: busca os dados no banco (por requisição) e entrega às visões interativas.
async function WorkspaceLoader() {
  await connection();
  const { tasks, clients, members, posts, shareLinks } = await getWorkspaceData();
  return <Workspace tasks={tasks} clients={clients} members={members} posts={posts} shareLinks={shareLinks} />;
}

function WorkspaceSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-5 sm:px-6" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-14 animate-pulse rounded-xl bg-muted/70" />
      <div className="h-8 w-80 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-xl bg-muted/50" />
        ))}
      </div>
    </div>
  );
}
