"use client";

import type { MediaDTO } from "./domain";

/** Extensões aceitas (espelha ALLOWED_TYPES do servidor). */
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** Na Vercel (NEXT_PUBLIC_DIRECT_UPLOAD=1) o arquivo vai direto do navegador ao Blob. */
const DIRECT = process.env.NEXT_PUBLIC_DIRECT_UPLOAD === "1";

/** Lê dimensões/duração no navegador antes do upload. */
export function probe(file: File): Promise<{ width?: number; height?: number; duration?: number }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const done = (v: { width?: number; height?: number; duration?: number }) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done({ width: v.videoWidth, height: v.videoHeight, duration: v.duration });
      v.onerror = () => done({});
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done({});
      img.src = url;
    }
  });
}

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 21);
}

/** Envia uma imagem/vídeo e devolve a mídia registrada no PMedia. */
export async function uploadMedia(file: File): Promise<MediaDTO & { duration?: number }> {
  const meta = await probe(file);

  if (DIRECT) {
    const ext = EXT[file.type];
    if (!ext) throw new Error(`Formato não suportado (${file.type || "desconhecido"})`);
    const { upload } = await import("@vercel/blob/client");
    const id = newId();
    const blob = await upload(`media/${id}.${ext}`, file, { access: "public", handleUploadUrl: "/api/media/upload", contentType: file.type, multipart: file.size > 20 * 1024 * 1024 });
    const res = await fetch("/api/media/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, blobUrl: blob.url, mimeType: file.type, width: meta.width ?? null, height: meta.height ?? null, duration: meta.duration ?? null }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Falha ao registrar a mídia");
    return { ...json, duration: meta.duration };
  }

  const body = new FormData();
  body.append("file", file);
  if (meta.width) body.append("width", String(meta.width));
  if (meta.height) body.append("height", String(meta.height));
  if (meta.duration) body.append("duration", String(meta.duration));
  const res = await fetch("/api/media", { method: "POST", body });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Falha no upload");
  return { ...json, duration: meta.duration };
}
