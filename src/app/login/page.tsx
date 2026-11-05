import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-fuchsia-50 via-background to-amber-50 px-4 dark:from-fuchsia-950/20 dark:to-amber-950/20">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-2xl shadow-black/10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-amber-500 text-lg font-bold text-white">P</div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">PMedia</h1>
            <p className="text-sm text-muted-foreground">Acesso da equipe</p>
          </div>
        </div>
        <Suspense>
          <NextField searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function NextField({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/"} />;
}
