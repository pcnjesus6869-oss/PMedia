import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { claudeParse, isClaudeConfigured } from "@/lib/ai/claude";
import { heuristicParse } from "@/lib/ai/heuristic";
import { parseTaskRequestSchema, parseTaskResponseSchema, type ParseTaskResponse } from "@/lib/schemas";

/**
 * POST /api/ai/parse-task
 * Body: { text: string, now?: ISO-com-offset, timeZone?: string }
 * Resposta: { tasks: ParsedTask[], source: "claude" | "heuristic" }
 * Apenas interpreta o texto; o cliente revisa e persiste via server action.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const input = parseTaskRequestSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Entrada inválida", issues: input.error.issues }, { status: 400 });
  }

  const { text, timeZone } = input.data;
  const now = input.data.now ?? new Date().toISOString();

  if (isClaudeConfigured()) {
    try {
      const tasks = await claudeParse(text, now, timeZone);
      if (tasks?.length) {
        const payload: ParseTaskResponse = { ...parseTaskResponseSchema.parse({ tasks }), source: "claude" };
        return NextResponse.json(payload);
      }
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) console.error("[parse-task] chave Anthropic inválida");
      else if (e instanceof Anthropic.RateLimitError) console.warn("[parse-task] rate limit, usando heurística");
      else if (e instanceof Anthropic.APIError) console.error("[parse-task] erro da API", e.status, e.message);
      else console.error("[parse-task]", e);
      // segue para o fallback heurístico
    }
  }

  const payload: ParseTaskResponse = { tasks: heuristicParse(text, now), source: "heuristic" };
  return NextResponse.json(payload);
}
