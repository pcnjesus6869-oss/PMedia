import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/session";
import { ALLOWED_TYPES, blobEnabled, MAX_UPLOAD_BYTES } from "@/lib/storage";

/**
 * POST /api/media/upload — gera o token para o navegador enviar o arquivo
 * direto ao Vercel Blob (sem passar pelo limite de ~4,5 MB das funções).
 * Depois do envio, o navegador chama /api/media/register.
 */
export async function POST(req: Request) {
  if (!blobEnabled()) return NextResponse.json({ error: "Upload direto indisponível (Blob não configurado)" }, { status: 404 });
  try {
    await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^media\/[\w-]+\.\w+$/.test(pathname)) throw new Error("Caminho inválido");
        return {
          allowedContentTypes: Object.keys(ALLOWED_TYPES),
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no upload" }, { status: 400 });
  }
}
