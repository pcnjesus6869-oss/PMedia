# PMedia: planejamento de conteúdo para social media

Prévia do feed do Instagram para cada cliente, editor de Post, Reels e Story no estilo do Meta Business Suite, agenda editorial e **link de aprovação para o cliente**, no lugar da pauta em PDF.

Next.js 16 (App Router, TypeScript) · Tailwind 4 + shadcn/ui · PostgreSQL + Prisma 6 · dnd-kit e @hello-pangea/dnd · date-fns · Claude (Anthropic SDK) · Zod

## Rodando localmente

Requer apenas Node.js 20+. Não precisa instalar PostgreSQL nem Docker.

```bash
npm install
npm run setup       # 1ª vez: cria o banco local, as tabelas e dados de exemplo (3 clientes, posts, tarefas, próximos 3 meses)
npm run local       # sobe banco + app → http://localhost:3000 (Ctrl+C para parar)
```

- Banco local: PostgreSQL em WebAssembly (PGlite), com os dados em `.pgdata/`.
- Mídias enviadas ficam em `storage/uploads/`.
- Para recomeçar do zero, apague as duas pastas e rode `npm run setup`.
- Outros scripts: `npm run db` (só o banco), `npm run dev` (só o app), `npm run db:studio`, `npm run build`.
- PostgreSQL real (Supabase, Neon, Docker…): troque `DATABASE_URL` no `.env`, rode `npm run db:init` e depois `npm run dev`.

## Funcionalidades

**Feed** (visão principal)
- Perfil do cliente como no Instagram: foto, @, bio, link e stories.
- Grade 3:4, igual à atual do Instagram. Arraste para planejar a estética. Fixados (máx. 3) ficam no topo. "Organizar por data" reordena como o Instagram vai exibir.
- Ícones de carrossel, Reels e fixado, além do status e da data em cada post.
- Lista de programação com tudo que ainda não foi publicado.

**Editor de conteúdo**
- **Post:** foto ou carrossel de até 20 mídias, com reordenação e texto alternativo, nas proporções 4:5, 1:1, 3:4 e 1.91:1.
- **Reels:** vídeo 9:16, capa enviada ou escolhida por frame do vídeo, e opção "mostrar na grade".
- **Story:** imagem ou vídeo 9:16, com notas (enquete, link, stickers).
- Legenda com contador de 2.200 caracteres, 30 hashtags e 20 menções, mais primeiro comentário, localização e até 3 colaboradores.
- Data e hora de publicação e status: Rascunho → Em aprovação → Aprovado → Agendado → Publicado.
- Prévia ao vivo num celular (feed, Reels ou Story) e o recorte na grade. Também dá para duplicar e excluir.

**Enviar link para cliente**
- Gera uma **versão congelada, somente leitura** (`/share/<token>`): o cliente abre no celular, sem login.
- Duas abas: **Feed** (perfil, stories e grade; toque abre o post) e **Pauta** (lista cronológica com mídia, data, legenda e 1º comentário, com botão de imprimir).
- Filtros por período, com ou sem rascunhos e publicados, e mensagem para o cliente. Botões para copiar e para enviar no WhatsApp.
- Histórico de links com contagem de visualizações e opção de desativar. Editar depois **não** altera um link já enviado.

**Cliente** (visão de entregas)
- Mostra o cliente selecionado no topo, com o responsável, o total de entregas, quantas já foram aprovadas e o botão "Enviar link para cliente".
- Um card por mês, com a quantidade de Feed, Reels e Story, miniaturas e o progresso de aprovação. A seta abre um menu suspenso com cada criativo do mês: formato, data, status, legenda, 1º comentário, local, colaboradores e o **roteiro**.
- Filtro por formato e navegação por semestre (jan–jun e jul–dez), alinhada à direita. As setas mostram quantos criativos há no semestre anterior e no seguinte, e "Semestre atual" volta para o período de hoje. O roteiro de cada criativo é editado no editor de post.

**Gestão**
- O seletor de cliente no topo vale só para **Feed** e **Agenda**. Kanban, Roadmap e Matriz mostram a agência inteira.
- **Agenda:** calendário mensal completo com posts (cor por formato) e tarefas. Arraste entre os dias para reagendar. O painel do dia permite criar post ou tarefa naquela data, e há uma lista de tarefas sem data.
- **Equipe:** colaboradores com função e cor. Cada cliente tem um responsável, e as tarefas do cliente vão para ele, a menos que a tarefa tenha outro responsável.
- **Kanban:** 6 colunas (Não iniciada → Em desenvolvimento → Ag. aprovação → Aguardando retorno → Externo → Concluída) e filtro por colaborador ("Agenda de Ana"), que mostra as tarefas da pessoa e a carteira de clientes dela.
- **Tarefa:** título, descrição, status, prioridade, prazo, cliente e responsável. O início é registrado automaticamente quando a tarefa entra em andamento, e a conclusão ao finalizar. Tarefas em andamento mostram há quantos dias estão abertas ("Deixar em andamento").
- **Matriz:** mesmo filtro, com adição rápida em cada bloco. A tarefa já nasce com a prioridade do bloco e o colaborador selecionado, e aparece no Kanban.
- **Roadmap:** todos os clientes numa timeline, com responsável, conteúdos programados (pontos por formato), quantos estão em aprovação, progresso das tarefas e meta.
- Captura de tarefas por linguagem natural, com Claude ou um parser local.

