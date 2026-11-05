import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getSharedPreview } from "@/lib/queries";
import { ShareView } from "@/components/share/share-view";

export const metadata: Metadata = {
  title: "Prévia do feed",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SharePage({ params }: PageProps<"/share/[token]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-md animate-pulse rounded-2xl bg-muted" />}>
      <SharedPreview params={params} />
    </Suspense>
  );
}

async function SharedPreview({ params }: { params: PageProps<"/share/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const data = await getSharedPreview(token);
  if (!data) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold">Link indisponível</h1>
        <p className="text-sm text-muted-foreground">Esta prévia foi desativada ou o endereço está incorreto. Peça um novo link à sua agência.</p>
      </main>
    );
  }
  return <ShareView title={data.title} message={data.message} createdAt={data.createdAt} snapshot={data.snapshot} />;
}
