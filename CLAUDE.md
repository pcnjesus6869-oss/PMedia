@AGENTS.md

# PMedia: contexto para sessões de IA

Plataforma de trabalho para **social media de agência**: prévia do feed do Instagram por cliente, editor de Post/Reels/Story (estilo Meta Business Suite), agenda editorial em calendário e **link somente leitura para o cliente aprovar**. O objetivo central é **substituir a pauta mensal enviada em PDF** e agregar valor à entrega. Uso exclusivamente profissional (sem rótulos Pessoal/Estudos).

- Nasceu de uma cópia do **PLife** (gerenciador de tarefas) e foi renomeado em 2026-11-04. Restos disso: pasta original chamava `plife`, Kanban/Roadmap/Matriz/captura por IA vêm do PLife. O PLife como produto separado não existe mais (não havia Git na época).
- Pasta permanente: `D:\Projetos-Claude\PMedia`. Caminhos antigos em `scratch-workspaces` **não valem mais**.
- Repositório: `https://github.com/pcnjesus6869-oss/PMedia` (branch `main`, 1 commit em 2026-11-05).
- Docs detalhadas: [docs/arquitetura.md](docs/arquitetura.md), [docs/decisoes.md](docs/decisoes.md), [docs/historico.md](docs/historico.md). README.md tem funcionalidades e passo a passo da Vercel.

## Estado atual (2026-11-08)

- Funcional localmente e testado no navegador: Feed, Agenda, Cliente, Kanban, Roadmap, Matriz, editor de post, link do cliente (abas Feed e Pauta em calendário), senha da equipe.
- Código no GitHub; **não publicado na Vercel** (o usuário pediu para esperar a autorização dele).
- Banco local (`.pgdata/`) e mídias (`storage/uploads/`) foram copiados para a pasta permanente; `node_modules/` **não** foi copiado.

## Stack

Next.js 16.4 (App Router, `cacheComponents`, `src/proxy.ts` no lugar de middleware) · React 19.3 · TypeScript estrito · Tailwind 4 + shadcn/ui (base-ui) · Prisma 6 + PostgreSQL · Zod 4 · dnd-kit (grade do feed) e @hello-pangea/dnd (Kanban/Matriz) · date-fns (ptBR) · @anthropic-ai/sdk · @vercel/blob · PGlite (Postgres em WebAssembly, só em dev).

**Atenção Next 16:** leia `node_modules/next/dist/docs/` antes de escrever código (ver AGENTS.md). Ex.: com `cacheComponents` não se usa `export const runtime`.

## Comandos

```bash
npm install          # obrigatório na 1ª vez (node_modules não está na pasta); roda prisma generate
npm run setup        # 1ª vez: sobe PGlite, db push + seed (APAGA dados do usuário local)
npm run local        # banco + app em http://localhost:3000 (Ctrl+C para tudo)
npm run db           # só o banco (porta 5433)    | npm run dev   # só o app
npm run db:push      # aplica schema               | npm run db:studio
npm run db:seed      # recria exemplos (APAGA)     | npm run typecheck / lint / build
npx tsx prisma/seed.ts --extra-months   # adiciona 3 meses fictícios sem apagar (idempotente)
npx tsx prisma/seed.ts --team-only      # só cria a equipe sobre dados existentes
```

- Para recomeçar do zero: apague `.pgdata/` e `storage/uploads/` e rode `npm run setup`.
- O dev server trava o motor do Prisma: **pare o servidor antes de `db push`/`generate`**. Se após mudar o schema aparecer cliente Prisma antigo, limpe `.next/` e reinicie.
- Na Vercel o script `vercel-build` faz `prisma generate && prisma db push && next build`. Não há pasta de migrations (usa `db push`).

## Variáveis de ambiente (ver `.env.example`; nunca commitar `.env`)

`DATABASE_URL`, `DATABASE_URL_UNPOOLED` (pooled/direta; Neon preenche na Vercel) · `TEAM_PASSWORD` (senha única da equipe) · `AUTH_SECRET` (opcional, assina o cookie) · `BLOB_READ_WRITE_TOKEN` (ativa Vercel Blob; sem ele, mídias em disco) · `NEXT_PUBLIC_DIRECT_UPLOAD` (`1` = upload direto do navegador ao Blob) · `ANTHROPIC_API_KEY` (opcional; sem ela usa parser local) · `ANTHROPIC_MODEL` (opcional) · `UPLOAD_DIR` (opcional).

