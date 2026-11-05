/**
 * Parser heurístico (pt-BR) usado quando não há ANTHROPIC_API_KEY ou a IA falha.
 * Resolve datas relativas no fuso do cliente a partir de `now` (ISO com offset).
 */
import type { ParsedTask } from "../schemas";
import type { Priority } from "../domain";

const WEEKDAYS: [RegExp, number][] = [
  [/domingo/, 0],
  [/segunda(-feira)?/, 1],
  [/ter[cç]a(-feira)?/, 2],
  [/quarta(-feira)?/, 3],
  [/quinta(-feira)?/, 4],
  [/sexta(-feira)?/, 5],
  [/s[aá]bado/, 6],
];

const MONTHS = ["janeiro", "fevereiro", "mar[cç]o", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Relógio de parede do cliente representado em UTC (para usar getUTC*). */
type Wall = { date: Date; offsetMin: number };

function wallFromIso(iso: string | undefined): Wall {
  const now = iso ? new Date(iso) : new Date();
  const m = iso?.match(/([+-])(\d{2}):?(\d{2})$/);
  const offsetMin = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : iso?.endsWith("Z") ? 0 : -now.getTimezoneOffset();
  return { date: new Date(now.getTime() + offsetMin * 60_000), offsetMin };
}

function toIso(wall: Date, offsetMin: number): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const sign = offsetMin < 0 ? "-" : "+";
  return (
    `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}` +
    `T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:00` +
    `${sign}${pad(Math.trunc(offsetMin / 60))}:${pad(offsetMin % 60)}`
  );
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

const norm = (s: string) => s.toLowerCase();

function extractDate(text: string, now: Wall): { iso: string | null; daysAway: number | null } {
  const t = norm(text);
  let day: Date | null = null;

  if (/depois de amanh[ãa]/.test(t)) day = addDays(now.date, 2);
  else if (/amanh[ãa]/.test(t)) day = addDays(now.date, 1);
  else if (/\bhoje\b|ainda hoje|\bagora\b/.test(t)) day = now.date;
  else if (/(semana que vem|pr[óo]xima semana)/.test(t)) day = addDays(now.date, 7);
  else if (/(m[eê]s que vem|pr[óo]ximo m[eê]s)/.test(t)) day = addDays(now.date, 30);

  if (!day) {
    const dm = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    const dn = t.match(new RegExp(`\\bdia (\\d{1,2})(?: de (${MONTHS.join("|")}))?`));
    if (dm) {
      const y = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : now.date.getUTCFullYear();
      day = new Date(Date.UTC(y, Number(dm[2]) - 1, Number(dm[1]), now.date.getUTCHours()));
      if (!dm[3] && day < now.date) day.setUTCFullYear(y + 1);
    } else if (dn) {
      const month = dn[2] ? MONTHS.findIndex((m) => new RegExp(`^${m}$`).test(dn[2])) : now.date.getUTCMonth();
      day = new Date(Date.UTC(now.date.getUTCFullYear(), month, Number(dn[1])));
      if (day < addDays(now.date, -1)) day.setUTCMonth(day.getUTCMonth() + (dn[2] ? 12 : 1));
    }
  }

  if (!day) {
    for (const [re, wd] of WEEKDAYS) {
      if (re.test(t)) {
        let diff = (wd - now.date.getUTCDay() + 7) % 7;
        if (diff === 0) diff = 7; // “sexta” dito numa sexta = próxima sexta
        day = addDays(now.date, diff);
        break;
      }
    }
  }

  const time = t.match(/\b(?:[àa]s?\s*)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/);
  if (!day && !time) return { iso: null, daysAway: null };
  if (!day) day = now.date;

  const result = new Date(day);
  if (time) result.setUTCHours(Number(time[1]) % 24, Number(time[2] ?? time[3] ?? 0), 0, 0);
  else result.setUTCHours(18, 0, 0, 0); // sem hora → fim do expediente
  if (time && !/(amanh|hoje|dia|\/|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)/.test(t) && result < now.date) {
    result.setUTCDate(result.getUTCDate() + 1);
  }

  const daysAway = (result.getTime() - now.date.getTime()) / 86_400_000;
  return { iso: toIso(result, now.offsetMin), daysAway };
}

function extractPriority(text: string, daysAway: number | null): Priority {
  const t = norm(text);
  const urgent = /(urgente|urg[êe]ncia|asap|imediat|o quanto antes|cr[íi]tic|prazo final)/.test(t) || (daysAway !== null && daysAway <= 2);
  const important = /(importante|prioridade|essencial|cliente|chefe|diretoria|apresenta[çc][ãa]o|entrega|contrato|sa[úu]de|m[ée]dico|pagar|conta de|boleto|fatura|imposto|aluguel)/.test(t);
  if (urgent && important) return "URGENT";
  if (important) return "HIGH";
  if (urgent) return "MEDIUM";
  return /(talvez|se der|algum dia|quando puder)/.test(t) ? "LOW" : "MEDIUM";
}

function extractMinutes(text: string): number | null {
  const t = norm(text);
  const h = t.match(/(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?)\b/);
  if (h) return Math.round(Number(h[1].replace(",", ".")) * 60);
  const m = t.match(/(\d+)\s*(?:min|minutos?)\b/);
  return m ? Number(m[1]) : null;
}

const DATE_NOISE = new RegExp(
  [
    "\\b(at[ée]|para|pra|no|na|nesta|neste|nessa|nesse|esta|este|essa|esse|pr[óo]xim[ao]|de|em)?\\s*" +
      "(depois de amanh[ãa]|amanh[ãa]|hoje|ainda hoje|semana que vem|pr[óo]xima semana|m[eê]s que vem|" +
      "(segunda|ter[cç]a|quarta|quinta|sexta)(-feira)?|s[aá]bado|domingo|dia \\d{1,2}( de \\w+)?|\\d{1,2}\\/\\d{1,2}(\\/\\d{2,4})?)",
    "(?:^|\\s)([àa]s?\\s*)?\\d{1,2}(h(\\d{2})?|:\\d{2})\\b",
    "\\b(urgente|urgentemente|asap|o quanto antes)\\b",
    "\\(?(\\d+(?:[.,]\\d+)?)\\s*(horas?|hrs?|min|minutos?)\\)?",
  ].join("|"),
  "gi",
);

function cleanTitle(raw: string): string {
  const t = raw.replace(DATE_NOISE, " ").replace(/\s{2,}/g, " ").replace(/[\s,.;:-]+$/g, "").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Divide “A e preparar B” em duas tarefas quando o “e” introduz um novo verbo no infinitivo. */
function splitTasks(text: string): string[] {
  const verbSplit = /\s+(?:e|e também|depois|além disso,?)\s+(?=[a-záéíóúâêôãõç]+(?:ar|er|ir|or)(?![a-záéíóúâêôãõç]))/i;
  return text
    .split(/\n|;/)
    .flatMap((line) => {
      // o que vem depois de “:” são subtarefas, não novas tarefas
      const idx = line.search(/:\s+/);
      const head = idx >= 0 ? line.slice(0, idx) : line;
      const tail = idx >= 0 ? line.slice(idx) : "";
      const parts = head.split(verbSplit);
      parts[parts.length - 1] += tail;
      return parts;
    })
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

export function heuristicParse(text: string, nowIso?: string): ParsedTask[] {
  const now = wallFromIso(nowIso);
  return splitTasks(text).map((chunk) => {
    // “Título: passo 1, passo 2 e passo 3” → subtarefas
    const [head, tail] = chunk.split(/:\s+/, 2);
    const subtasks = tail
      ? tail.split(/,|\s+e\s+/).map((s) => cleanTitle(s)).filter(Boolean)
      : [];
    const { iso, daysAway } = extractDate(chunk, now);
    return {
      title: cleanTitle(head) || cleanTitle(chunk) || chunk,
      dueDate: iso,
      priority: extractPriority(chunk, daysAway),
      estimatedMinutes: extractMinutes(chunk),
      subtasks,
    };
  });
}
