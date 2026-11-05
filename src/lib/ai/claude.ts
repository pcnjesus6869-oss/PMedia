import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { parseTaskResponseSchema, type ParsedTask } from "../schemas";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

const SYSTEM = `Você é o "segundo cérebro" de um app de produtividade. Converta o texto livre do usuário em tarefas estruturadas.

Regras:
- Uma entrada em "tasks" para cada tarefa independente (ex.: "reunião quinta às 14h e preparar apresentação até sexta" = 2 tarefas).
- "title": curto, claro, em português, sem a data/hora (essas vão em dueDate).
- "dueDate": ISO 8601 com o MESMO offset do momento atual informado. Resolva expressões relativas ("amanhã", "sexta", "semana que vem") a partir desse momento. Dia da semana igual ao de hoje significa a próxima ocorrência. Sem hora explícita, use 18:00. Sem data, null.
- "priority" segue a Matriz de Eisenhower: URGENT = urgente E importante; HIGH = importante, não urgente; MEDIUM = urgente, não importante; LOW = nenhum dos dois. Prazos em até 48h contam como urgentes; entregas, clientes, saúde e finanças tendem a ser importantes.
- "estimatedMinutes": só se o texto permitir inferir com segurança; senão null.
- "subtasks": passos menores explicitamente mencionados ou claramente implícitos na tarefa (máx. 6). Pode ser vazio.`;

let client: Anthropic | null = null;

export function isClaudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function claudeParse(text: string, nowIso: string, timeZone?: string): Promise<ParsedTask[] | null> {
  client ??= new Anthropic();

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    // Fallback de servidor: se o classificador recusar, a API roteia para outro modelo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(parseTaskResponseSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Momento atual: ${nowIso}${timeZone ? ` (fuso ${timeZone})` : ""}\n\nTexto:\n${text}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return response.parsed_output.tasks;
}