O `.env` local já contém uma senha de teste em `TEAM_PASSWORD`; leia de lá para entrar em `/login` local, sem repeti-la em chat ou docs. Sem `TEAM_PASSWORD` em dev, o app fica aberto; em produção, sem ela ninguém entra.

## Estrutura

```
prisma/schema.prisma   User, Member, Client, Task, Tag, Post, MediaAsset, ShareLink (+ enums)
prisma/seed.ts         reset + exemplos; seed-lib.ts (artes SVG, upload ao Blob); seed-months.ts (meses extras)
scripts/local-db.mjs   sobe PGlite na 5433 e roda um comando junto (shell:true p/ Windows)
src/proxy.ts           exige sessão; públicos: /login, /share/*, GET /api/media/<id>
src/app/page.tsx       workspace (RSC + Suspense/streaming) → components/workspace.tsx (abas)
src/app/share/[token]  página pública do cliente (snapshot)
src/app/login          tela de senha     | src/app/api/media/   upload, upload direto, register, GET com Range
src/app/api/ai/parse-task   texto livre → tarefas (Claude ou heurística)
src/server/*-actions.ts     server actions (content, share, task, team, auth), Zod + Result<T>
src/lib/               domain.ts (tipos/labels), schemas.ts (Zod), queries.ts, session.ts, team-auth.ts, storage.ts, ai/
src/components/feed/   ig.tsx (mockups Instagram), feed-view, post-composer, share-dialog
src/components/share/  share-view, pauta-calendar     | src/components/views/  calendar, client, kanban, roadmap, matrix
```

## Convenções

- Server Components buscam dados; Client Components fazem a interação. Toda gravação é server action validada com Zod, retornando `Result<T>` (`src/server/util.ts`), e passa por `getCurrentUser()` (que também verifica a sessão).
- Todas as queries filtram por `userId` (preparado para multiusuário). Hoje existe um único User `local@pmedia.dev`.
- Mídias sempre servidas por `/api/media/<id>` (URL estável; redireciona ao Blob em produção).
- Link do cliente é **cópia congelada** (`ShareLink.snapshot` JSON): editar depois não altera links enviados.
- Data de início/conclusão da tarefa é automática (entra em andamento / conclui). Prioridade = quadrante da Matriz de Eisenhower.
- Seletor de cliente vale só para **Feed, Agenda e Cliente**; Kanban, Roadmap e Matriz são visão geral da agência.
- Textos da UI, comentários e README em **português do Brasil**.

## Preferências do usuário (observadas)

- Responder em português, com explicações claras e passo a passo; ele não é necessariamente técnico.
- **Nunca publicar/deploy (Vercel) nem `git push` sem autorização explícita.**
- **Não usar a conta Supabase conectada ao Claude** (é profissional). Infra do PMedia: só a conta pessoal da Vercel (Neon via Storage + Vercel Blob).
- Prioridade de produto: experiência da prévia do feed e do link do cliente (é o que substitui o PDF), acima de gestão de tarefas genérica.
- Gosta de visual caprichado (janelas com desfoque, cantos arredondados) e testes no navegador, inclusive tamanho de celular.
- Painel do navegador oculto impede a hidratação da página nos testes: não confundir com bug.

## Pendências

- **Login individual por colaborador** (Auth.js ou Clerk) substituindo a senha única; vincular `Member` a conta (`TODO(auth)` em `session.ts`, `team-auth.ts`, schema). Lembrar o usuário quando ele pedir melhorias.
- Deploy na Vercel: aguardando autorização (passo a passo no README).
- Sugestões oferecidas e não escolhidas: aprovação/comentário do cliente no link (mais recomendada), pacote contratado por mês, relatório mensal, checklist de materiais.
- Publicação automática no Instagram exige Graph API da Meta (fora do escopo hoje).
- Integração com Claude na captura de tarefas nunca foi testada com chave real (a confirmar).

## Atualização 12/11/2026

- O repositório no GitHub passa a incluir este `CLAUDE.md` e a pasta `docs/` (2º commit). O código não mudou desde 05/11.
- A pasta está **vinculada ao projeto `pmedia` da Vercel** (`.vercel/project.json` e `.env.local`, gerados pela Vercel CLI). Os dois são ignorados pelo Git: nunca commitar nem copiar o conteúdo do `.env.local` para docs.
- Deploy na Vercel: o vínculo existe, mas se o site está publicado ainda está **a confirmar**. A regra continua: não fazer deploy sem autorização explícita.
- Antes de rodar localmente nesta pasta: `npm install` (o `node_modules/` não foi copiado).
