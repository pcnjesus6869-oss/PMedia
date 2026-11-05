import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/team-auth";

/**
 * Protege o app com a senha da equipe. Ficam públicos:
 *  - /login
 *  - /share/<token>  (link somente leitura enviado ao cliente)
 *  - GET /api/media/<id>  (imagens e vídeos usados pelo link do cliente)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (request.method === "GET" && /^\/api\/media\/[\w-]+$/.test(pathname)) return NextResponse.next();

  if (await verifySessionValue(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|share/).*)"],
};