## Estrutura

```
prisma/schema.prisma       User, Member, Client, Post, MediaAsset, ShareLink, Task, Tag
prisma/seed.ts             dados de exemplo (artes geradas em SVG)
scripts/local-db.mjs       PostgreSQL local (PGlite)
src/app/page.tsx           workspace (RSC + streaming)
src/app/share/[token]/     página pública do cliente
src/app/api/media/         upload (POST), upload direto ao Blob (upload/, register/) e entrega com Range (GET)
src/app/login/             tela de senha da equipe
src/proxy.ts               protege o app com a senha (links de cliente ficam públicos)
src/app/api/ai/parse-task/ texto livre → tarefas
src/server/                server actions (conteúdo, compartilhamento, tarefas), validadas com Zod
src/lib/                   domínio, schemas, queries, storage
src/components/feed/       ig.tsx (mockups), feed-view, post-composer, share-dialog
src/components/share/      visualização do cliente
src/components/views/      agenda, kanban, roadmap, matriz
```

## Acesso da equipe (senha)

- O app inteiro exige a senha definida em `TEAM_PASSWORD`. A tela de entrada fica em `/login`, e o botão **Sair** no cabeçalho encerra a sessão.
- Ficam públicos apenas os **links de cliente** (`/share/...`) e as mídias que eles exibem.
- A sessão dura 30 dias. Trocar `TEAM_PASSWORD` desconecta todo mundo.
- Local: sem `TEAM_PASSWORD` no `.env`, o app fica aberto (só no seu computador). Em produção, sem a variável, ninguém entra.

## Publicar na Vercel (passo a passo)

Tudo usa apenas a sua conta da Vercel: app, banco (Neon, pela aba Storage) e mídias (Vercel Blob).

1. **Importar o projeto.** Em [vercel.com/new](https://vercel.com/new), escolha **Import Git Repository** e selecione `PMedia`. Framework: **Next.js** (detectado sozinho). Não clique em Deploy ainda.
2. **Variáveis de ambiente.** Antes do primeiro deploy, adicione em *Environment Variables*:
   - `TEAM_PASSWORD`: a senha da equipe (escolha uma forte).
   - `AUTH_SECRET`: um texto aleatório longo, de pelo menos 32 caracteres.
   - `NEXT_PUBLIC_DIRECT_UPLOAD` = `1`
3. **Deploy.** O primeiro deploy pode falhar por falta de banco; é esperado.
4. **Banco (Neon).** No projeto: **Storage → Create Database → Neon (Postgres)** → *Connect* ao projeto PMedia. A Vercel cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED` sozinha.
5. **Mídias (Blob).** **Storage → Create → Blob** → *Connect* ao projeto. A Vercel cria `BLOB_READ_WRITE_TOKEN`.
6. **Redeploy.** Em **Deployments**, abra o último e clique em **⋯ → Redeploy**. O script `vercel-build` cria as tabelas no Neon (`prisma db push`) e gera o build.
7. **Testar.** Abra `https://<seu-projeto>.vercel.app`, entre com a senha, cadastre um cliente e um post e gere um link de cliente.

**Dados de exemplo em produção (opcional).** No seu computador, com a [Vercel CLI](https://vercel.com/docs/cli):
```bash
vercel link
```
```bash
vercel env pull .env.production.local
```
```bash
npx tsx --env-file=.env.production.local prisma/seed.ts
```
⚠️ O seed **apaga** os dados existentes antes de recriar os exemplos. Use só no banco novo, antes de cadastrar clientes reais.

**Atualizações.** Cada `git push` na branch `main` gera um novo deploy automaticamente.

## Pendências conhecidas

- **Login individual:** hoje existe uma senha única para a equipe. O próximo passo é ter contas por colaborador (Auth.js ou Clerk), para cada pessoa ver a própria agenda ao entrar.
- **Publicação automática** no Instagram exige a API da Meta (Graph API, com revisão de app). Hoje o PMedia planeja e aprova; a publicação é manual.
