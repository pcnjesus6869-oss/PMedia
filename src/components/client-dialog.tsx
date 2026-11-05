"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { createClient, updateClient } from "@/server/content-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClientDTO } from "@/lib/domain";
import { Avatar } from "./feed/ig";
import { useWorkspace } from "./workspace-context";
import { uploadMedia } from "@/lib/upload-client";

/** Cadastro/edição do perfil do cliente (como aparece no topo do Instagram). */
export function ClientDialog() {
  const { clientEditing, closeClient } = useWorkspace();
  return (
    <Dialog open={clientEditing !== null} onOpenChange={(o) => !o && closeClient()}>
      <DialogContent className="sm:max-w-md">
        {clientEditing && <ClientForm key={clientEditing.client?.id ?? "new"} client={clientEditing.client} />}
      </DialogContent>
    </Dialog>
  );
}

function ClientForm({ client }: { client: ClientDTO | null }) {
  const { closeClient, setClientFilter, members } = useWorkspace();
  const [name, setName] = useState(client?.name ?? "");
  const [handle, setHandle] = useState(client?.handle ?? "");
  const [bio, setBio] = useState(client?.bio ?? "");
  const [website, setWebsite] = useState(client?.website ?? "");
  const [color, setColor] = useState(client?.color ?? "#6366f1");
  const [avatarUrl, setAvatarUrl] = useState(client?.avatarUrl ?? null);
  const [ownerId, setOwnerId] = useState(client?.ownerId ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const media = await uploadMedia(file);
      if (media.kind !== "IMAGE") return setError("A foto de perfil precisa ser uma imagem");
      setAvatarUrl(media.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const data = { name, handle, bio: bio || null, website: website || null, color, avatarUrl, ownerId: ownerId || null };
      const res = client ? await updateClient(client.id, data) : await createClient(data);
      if (!res.ok) return setError(res.error);
      if (!client && res.data) setClientFilter((res.data as { id: string }).id);
      closeClient();
    });
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{client ? "Editar perfil do cliente" : "Novo cliente"}</DialogTitle>
      </DialogHeader>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative" aria-label="Trocar foto de perfil">
          <Avatar client={{ name: name || "?", handle, bio, website, avatarUrl, color }} size={72} />
          {uploading && <Loader2Icon className="absolute inset-0 m-auto size-6 animate-spin text-white" />}
        </button>
        <div className="grid gap-1 text-sm">
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Foto de perfil</Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Cor de identificação <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-8 rounded" />
          </label>
        </div>
        <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-name">Nome</Label>
        <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-handle">@ do Instagram</Label>
        <Input id="c-handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="nomedocliente" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-owner">Responsável na equipe</Label>
        <select id="c-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
          <option value="">Sem responsável</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}{m.role ? ` · ${m.role}` : ""}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-bio">Bio <span className="ml-auto text-xs font-normal text-muted-foreground">{bio.length}/150</span></Label>
        <Textarea id="c-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={150} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-site">Link na bio</Label>
        <Input id="c-site" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="site.com.br" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending || uploading}>{client ? "Salvar" : "Criar cliente"}</Button>
      </DialogFooter>
    </form>
  );
}
