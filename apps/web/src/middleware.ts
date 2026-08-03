import { NextRequest, NextResponse } from 'next/server';

/**
 * Nome do cookie httpOnly setado pelo backend Nest em `POST /auth/login`.
 * Duplicado manualmente de `apps/api/src/auth/constants.ts`
 * (`ACCESS_TOKEN_COOKIE`) — SPEC-02, seção 4.
 */
const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Rotas protegidas por presença de cookie de sessão (SPEC-02, RF06).
 */
const PROTECTED_PATH_PREFIXES = ['/tickets', '/painel-agente'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Middleware de UX: apenas checa a *presença* do cookie de sessão, sem
 * validar a assinatura do JWT no edge (SPEC-02, seção 8). A validação real
 * e autoritativa acontece sempre no backend Nest via `JwtAuthGuard`.
 *
 * Redireciona para `/login` quando o cookie está ausente em rotas
 * protegidas (`/tickets/**`, `/painel-agente/**`).
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(ACCESS_TOKEN_COOKIE);

  if (!hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/tickets/:path*', '/painel-agente/:path*'],
};
