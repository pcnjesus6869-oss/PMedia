import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { extFromMime, filePath, fileSize } from "@/lib/storage";

/**
 * GET /api/media/:id — serve a mídia com suporte a Range (necessário para vídeo).
 * É pública porque os links de cliente precisam exibi-la; o id é imprevisível.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { mimeType: true, blobUrl: true } });
  // produção: o arquivo está no Vercel Blob (CDN com suporte a Range) → redireciona
  if (asset?.blobUrl) {
    return new Response(null, { status: 307, headers: { Location: asset.blobUrl, "Cache-Control": "public, max-age=86400" } });
  }
  const ext = asset && extFromMime(asset.mimeType);
  if (!asset || !ext) return new Response("Not found", { status: 404 });

  let size: number;
  try {
    size = await fileSize(id, ext);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": asset.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    // impede execução de scripts caso algum arquivo seja malicioso (ex.: SVG)
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  };

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(size - Number(range[2]), 0);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath(id, ext), { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath(id, ext))) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
