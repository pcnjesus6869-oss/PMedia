import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { toMediaDTO } from "@/lib/media";
import { ALLOWED_TYPES, blobEnabled, isOwnBlobUrl } from "@/lib/storage";

const schema = z.object({
  id: z.string().regex(/^[\w-]{10,40}$/),
  blobUrl: z.string().url(),
  mimeType: z.string(),
  width: z.number().positive().nullable().optional(),
  height: z.number().positive().nullable().optional(),
  duration: z.number().positive().nullable().optional(),
});

/** POST /api/media/register — registra no banco um arquivo já enviado ao Vercel Blob. */
export async function POST(req: Request) {
  if (!blobEnabled()) return NextResponse.json({ error: "Blob não configurado" }, { status: 404 });
  try {
    await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { id, blobUrl, mimeType, width, height, duration } = parsed.data;
  const type = ALLOWED_TYPES[mimeType];
  if (!type || !isOwnBlobUrl(blobUrl) || !new URL(blobUrl).pathname.endsWith(`/media/${id}.${type.ext}`)) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }
  const asset = await db.mediaAsset.create({
    data: {
      id,
      kind: type.kind,
      url: `/api/media/${id}`,
      blobUrl,
      mimeType,
      width: width ? Math.round(width) : null,
      height: height ? Math.round(height) : null,
      duration: duration ?? null,
    },
  });
  return NextResponse.json(toMediaDTO(asset), { status: 201 });
}
