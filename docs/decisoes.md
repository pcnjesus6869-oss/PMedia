# Decisões do PMedia (e por quê)

Formato: decisão, motivo, consequência. Datas em 2026.

## Produto

- **Foco em social media de agência, não produtividade pessoal** (04/11). O usuário disse que o PLife inicial "não tinha nada a ver" e pediu o PMedia só para trabalho. Por isso não existem mais áreas Pessoal/Trabalho/Estudos, e "projeto" virou "cliente" (um perfil do Instagram).
- **A prévia do feed com link para o cliente é o centro do produto** (04/11). Hoje a agência envia a pauta em PDF; o usuário quer agregar valor a essa entrega. Melhorias nessa experiência têm prioridade sobre gestão de tarefas.
- **Link do cliente é uma cópia congelada (snapshot JSON) e não exige login** (04/11). O cliente vê exatamente o que foi enviado, e edições posteriores não mudam um link já mandado. Para mandar uma versão nova, gera-se outro link. Links têm contagem de visualizações e podem ser desativados (`revokedAt`).
- **"Pauta" do cliente em calendário mensal** (04/11). O usuário pediu uma visão macro do mês. Cor por formato: azul = Post, rosa = Reels, amarelo = Story. Conteúdos sem data vão para "Data a definir".
- **Agenda como calendário mensal completo, com arrastar para reagendar** (04/11). O usuário pediu um calendário inteiro "como o do PLife", e não uma lista vertical.
- **Seletor de cliente só em Feed, Agenda e Cliente; Kanban, Roadmap e Matriz mostram a agência inteira** (04/11). Pedido do usuário, porque essas visões servem para ter uma visão geral.
- **Colaboradores (Member) com responsável por cliente** (04/11). Cada social media atende sua carteira. A tarefa vai para o responsável do cliente, a menos que tenha outro responsável definido (ex.: a designer que produz para vários clientes).
- **Tarefa com só 7 campos e 6 status** (04/11): título, descrição, status, prioridade, prazo, cliente e responsável. "Concluída" foi para o fim da ordem (o usuário a listou no meio) para o fluxo ficar natural da esquerda para a direita. Os status antigos Backlog/A fazer foram migrados para "Não iniciada".
- **Data de início automática** (04/11). O usuário disse que a tarefa nem sempre começa no dia em que é criada e pode continuar nos dias seguintes. Por isso `startDate` é gravada quando a tarefa entra em andamento, e `completedAt` ao concluir. O botão "Deixar em andamento" salva na hora.
- **A Matriz é a de Eisenhower, não SWOT** (04/11). O usuário falou em "SWOT"; foi mantida a de Eisenhower (prioridade = quadrante) e isso foi explicado a ele. Cada bloco tem adição rápida, já com a prioridade do bloco e o colaborador do filtro.
- **Página Cliente com cards por mês e navegação por semestre fixo** (jan–jun / jul–dez) (04/11). O usuário não quer rolar a tela até embaixo no fim do ano. As setas mostram quantos criativos há no semestre vizinho.
- **Campo "Roteiro" no Post** (04/11). Não existia, e a página Cliente pedia "entregas e roteiros".
- **Na página Cliente o formato Post se chama "Feed"**, como o usuário escreveu; no resto do app continua "Post".

## Técnica

- **PGlite em vez de Postgres instalado** (04/11). A máquina não tem PostgreSQL nem Docker, e o `embedded-postgres` falhou por falta de uma DLL do Windows. O PGlite é Postgres em WebAssembly, sem instalação; o código continua Postgres padrão, e basta trocar `DATABASE_URL`.
- **Script próprio `scripts/local-db.mjs`** (04/11). No Windows, o `--run` do `pglite-server` não encontra o `npm` (processo sem shell). O script sobe o banco e roda o comando com `shell: true`. Se a porta 5433 já estiver em uso, só roda o comando. Aceita até 10 conexões, para usar o Prisma Studio junto com o app.
- **Prisma 6, não a versão mais nova** (04/11). A versão mais recente era só candidata a lançamento.
- **`prisma db push` em vez de migrations** (04/11 e 05/11). É mais simples para um projeto pequeno. Mudanças de enum foram feitas em etapas manuais (adicionar os valores novos, mover os dados e remover os antigos). Para alterações destrutivas no futuro, considerar adotar migrations (a confirmar).
- **Claude com fallback de servidor e parser heurístico local** (04/11). Não havia `ANTHROPIC_API_KEY`, então `src/lib/ai/heuristic.ts` interpreta português (datas, subtarefas, contas = importante). Com a chave, usa o Claude com `fallbacks: "default"`. O caminho do Claude não foi testado com chave real.
- **Server actions + Zod + filtro por `userId` desde o início.** Facilita trocar a autenticação depois sem reescrever as queries.
- **Senha única da equipe em vez de login completo** (05/11). O usuário pediu "uma senha de acesso simples" antes de publicar. A implementação usa um cookie HMAC (Web Crypto, para rodar no proxy) válido por 30 dias, em que a senha entra na assinatura, de modo que trocar `TEAM_PASSWORD` derruba todas as sessões. Há uma checagem dupla: `src/proxy.ts` e `getCurrentUser()` em cada action e API. Sem senha em dev, o app fica aberto; em produção, fica fechado.
- **Deploy só com a conta pessoal da Vercel: Neon + Vercel Blob** (05/11). O usuário não quer usar a conta Supabase conectada ao Claude, que é profissional. A Vercel não tem disco persistente, então as mídias vão para o Blob, e o upload é direto do navegador por causa do limite de cerca de 4,5 MB por requisição. As URLs ficam estáveis em `/api/media/<id>`.
- **`turbopackIgnore` nos caminhos de upload** (04/11). Sem isso, o build rastreava o projeto inteiro (aviso do Turbopack).
- **`.gitignore` ignora `.env*`, exceto `.env.example`** (05/11). Nenhum segredo, banco local ou mídia vai para o GitHub.
