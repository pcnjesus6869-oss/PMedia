/**
 * Senha única de acesso da equipe.
 *
 * - TEAM_PASSWORD: a senha (defina na Vercel em Settings → Environment Variables).
 * - AUTH_SECRET (opcional): chave para assinar o cookie. Sem ela, usa a própria senha.
 *
 * O cookie guarda só a validade + uma assinatura HMAC. Trocar TEAM_PASSWORD
 * derruba todas as sessões abertas. Usa Web Crypto para rodar também no proxy.
 *
 * TODO(auth): substituir por login individual (Auth.js/Clerk) quando houver contas por colaborador.
 */
export const SESSION_COOKIE = "pmedia_team";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export function teamPassword() {
  return process.env.TEAM_PASSWORD?.trim() || null;
}

/** Sem senha configurada: liberado só em desenvolvimento. */
export function authDisabled() {
  return !teamPassword() && process.env.NODE_ENV !== "production";
}

async function hmac(message: string) {
  const password = teamPassword() ?? "";
  const key = await crypto.subtle.importKey("raw", enc.encode(process.env.AUTH_SECRET || password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  // a senha entra na mensagem: trocar a senha invalida cookies antigos
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${message}|${password}`));
  return toHex(sig);
}

export async function createSessionValue(now = Date.now()) {
  const exp = now + SESSION_DAYS * 86_400_000;
  return `${exp}.${await hmac(`team:${exp}`)}`;
}

/** Comparação em tempo constante para strings de mesmo tamanho. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySessionValue(value: string | undefined | null) {
  if (authDisabled()) return true;
  if (!value || !teamPassword()) return false;
  const [expRaw, sig] = value.split(".");
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(sig, await hmac(`team:${exp}`));
}

export async function checkPassword(input: string) {
  const expected = teamPassword();
  if (!expected) return false;
  // compara os hashes (mesmo tamanho) para não vazar o tamanho da senha
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(input)), crypto.subtle.digest("SHA-256", enc.encode(expected))]);
  return safeEqual(toHex(a), toHex(b));
}

/** Evita open redirect: só caminhos internos. */
export function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
