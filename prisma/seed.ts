import { mkdir } from "node:fs/promises";
import { type PostStatus, type PostType, type Priority, type TaskStatus } from "@prisma/client";
import { addDays, setHours, startOfDay } from "date-fns";
import { art, db, SIZE, UPLOAD_DIR } from "./seed-lib";
import { seedExtraMonths } from "./seed-months";


async function main() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const user = await db.user.upsert({
    where: { email: "local@pmedia.dev" },
    update: {},
    create: { email: "local@pmedia.dev", name: "Você" },
  });

  // `tsx prisma/seed.ts --team-only` → só cria a equipe sobre os dados atuais (não apaga nada)
  if (process.argv.includes("--team-only")) {
    await ensureTeam(user.id);
    return;
  }
  // `tsx prisma/seed.ts --extra-months` → só adiciona os próximos 3 meses (não apaga nada)
  if (process.argv.includes("--extra-months")) {
    await seedExtraMonths(user.id);
    return;
  }

  await db.shareLink.deleteMany({ where: { client: { userId: user.id } } });
  await db.member.deleteMany({ where: { userId: user.id } });
  await db.task.deleteMany({ where: { userId: user.id } });
  await db.post.deleteMany({ where: { client: { userId: user.id } } });
  await db.mediaAsset.deleteMany({ where: { postId: null } });
  await db.client.deleteMany({ where: { userId: user.id } });

  const today = startOfDay(new Date());
  const at = (days: number, hour = 9) => setHours(addDays(today, days), hour);

  const mkAvatar = async (from: string, to: string, letter: string) => {
    const media = await art({ w: 320, h: 320, from, to, title: letter });
    await db.mediaAsset.create({ data: media });
    return media.url;
  };

  const cafe = await db.client.create({
    data: {
      userId: user.id,
      name: "Café Aurora",
      handle: "cafeaurora",
      bio: "☕ Cafés especiais & confeitaria artesanal\n📍 Vila Madalena · SP\nAberto todos os dias, 7h–20h",
      website: "cafeaurora.com.br",
      color: "#b45309",
      targetDate: at(40),
      avatarUrl: await mkAvatar("#78350f", "#d97706", "A"),
    },
  });
  const studio = await db.client.create({
    data: {
      userId: user.id,
      name: "Studio Move",
      handle: "studiomove.fit",
      bio: "Pilates · Funcional · Yoga\nPrimeira aula grátis 💪",
      color: "#0d9488",
      targetDate: at(25),
      avatarUrl: await mkAvatar("#115e59", "#2dd4bf", "M"),
    },
  });
  const verde = await db.client.create({
    data: {
      userId: user.id,
      name: "Verde Arquitetura",
      handle: "verde.arq",
      bio: "Arquitetura & interiores sustentáveis 🌿",
      color: "#4d7c0f",
      targetDate: at(60),
      avatarUrl: await mkAvatar("#365314", "#84cc16", "V"),
    },
  });

  type Seed = {
    client: string;
    type: PostType;
    status: PostStatus;
    day: number | null;
    hour?: number;
    aspect?: keyof typeof SIZE;
    slides: { title: string; sub?: string; from: string; to: string; dark?: boolean }[];
    caption: string;
    firstComment?: string;
    location?: string;
    pinned?: boolean;
    script?: string;
  };

  const C = {
    espresso: ["#3f2a1d", "#8b5e3c"],
    cream: ["#fef3c7", "#fde68a"],
    berry: ["#831843", "#db2777"],
    sage: ["#3f6212", "#a3e635"],
    sky: ["#0c4a6e", "#38bdf8"],
    night: ["#1e1b4b", "#6366f1"],
    teal: ["#134e4a", "#14b8a6"],
    orange: ["#7c2d12", "#fb923c"],
  } as const;
  const s = (title: string, c: readonly [string, string], sub?: string, dark?: boolean) => ({ title, sub, from: c[0], to: c[1], dark });

  const seeds: Seed[] = [
    // Café Aurora: planejamento do mês (topo da grade = mais recente)
    { client: cafe.id, type: "POST", status: "IN_REVIEW", day: 12, hour: 11, slides: [s("Black\nFriday", C.night, "30% off em grãos")], caption: "Chegou a nossa Black Friday! ☕🖤\n\n30% de desconto em todos os grãos especiais, só neste fim de semana. Corre que o estoque é limitado!\n\n#blackfriday #cafeespecial #vilamadalena #cafeaurora", firstComment: "Válido de 28/11 a 30/11 na loja física e no site 🛒", location: "Café Aurora" },
    { client: cafe.id, type: "REEL", status: "APPROVED", day: 10, hour: 18, aspect: "9:16", slides: [s("Como fazer\nseu V60", C.espresso, "passo a passo")], script: "Cena 1 (0–3s): close no café coando\nCena 2: moagem e 15 g de café\nCena 3: 250 ml em espiral\nCTA: Salva pra fazer em casa", caption: "Seu café coado nunca mais vai ser o mesmo 👀\nSalva esse vídeo pra fazer em casa!\n\n#v60 #metodosfiltrados #baristaemcasa #cafeespecial" },
    { client: cafe.id, type: "POST", status: "APPROVED", day: 8, hour: 12, slides: [s("Novo\nmenu", C.cream, "outono · inverno", true), s("Mocha\nde avelã", C.espresso, "R$ 18"), s("Chai\nlatte", C.orange, "R$ 16"), s("Torta de\nmaçã", C.berry, "R$ 14")], caption: "Menu novo na área! 🍂 Arrasta pro lado e conta pra gente qual você quer provar primeiro 👉\n\n#cardapionovo #cafeteria #saopaulo", location: "Vila Madalena, São Paulo" },
    { client: cafe.id, type: "POST", status: "SCHEDULED", day: 6, hour: 9, aspect: "1:1", slides: [s("Bom dia\ncom café", C.cream, "", true)], caption: "Quem mais só funciona depois do primeiro café? ☀️☕ Marca aquele amigo!\n\n#bomdia #cafe #segundafeira" },
    { client: cafe.id, type: "POST", status: "SCHEDULED", day: 3, hour: 19, slides: [s("Conheça\nnossa torra", C.espresso, "bastidores")], caption: "Por trás de cada xícara existe um processo cuidadoso. Hoje mostramos como torramos nossos grãos 🔥\n\n#bastidores #torradecafe #cafeespecial" },
    { client: cafe.id, type: "REEL", status: "PUBLISHED", day: -2, hour: 18, aspect: "9:16", slides: [s("Latte\nart", C.berry, "desafio")], caption: "Desafio de latte art com a equipe 😂 quem ganhou?\n\n#latteart #barista" },
    { client: cafe.id, type: "POST", status: "PUBLISHED", day: -5, hour: 12, slides: [s("Promo\nda semana", C.sage, "pão de queijo + café")], caption: "Combo da semana: pão de queijo + café coado por R$ 12 💛" , pinned: true },
    { client: cafe.id, type: "POST", status: "PUBLISHED", day: -9, hour: 10, slides: [s("4 anos\nde Aurora", C.orange, "obrigado!")], caption: "Hoje completamos 4 anos! Obrigado a cada cliente que fez parte dessa história 🎉", pinned: true },
    { client: cafe.id, type: "POST", status: "PUBLISHED", day: -14, hour: 9, aspect: "1:1", slides: [s("Grãos do\nCerrado", C.sky, "nova origem")], caption: "Nova origem disponível: Cerrado Mineiro, notas de chocolate e caramelo." },
    { client: cafe.id, type: "STORY", status: "APPROVED", day: 3, hour: 8, aspect: "9:16", slides: [s("Enquete:\nquente ou\ngelado?", C.sky)], caption: "Enquete: café quente 🔥 ou gelado 🧊?" },
    { client: cafe.id, type: "STORY", status: "APPROVED", day: 3, hour: 12, aspect: "9:16", slides: [s("Bastidores\nda torra", C.espresso)], caption: "Link para o post de bastidores" },
    { client: cafe.id, type: "STORY", status: "IN_REVIEW", day: 12, hour: 10, aspect: "9:16", slides: [s("Contagem\nregressiva", C.night, "black friday")], caption: "Sticker de contagem regressiva para a Black Friday" },
    { client: cafe.id, type: "POST", status: "DRAFT", day: null, slides: [s("Ideia:\nreceita de\nNatal", C.berry)], caption: "Rascunho — receita de panetone com café (aguardando fotos do cliente)" },

    // Studio Move
    { client: studio.id, type: "REEL", status: "IN_REVIEW", day: 4, hour: 7, aspect: "9:16", slides: [s("5 min de\nmobilidade", C.teal, "rotina matinal")], script: "Cena 1: alongamento na cama\nCenas 2–5: 4 exercícios (40s)\nCTA: primeira aula grátis", caption: "Rotina de 5 minutos para começar o dia sem dor nas costas 🧘\n\n#mobilidade #pilates #saude" },
    { client: studio.id, type: "POST", status: "SCHEDULED", day: 2, hour: 12, slides: [s("Aula\nexperimental", C.teal, "grátis")], caption: "Sua primeira aula é por nossa conta! Agende pelo link da bio 💪" },
    { client: studio.id, type: "POST", status: "PUBLISHED", day: -3, hour: 12, slides: [s("Pilates x\nFuncional", C.sky, "qual escolher?")], caption: "Pilates ou funcional? Explicamos as diferenças ⬇️" },

    // Verde Arquitetura
    { client: verde.id, type: "POST", status: "APPROVED", day: 5, hour: 18, slides: [s("Casa\nJardim", C.sage, "projeto"), s("Sala\nintegrada", C.sage), s("Varanda\nverde", C.sage)], caption: "Projeto Casa Jardim: integração total com a natureza 🌿\n\n#arquitetura #interiores #sustentabilidade", location: "Granja Viana" },
  ];

  for (const [i, sd] of seeds.entries()) {
    const aspect = sd.aspect ?? "4:5";
    const [w, h] = SIZE[aspect];
    const media = [];
    for (const sl of sd.slides) media.push(await art({ w, h, ...sl }));
    await db.post.create({
      data: {
        clientId: sd.client,
        type: sd.type,
        status: sd.status,
        caption: sd.caption,
        script: sd.script,
        firstComment: sd.firstComment,
        location: sd.location,
        aspectRatio: aspect,
        pinned: sd.pinned ?? false,
        scheduledAt: sd.day === null ? null : at(sd.day, sd.hour ?? 12),
        feedPosition: i,
        media: { create: media.map((m, order) => ({ ...m, order })) },
      },
    });
  }

  const tasks: { title: string; status: TaskStatus; priority: Priority; start?: number; due?: number; hour?: number; min?: number; client: string; subtasks?: string[] }[] = [
    { title: "Aprovar pauta de novembro com o cliente", status: "IN_PROGRESS", priority: "URGENT", start: -2, due: 1, hour: 14, min: 60, client: cafe.id, subtasks: ["Montar prévia do feed", "Enviar link para aprovação", "Ajustar feedbacks"] },
    { title: "Gravar reels de V60 na loja", status: "NOT_STARTED", priority: "URGENT", due: 0, hour: 15, min: 120, client: cafe.id },
    { title: "Relatório mensal de métricas", status: "NOT_STARTED", priority: "HIGH", start: 3, due: 8, min: 180, client: cafe.id },
    { title: "Responder DMs e comentários", status: "AWAITING_RETURN", priority: "MEDIUM", due: 0, hour: 17, min: 30, client: studio.id },
    { title: "Briefing do lançamento de turma nova", status: "NOT_STARTED", priority: "HIGH", due: 10, client: studio.id },
    { title: "Sessão de fotos do projeto Casa Jardim", status: "EXTERNAL", priority: "HIGH", start: 1, due: 4, min: 240, client: verde.id },
    { title: "Pesquisa de hashtags do nicho", status: "DONE", priority: "LOW", due: -1, client: verde.id },
    { title: "Planejar calendário de dezembro", status: "NOT_STARTED", priority: "HIGH", start: 7, due: 20, min: 240, client: cafe.id },
  ];
  for (const [i, t] of tasks.entries()) {
    await db.task.create({
      data: {
        title: t.title,
        status: t.status,
        priority: t.priority,
        // início só existe se a tarefa já saiu de "Não iniciada"
        startDate: t.status !== "NOT_STARTED" && t.start !== undefined ? at(t.start) : null,
        completedAt: t.status === "DONE" ? at(t.due ?? 0) : null,
        dueDate: t.due !== undefined ? at(t.due, t.hour ?? 18) : null,
        estimatedMinutes: t.min ?? null,
        clientId: t.client,
        userId: user.id,
        position: i,
        subtasks: t.subtasks
          ? { create: t.subtasks.map((title, j) => ({ title, userId: user.id, clientId: t.client, priority: t.priority, position: j, status: j === 0 ? "DONE" : "NOT_STARTED" })) }
          : undefined,
      },
    });
  }

  await ensureTeam(user.id);
  await seedExtraMonths(user.id);
  console.log(`Seed concluído: 3 clientes, ${seeds.length} posts, ${tasks.length} tarefas, equipe de 3.`);
}

