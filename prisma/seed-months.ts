/**
 * Dados fictícios dos próximos 3 meses (a partir do mês seguinte ao atual — ex.: dez/jan/fev).
 * Idempotente: pula cliente+mês que já tenha conteúdo. Não apaga nada.
 *
 *   npx tsx prisma/seed.ts --extra-months
 */
import type { PostStatus, PostType, Priority } from "@prisma/client";
import { addMonths, format, setDate, setHours, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { art, db, SIZE } from "./seed-lib";

type Palette = readonly [string, string];
const P = {
  espresso: ["#3f2a1d", "#8b5e3c"],
  cream: ["#fef3c7", "#fde68a"],
  berry: ["#831843", "#db2777"],
  xmas: ["#14532d", "#b91c1c"],
  gold: ["#422006", "#ca8a04"],
  sky: ["#0c4a6e", "#38bdf8"],
  sun: ["#9a3412", "#facc15"],
  night: ["#1e1b4b", "#6366f1"],
  teal: ["#134e4a", "#14b8a6"],
  sage: ["#3f6212", "#a3e635"],
  carnival: ["#701a75", "#f59e0b"],
  stone: ["#292524", "#a8a29e"],
} as const satisfies Record<string, Palette>;

type Item = {
  day: number;
  hour: number;
  type: PostType;
  art: string;
  sub?: string;
  palette: Palette;
  dark?: boolean;
  slides?: { art: string; sub?: string; palette: Palette; dark?: boolean }[];
  caption: string;
  script?: string;
  firstComment?: string;
  location?: string;
};

/** Pauta por cliente: [mês+1, mês+2, mês+3] */
const PLAN: Record<string, [Item[], Item[], Item[]]> = {
  "Café Aurora": [
    [
      { day: 1, hour: 9, type: "POST", art: "Dezembro\nna Aurora", sub: "agenda do mês", palette: P.xmas, caption: "Dezembro chegou e com ele nosso cardápio de festas 🎄 Arrasta pra ver o que vem por aí 👉\n\n#natal #cafeespecial #vilamadalena", slides: [{ art: "Panetone\nde café", sub: "R$ 59", palette: P.gold }, { art: "Chocolate\nquente", sub: "R$ 19", palette: P.espresso }, { art: "Kit\npresente", sub: "a partir de R$ 89", palette: P.xmas }], script: "Carrossel 4 slides: capa + 3 produtos de Natal (foto + preço)\nPaleta verde/vermelho, tipografia serifada" },
      { day: 4, hour: 18, type: "REEL", art: "Panetone\nde café", sub: "receita", palette: P.gold, caption: "O panetone mais pedido da casa: recheado com ganache de café ☕🎄 Encomendas pelo link da bio!\n\n#panetone #natal #receita", script: "Cena 1 (0–3s): corte do panetone em câmera lenta — texto \"o panetone que esgota todo ano\"\nCena 2: ganache de café sendo despejada\nCena 3: embalagem para presente\nCTA: \"Encomende até 20/12 — link na bio\"" },
      { day: 6, hour: 10, type: "STORY", art: "Enquete:\npanetone ou\nchocotone?", palette: P.xmas, caption: "Enquete de engajamento", script: "Sticker de enquete: Panetone 🍞 x Chocotone 🍫\nFundo: foto da vitrine de Natal" },
      { day: 10, hour: 12, type: "POST", art: "Kit\npresente", sub: "amigo secreto", palette: P.berry, caption: "Amigo secreto resolvido 🎁 Kits com café especial, caneca e cookies a partir de R$ 89.\n\n#amigosecreto #presente #cafe", firstComment: "Retirada na loja ou entrega via app 🛵" },
      { day: 15, hour: 19, type: "STORY", art: "Contagem\nregressiva", sub: "encomendas", palette: P.gold, caption: "Contagem para fim das encomendas", script: "Sticker contagem regressiva: \"Últimos dias de encomenda\" (20/12 18h)\nLink para o formulário" },
      { day: 18, hour: 18, type: "REEL", art: "Bastidores\ndo Natal", palette: P.espresso, caption: "Bastidores da produção de Natal: 600 panetones feitos à mão 🙌", script: "Cena 1: forno abrindo, vapor\nCena 2: equipe embalando em ritmo acelerado (timelapse)\nCena 3: depoimento rápido da confeiteira (5s)\nTexto: \"600 panetones, 1 equipe apaixonada\"" },
      { day: 24, hour: 10, type: "POST", art: "Feliz\nNatal", sub: "equipe aurora", palette: P.xmas, caption: "Feliz Natal! Obrigado por fazer parte do nosso ano ❤️ Hoje abrimos até as 14h.", location: "Café Aurora" },
      { day: 30, hour: 11, type: "POST", art: "Retrospectiva\n2026", palette: P.night, caption: "Nosso 2026 em números ☕ 48 mil cafés servidos, 3 novas origens e muito carinho. Obrigado!\n\n#retrospectiva #2026", slides: [{ art: "48 mil\ncafés", palette: P.espresso }, { art: "3 novas\norigens", palette: P.sky }, { art: "Obrigado!", palette: P.night }], script: "Carrossel retrospectiva: capa + 3 números do ano + agradecimento" },
    ],
    [
      { day: 2, hour: 9, type: "POST", art: "Feliz\nAno Novo", palette: P.gold, caption: "2027 começou e a gente já está com saudade de te ver por aqui ✨ Voltamos ao horário normal amanhã!" },
      { day: 7, hour: 18, type: "REEL", art: "Cold brew\nde verão", sub: "receita", palette: P.sky, caption: "Calor pede cold brew 🧊 Receita simples pra fazer em casa!\n\n#coldbrew #verao #receita", script: "Cena 1: copo suando, gelo caindo (slow)\nCena 2: café moído grosso + água fria em jarra\nCena 3: 12h depois — filtragem\nCTA: \"Ou venha provar o nosso 😉\"" },
      { day: 12, hour: 12, type: "POST", art: "Menu\nde verão", sub: "novidades", palette: P.sun, caption: "Menu de verão no ar ☀️ Tônica de café, affogato e o novo frappé de caramelo.", slides: [{ art: "Tônica\nde café", palette: P.sky }, { art: "Affogato", palette: P.cream, dark: true }, { art: "Frappé\ncaramelo", palette: P.gold }] },
      { day: 14, hour: 10, type: "STORY", art: "Qual drink\nde verão?", palette: P.sun, caption: "Quiz do menu de verão", script: "Sticker de quiz com 3 opções do menu de verão" },
      { day: 20, hour: 19, type: "POST", art: "Metas\n2027", sub: "café & você", palette: P.night, caption: "Uma das nossas metas para 2027: mais workshops de barista! Quer participar? Comenta 👇" },
      { day: 26, hour: 18, type: "REEL", art: "Um dia\nna Aurora", palette: P.espresso, caption: "Um dia na Aurora, das 7h às 20h ☕", script: "Timelapse: abertura 7h → movimento do almoço → pôr do sol na vitrine → fechamento\nTrilha animada, cortes rápidos" },
    ],
    [
      { day: 3, hour: 12, type: "POST", art: "Workshop\nde barista", sub: "inscrições", palette: P.espresso, caption: "Inscrições abertas para o workshop de barista de fevereiro! Vagas limitadas ☕\n\n#barista #workshop", firstComment: "Link de inscrição na bio 🔗" },
      { day: 9, hour: 18, type: "REEL", art: "Latte art\nnível 1", sub: "tutorial", palette: P.berry, caption: "Tutorial de latte art para iniciantes: o coração ❤️", script: "Cena 1: leite vaporizado (textura)\nCena 2: altura e fluxo do despejo\nCena 3: o coração se formando (close)\nTexto: \"Tenta e marca a gente!\"" },
      { day: 13, hour: 10, type: "STORY", art: "Carnaval\nna Aurora", palette: P.carnival, caption: "Horário especial de Carnaval", script: "Story com horários de Carnaval (sáb–ter)\nSticker de localização" },
      { day: 14, hour: 12, type: "POST", art: "Bloquinho\ndo café", sub: "carnaval", palette: P.carnival, caption: "Bloquinho do café confirmado 🎉 Cold brew em dobro no sábado de Carnaval!" },
      { day: 24, hour: 19, type: "POST", art: "Nova origem:\nEtiópia", palette: P.sage, caption: "Chegou a Etiópia Yirgacheffe: floral, cítrica e delicada 🌸" },
    ],
  ],
  "Studio Move": [
    [
      { day: 3, hour: 7, type: "REEL", art: "Treino de\n15 minutos", sub: "fim de ano", palette: P.teal, caption: "Sem tempo no fim de ano? Treino completo de 15 min 💪", script: "Cena 1: relógio marcando 15:00\nCenas 2–6: 5 exercícios (3 min cada) com timer na tela\nCTA: \"Salva e faz amanhã cedo\"" },
      { day: 9, hour: 12, type: "POST", art: "Plano\nanual", sub: "black december", palette: P.night, caption: "Plano anual com 30% OFF até 31/12 🔥" },
      { day: 16, hour: 18, type: "STORY", art: "Depoimento\nda aluna", palette: P.teal, caption: "Depoimento em vídeo", script: "Vídeo vertical 30s da aluna Marina contando sua evolução\nLegenda automática" },
      { day: 22, hour: 10, type: "POST", art: "Boas\nfestas", palette: P.xmas, caption: "Boas festas da família Studio Move 🎄 Recesso de 24/12 a 01/01." },
    ],
    [
      { day: 5, hour: 7, type: "POST", art: "Metas\n2027", sub: "desafio 30 dias", palette: P.sun, caption: "Desafio 30 dias de movimento começa segunda! Bora? 🙋" },
      { day: 12, hour: 7, type: "REEL", art: "Mobilidade\nde quadril", palette: P.teal, caption: "3 exercícios para destravar o quadril 🦵", script: "Cenas curtas de 3 exercícios, com setas indicando o movimento\nTexto final: \"Faça 2x por dia\"" },
      { day: 26, hour: 12, type: "STORY", art: "Check-in\ndo desafio", palette: P.sun, caption: "Caixinha de perguntas do desafio", script: "Caixinha: \"Como está o seu desafio?\"" },
    ],
    [
      { day: 2, hour: 7, type: "POST", art: "Pilates no\nCarnaval?", sub: "sim!", palette: P.carnival, caption: "Carnaval com aula especial de alongamento na segunda 🎉" },
      { day: 18, hour: 18, type: "REEL", art: "Antes e\ndepois", sub: "desafio 30 dias", palette: P.teal, caption: "Resultados do desafio 30 dias 👏", script: "Montagem antes/depois de 4 alunos (com autorização)\nTrilha motivacional" },
    ],
  ],
  "Verde Arquitetura": [
    [
      { day: 5, hour: 18, type: "POST", art: "Casa\nJardim", sub: "entrega", palette: P.sage, caption: "Entrega da Casa Jardim: 2 anos de projeto e obra 🌿", slides: [{ art: "Fachada", palette: P.stone }, { art: "Living", palette: P.sage }, { art: "Jardim\ninterno", palette: P.teal }], location: "Granja Viana" },
      { day: 15, hour: 12, type: "REEL", art: "Tour\nCasa Jardim", palette: P.stone, caption: "Tour pela Casa Jardim em 30 segundos 🏡", script: "Plano-sequência com gimbal: entrada → living → jardim interno → varanda\nTexto com os materiais usados" },
    ],
    [
      { day: 14, hour: 18, type: "POST", art: "Tendências\n2027", sub: "interiores", palette: P.stone, caption: "5 tendências de interiores sustentáveis para 2027 ♻️", slides: [{ art: "Madeira\ncertificada", palette: P.sage }, { art: "Luz\nnatural", palette: P.sun }, { art: "Biofilia", palette: P.teal }] },
    ],
    [
      { day: 10, hour: 18, type: "REEL", art: "Antes e\ndepois", sub: "reforma", palette: P.stone, caption: "Reforma de apartamento de 60 m² — antes e depois ✨", script: "Transições antes/depois em 4 ambientes, sincronizadas com a batida" },
      { day: 20, hour: 12, type: "POST", art: "Projeto\nnovo", sub: "em breve", palette: P.sage, caption: "Vem aí: nosso primeiro projeto comercial. Palpites? 👀" },
    ],
  ],
};

const STATUS_BY_MONTH: PostStatus[][] = [
  ["SCHEDULED", "APPROVED", "APPROVED", "IN_REVIEW"], // mês seguinte: quase tudo aprovado
  ["IN_REVIEW", "APPROVED", "IN_REVIEW", "DRAFT"], // +2: em aprovação
  ["DRAFT", "DRAFT", "IN_REVIEW"], // +3: rascunhos
];

export async function seedExtraMonths(userId: string) {
  const clients = await db.client.findMany({ where: { userId } });
  const carla = await db.member.findFirst({ where: { userId, name: { startsWith: "Carla" } } });
  const base = startOfMonth(new Date());
  let created = 0;
  let tasks = 0;

  for (const client of clients) {
    const plan = PLAN[client.name];
    if (!plan) continue;

    for (let m = 0; m < 3; m++) {
      const month = addMonths(base, m + 1);
      const next = addMonths(month, 1);
      const existing = await db.post.count({ where: { clientId: client.id, scheduledAt: { gte: month, lt: next } } });
      if (existing >= 2) continue; // já planejado

      for (const [i, item] of plan[m].entries()) {
        const aspect = item.type === "POST" ? "4:5" : "9:16";
        const [w, h] = SIZE[aspect];
        const slides = [{ art: item.art, sub: item.sub, palette: item.palette, dark: item.dark }, ...(item.slides ?? [])];
        const media = [];
        for (const s of slides) media.push(await art({ w, h, from: s.palette[0], to: s.palette[1], title: s.art, sub: s.sub, dark: s.dark }));

        const when = setHours(setDate(month, item.day), item.hour);
        const statuses = STATUS_BY_MONTH[m];
        await db.post.create({
          data: {
            clientId: client.id,
            type: item.type,
            status: statuses[i % statuses.length],
            caption: item.caption,
            script: item.script ?? null,
            firstComment: item.firstComment ?? null,
            location: item.location ?? null,
            aspectRatio: aspect,
            scheduledAt: when,
            // datas mais distantes ficam no topo da grade, como no Instagram
            feedPosition: -Math.round(when.getTime() / 3_600_000),
            media: { create: media.map((md, order) => ({ ...md, order })) },
          },
        });
        created++;
      }

      // tarefas de produção do mês, com prazo antes do mês começar
      const label = format(month, "MMMM", { locale: ptBR });
      const prod: { title: string; due: Date; priority: Priority; assigneeId: string | null }[] = [
        { title: `Aprovar pauta de ${label} — ${client.name}`, due: subDays(month, 10), priority: m === 0 ? "URGENT" : "HIGH", assigneeId: null },
        { title: `Produzir artes de ${label} — ${client.name}`, due: subDays(month, 5), priority: "HIGH", assigneeId: carla?.id ?? null },
      ];
      if (plan[m].some((it) => it.type === "REEL")) {
        prod.push({ title: `Gravar Reels de ${label} — ${client.name}`, due: subDays(month, 3), priority: "MEDIUM", assigneeId: carla?.id ?? null });
      }
      for (const [j, t] of prod.entries()) {
        await db.task.create({
          data: {
            title: t.title,
            status: "NOT_STARTED",
            priority: t.priority,
            dueDate: setHours(t.due, 18),
            clientId: client.id,
            assigneeId: t.assigneeId,
            userId,
            position: 100 + m * 10 + j,
          },
        });
        tasks++;
      }
    }
  }
  console.log(`Meses extras: ${created} criativos e ${tasks} tarefas criados.`);
}
