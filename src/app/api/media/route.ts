import { NextResponse } from "next/server";
import { createId } from "@/lib/ids";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ALLOWED_TYPES, blobEnabled, MAX_UPLOAD_BYTES, saveFile, saveToBlob } from "@/lib/storage";
import { toMediaDTO } from "@/lib/media";

/**
 * POST /api/media  (multipart/form-data) — upload pelo servidor.
 * Campos: file, width?, height?, duration?
 * Na Vercel, arquivos grandes usam o upload direto (/api/media/upload + /api/media/register),
 * pois funções serverless aceitam no máximo ~4,5 MB por requisição.
 */
export async function POST(req: Request) {
  try {
    await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });

  const type = ALLOWED_TYPES[file.type];
  if (!type) return NextResponse.json({ error: `Formato não suportado (${file.type || "desconhecido"}). Use JPG, PNG, WEBP, GIF, MP4, MOV ou WEBM.` }, { status: 415 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Arquivo acima de 300 MB" }, { status: 413 });

  const num = (k: string) => {
    const v = Number(form!.get(k));
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  const id = createId();
  const blobUrl = blobEnabled() ? await saveToBlob(id, type.ext, file) : (await saveFile(id, type.ext, file), null);
  const asset = await db.mediaAsset.create({
    data: {
      id,
      kind: type.kind,
      url: `/api/media/${id}`,
      blobUrl,
      mimeType: file.type,
      width: num("width") && Math.round(num("width")!),
      height: num("height") && Math.round(num("height")!),
      duration: num("duration"),
    },
  });
  return NextResponse.json(toMediaDTO(asset), { status: 201 });
}
