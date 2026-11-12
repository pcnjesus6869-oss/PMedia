import { NextResponse } from "next/server";
import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/session";
import { ALLOWED_TYPES, blobEnabled, MAX_UPLOAD_BYTES } from "@/lib/storage";

/**
 * POST /api/media/upload — gera uma URL pré-assinada para o navegador enviar o arquivo
 * direto ao Vercel Blob (sem passar pelo limite de ~4,5 MB das funções).
 * Funciona com as duas formas de conexão do Blob (chave ou BLOB_STORE_ID + OIDC).
 * Depois do envio, o navegador chama /api/media/register.
 */
export async function POST(req: Request) {
  if (!blobEnabled()) return NextResponse.json({ error: "Upload direto indisponível (Blob não configurado)" }, { status: 404 });
  try {
    await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = (await req.json()) as HandleUploadPresignedBody;
  const allowedContentTypes = Object.keys(ALLOWED_TYPES);
  try {
    const json = await handleUploadPresigned({
      body,
      request: req,
      // só é usada para validar o aviso de "upload concluído", que este app não usa
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY ?? "nao-usado",
      getSignedToken: async (pathname) => {
        if (!/^media\/[\w-]+\.\w+$/.test(pathname)) throw new Error("Caminho inválido");
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          validUntil: Date.now() + 15 * 60_000,
        });
        return { token, urlOptions: { allowedContentTypes, maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: false } };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    console.error("[media/upload]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no upload" }, { status: 400 });
  }
}
