import "server-only";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Armazenamento de mídia:
 *  - Produção (Vercel): Vercel Blob, ativado quando BLOB_READ_WRITE_TOKEN existe.
 *  - Local: disco em ./storage/uploads.
 * Em ambos os casos o app usa a URL estável /api/media/<id>.
 */
export const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Só aceitamos URLs do Blob da própria loja (evita registrar links externos). */
export function isOwnBlobUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function saveToBlob(id: string, ext: string, file: File) {
  const { put } = await import("@vercel/blob");
  const blob = await put(`media/${id}.${ext}`, file, { access: "public", contentType: file.type, addRandomSuffix: false });
  return blob.url;
}
// Caminhos decididos em tempo de execução: turbopackIgnore evita que o build rastreie o projeto inteiro.
export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./storage/uploads");

export const ALLOWED_TYPES: Record<string, { ext: string; kind: "IMAGE" | "VIDEO" }> = {
  "image/jpeg": { ext: "jpg", kind: "IMAGE" },
  "image/png": { ext: "png", kind: "IMAGE" },
  "image/webp": { ext: "webp", kind: "IMAGE" },
  "image/gif": { ext: "gif", kind: "IMAGE" },
  "video/mp4": { ext: "mp4", kind: "VIDEO" },
  "video/quicktime": { ext: "mov", kind: "VIDEO" },
  "video/webm": { ext: "webm", kind: "VIDEO" },
};

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

export function filePath(id: string, ext: string) {
  if (!/^[\w-]+$/.test(id) || !/^\w+$/.test(ext)) throw new Error("caminho inválido");
  return path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, `${id}.${ext}`);
}

export async function saveFile(id: string, ext: string, file: File) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const dest = filePath(id, ext);
  await pipeline(Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream), createWriteStream(dest));
  return dest;
}

export async function fileSize(id: string, ext: string) {
  return (await stat(/*turbopackIgnore: true*/ filePath(id, ext))).size;
}

export function extFromMime(mime: string) {
  if (mime === "image/svg+xml") return "svg"; // apenas mídia gerada pelo seed
  return ALLOWED_TYPES[mime]?.ext;
}
