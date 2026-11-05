import type { MediaDTO } from "./domain";

export function toMediaDTO(asset: { id: string; kind: "IMAGE" | "VIDEO"; url: string; mimeType: string; width: number | null; height: number | null; alt: string | null }): MediaDTO {
  return { id: asset.id, kind: asset.kind, url: asset.url, mimeType: asset.mimeType, width: asset.width, height: asset.height, alt: asset.alt };
}
