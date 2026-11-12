/** Utilitários compartilhados pelos scripts de seed. */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";

export const db = new PrismaClient();
const createId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 21);
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** Arte de exemplo em SVG (gradiente + título), salva como mídia real do app. */
export async function art(opts: { w: number; h: number; from: string; to: string; title: string; sub?: string; dark?: boolean }) {
  const { w, h, from, to, title, sub, dark } = opts;
  const fg = dark ? "#1c1917" : "#ffffff";
  const lines = title.split("\n");
  const size = title.length === 1 ? Math.round(w * 0.5) : Math.round(w / (lines.some((l) => l.length > 12) ? 11 : 8));
  const startY = h / 2 - ((lines.length - 1) * size * 1.1) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${w * 0.85}" cy="${h * 0.15}" r="${w * 0.22}" fill="${fg}" opacity="0.08"/>
<circle cx="${w * 0.1}" cy="${h * 0.9}" r="${w * 0.3}" fill="${fg}" opacity="0.06"/>
${lines.map((l, i) => `<text x="50%" y="${startY + i * size * 1.1}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-weight="700" font-size="${size}" fill="${fg}">${esc(l)}</text>`).join("\n")}
${sub ? `<text x="50%" y="${startY + lines.length * size * 1.1 + size * 0.4}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(size * 0.38)}" letter-spacing="4" fill="${fg}" opacity="0.85">${esc(sub.toUpperCase())}</text>` : ""}
</svg>`;
  const id = createId();
  let blobUrl: string | null = null;
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    // seed apontando para produção: sobe a arte para o Vercel Blob
    const { put } = await import("@vercel/blob");
    blobUrl = (await put(`media/${id}.svg`, svg, { access: "public", contentType: "image/svg+xml", addRandomSuffix: false })).url;
  } else {
    await writeFile(path.join(UPLOAD_DIR, `${id}.svg`), svg);
  }
  return { id, kind: "IMAGE" as const, url: `/api/media/${id}`, blobUrl, mimeType: "image/svg+xml", width: w, height: h };
}

export const SIZE = { "4:5": [1080, 1350], "1:1": [1080, 1080], "9:16": [1080, 1920], "3:4": [1080, 1440] } as const;
