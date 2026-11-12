# Histórico do PMedia

## 2026-11-04

- **03:31** O projeto começa como **PLife**, um gerenciador de tarefas (Agenda, Kanban, Roadmap, Matriz de Eisenhower e captura por IA), feito a partir de uma especificação do usuário. Next.js 16, Prisma 6 e PGlite, porque a máquina não tem Postgres nem Docker e o `embedded-postgres` falhou.
- **04:02** O usuário aceita seguir sem autenticação e pede para ser lembrado disso depois. São criados `scripts/local-db.mjs` e os comandos `npm run setup` e `npm run local`.
- **04:12** Mudança de rumo: o projeto vira o **PMedia**, para social media e só para trabalho. As visões passam para o cabeçalho e entram a prévia do feed, o editor de Post, Reels e Story, e o link "Enviar link para cliente" (cópia congelada). O motivo é substituir a pauta enviada em PDF. O schema ganha Client, Post, MediaAsset e ShareLink.
- **05:09** A aba **Pauta** do link do cliente vira um calendário mensal.
- **05:18** A Agenda vira um calendário mensal completo. Entram os colaboradores (Member) e o filtro por pessoa no Kanban. O Roadmap e a Matriz passam a ser visão geral. O seletor de cliente fica só no Feed e na Agenda.
- **05:41** A janela de tarefa fica com 7 campos e 6 status novos, com migração dos dados. A data de início e a de conclusão passam a ser automáticas, a Matriz ganha adição rápida em cada bloco e as janelas ganham um visual novo.
- **06:00** Nova aba **Cliente**, com cards por mês e menu suspenso por criativo. O Post ganha o campo **Roteiro**.
- **06:26** Dados fictícios de dezembro a fevereiro (33 criativos e 26 tarefas, em `seed-months.ts`) e navegação por semestre na página Cliente. São sugeridas quatro funcionalidades: aprovação no link, pacote contratado, relatório mensal e checklist de materiais.

## 2026-11-05

- **06:42–06:50** Fica esclarecido que a pasta `plife` é o PMedia e que o PLife original não foi guardado (não havia Git). A reconstrução do PLife foi oferecida, mas não foi feita (a confirmar se o usuário ainda quer). O usuário proíbe o uso da conta Supabase conectada, por ser profissional, e o caminho escolhido é só a Vercel, com Neon e Blob.
- **06:50–07:00** Senha única da equipe (`/login`, `proxy.ts`, cookie HMAC), armazenamento no Vercel Blob com upload direto, Prisma configurado para o Neon (`directUrl`), passo a passo da Vercel no README e **push para o GitHub** (`pcnjesus6869-oss/PMedia`, 79 arquivos, sem `.env`). O usuário pediu para **não publicar na Vercel** sem a autorização dele.

## 2026-11-07

- O app é aberto localmente com login pela senha de teste do `.env`. O resto da sessão tratou de outro projeto (site da Criare Colchões), sem relação com o PMedia.

## 2026-11-08

- O projeto é copiado para a pasta permanente `D:\Projetos-Claude\PMedia`, sem `node_modules`, e esta documentação é criada (CLAUDE.md e docs/).

## 2026-11-12

- A pasta permanente aparece **vinculada a um projeto da Vercel** chamado `pmedia` (pasta `.vercel/` e arquivo `.env.local` com as variáveis da Vercel, criados hoje às 09:34). Ambos são ignorados pelo Git e não vão para o repositório. Ainda não se sabe se o deploy foi feito (a confirmar com o usuário).
- `CLAUDE.md` e `docs/`, criados em 08/11, são enviados ao GitHub, a pedido do usuário. Não houve mudança de código desde o push de 05/11.
