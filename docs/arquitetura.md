# Arquitetura do PMedia

## Visão geral

App Next.js 16 (App Router) monolítico. Há uma página principal autenticada (o workspace com abas), uma página pública por token (o link do cliente) e algumas rotas de API para mídia e IA. Os dados ficam no PostgreSQL via Prisma; as mídias ficam em disco (local) ou no Vercel Blob (produção).

```
Navegador ──► src/proxy.ts (cookie da equipe) ──► /            → page.tsx (RSC) → Workspace (client, abas)
                                    │                              ↳ server actions (src/server/*) → Prisma → Postgres
                                    ├──► /login (público)
                                    ├──► /share/<token> (público) → getSharedPreview → snapshot JSON
                                    └──► /api/media/<id> GET (público) → disco (Range) ou redirect ao Blob
```

## Camadas

- **`src/app/page.tsx`**: Server Component com `<Suspense>` e um skeleton estático. `WorkspaceLoader` chama `connection()` e `getWorkspaceData()`, que trazem tasks, clients, members, posts e shareLinks, e entrega tudo ao componente client `Workspace`.
- **`src/components/workspace.tsx`**: cabeçalho com as abas Feed, Agenda, Cliente, Kanban, Roadmap e Matriz (a última aba fica salva no `localStorage`), o seletor de cliente (só em Feed, Agenda e Cliente), a equipe e o botão Sair. O estado compartilhado e as atualizações otimistas ficam em `workspace-context.tsx`.
- **`src/server/`**: server actions (`"use server"`). Cada uma chama `getCurrentUser()`, valida com Zod (`src/lib/schemas.ts`), confere se o recurso pertence ao `userId`, grava e chama `revalidatePath`. O retorno é `Result<T>` (`{ok, data} | {ok:false, error}`).
  - `content-actions.ts`: clientes e posts (criar, editar, excluir, duplicar e reordenar a grade).
  - `share-actions.ts`: `createShareLink` filtra os posts por status e período (rascunhos e publicados são opcionais), monta o snapshot e gera o token. Também tem `revokeShareLink`.
  - `task-actions.ts`: tarefas, incluindo a regra automática de `startDate` e `completedAt` e `saveParsedTasks` (da IA).
  - `team-actions.ts`: colaboradores. `auth-actions.ts`: login e logout.
- **`src/lib/`**: `domain.ts` (tipos, DTOs, labels e cores de status e formato), `queries.ts` (leitura e conversão para DTO), `db.ts` (PrismaClient singleton), `session.ts`, `team-auth.ts`, `storage.ts`, `media.ts`, `upload-client.ts` (função única de upload no navegador), `ids.ts` (nanoid para tokens) e `ai/` (`claude.ts` e `heuristic.ts`).

## Modelo de dados (prisma/schema.prisma)

- **User**: conta da agência. Hoje existe só uma, `local@pmedia.dev`, criada por upsert em `getCurrentUser()`.
- **Member**: colaborador, com nome, função e cor. Responde por Clients e Tasks.
- **Client**: perfil do Instagram (nome, @, bio, site, avatar, cor), com `targetDate` (a meta no Roadmap) e `ownerId` (o Member responsável).
- **Post**: tipo `POST | REEL | STORY` e status `DRAFT → IN_REVIEW → APPROVED → SCHEDULED → PUBLISHED`. Guarda legenda, `script` (o roteiro), primeiro comentário, local, `collaborators[]`, `aspectRatio`, `scheduledAt`, `pinned`, `shareToFeed`, a capa do Reel (`coverUrl`/`coverTime`) e `feedPosition` (ordem manual na grade).
- **MediaAsset**: mídias do post (IMAGE/VIDEO). `url` é sempre `/api/media/<id>`; `blobUrl` fica preenchido quando o arquivo está no Blob.
- **ShareLink**: token, título, mensagem, `snapshot` (JSON), `postCount`, `viewCount`, `lastViewAt` e `revokedAt`.
- **Task**: status `NOT_STARTED, IN_PROGRESS, AWAITING_APPROVAL, AWAITING_RETURN, EXTERNAL, DONE` e prioridade `LOW..URGENT`, que corresponde aos quadrantes da Matriz (URGENT = Fazer agora, HIGH = Agendar, MEDIUM = Delegar, LOW = Eliminar). Tem subtarefas por `parentId`, `assigneeId` e `clientId`.
- **Tag**: herdado do PLife. Pouco usado na UI (a confirmar).

## Autenticação (senha única)

- `src/lib/team-auth.ts`: o cookie `pmedia_team` guarda `<expiração>.<HMAC-SHA256>`. A chave do HMAC é `AUTH_SECRET` ou, na falta dele, a própria senha, e a senha também entra na mensagem assinada. A comparação é feita em tempo constante e `safeNext` evita open redirect.
- `src/proxy.ts`: a convenção do Next 16, que substitui o middleware. Sem sessão, as APIs respondem 401 e as páginas redirecionam para `/login?next=...`.
- `getCurrentUser()` verifica a sessão de novo, uma defesa em profundidade para server actions e APIs.

## Mídia

- Tipos aceitos e limite de tamanho em `src/lib/storage.ts` (`ALLOWED_TYPES`, `MAX_UPLOAD_BYTES`).
- Local: `POST /api/media` grava em `storage/uploads/<id>.<ext>`, e o `GET /api/media/<id>` serve o arquivo com suporte a Range (necessário para tocar vídeo).
- Produção com `NEXT_PUBLIC_DIRECT_UPLOAD=1`: o navegador pede um token em `/api/media/upload` (`handleUpload` do `@vercel/blob/client`), envia o arquivo direto ao Blob e chama `/api/media/register`, que só aceita URLs do próprio Blob (`isOwnBlobUrl`). O GET redireciona para o Blob.

## IA (captura de tarefas)

- `POST /api/ai/parse-task` recebe texto livre e devolve `{tasks, source: "claude" | "heuristic"}` como prévia editável, que depois é salva por `saveParsedTasks`.
- `src/lib/ai/claude.ts`: usa o modelo `ANTHROPIC_MODEL` (padrão definido no código), com saída estruturada via Zod, o beta `server-side-fallback` e `fallbacks: "default"`.
- `src/lib/ai/heuristic.ts`: parser em português (dias da semana, horários, subtarefas depois de ":", palavras de urgência e importância).

## Ambiente local

- `scripts/local-db.mjs`: PGlite em `./.pgdata`, servido como Postgres pela porta 5433 (`pglite-socket`, até 10 conexões). A connection string usa `connection_limit=1&pgbouncer=true`.
- Seed: `prisma/seed.ts` recria 3 clientes de exemplo (Café Aurora, Studio Move e Verde Arquitetura), a equipe (Ana, Bruno e Carla, que é a designer), posts, stories e tarefas, com as artes geradas em SVG por `seed-lib.ts`. Com `--extra-months`, `seed-months.ts` adiciona os 3 meses seguintes sem apagar nada.

## Deploy (planejado, não executado)

Vercel com Neon (Storage), que preenche `DATABASE_URL` e `DATABASE_URL_UNPOOLED`, e Vercel Blob (`BLOB_READ_WRITE_TOKEN`). O build roda `vercel-build`, que faz `db push` antes do `next build`. O passo a passo completo está no README.