/** Equipe de exemplo: cada social media atende seus clientes; a designer pega tarefas de produção. */
async function ensureTeam(userId: string) {
  if (await db.member.count({ where: { userId } })) return console.log("Equipe já existe — nada a fazer.");
  const [ana, bruno, carla] = await Promise.all([
    db.member.create({ data: { userId, name: "Ana Souza", role: "Social Media", color: "#db2777" } }),
    db.member.create({ data: { userId, name: "Bruno Lima", role: "Social Media", color: "#0891b2" } }),
    db.member.create({ data: { userId, name: "Carla Mendes", role: "Designer & Audiovisual", color: "#7c3aed" } }),
  ]);
  const owners: [string, string][] = [["Café Aurora", ana.id], ["Verde Arquitetura", ana.id], ["Studio Move", bruno.id]];
  for (const [name, ownerId] of owners) await db.client.updateMany({ where: { userId, name }, data: { ownerId } });
  // tarefas de produção ficam com a designer, independentemente do cliente
  await db.task.updateMany({
    where: { userId, OR: [{ title: { startsWith: "Gravar" } }, { title: { startsWith: "Sessão de fotos" } }, { title: { contains: "Montar prévia" } }] },
    data: { assigneeId: carla.id },
  });
  console.log("Equipe criada: Ana (Café Aurora, Verde), Bruno (Studio Move), Carla (produção).");
}

main().finally(() => db.$disconnect());
