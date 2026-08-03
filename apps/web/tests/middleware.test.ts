import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function buildRequest(pathname: string, cookieHeader?: string): NextRequest {
  const headers: HeadersInit = cookieHeader ? { cookie: cookieHeader } : {};
  return new NextRequest(new URL(pathname, 'http://localhost:3001'), {
    headers,
  });
}

describe('middleware - proteção de rotas por presença de cookie (SPEC-02 RF06)', () => {
  it('redireciona /tickets para /login quando não há cookie de sessão', () => {
    const response = middleware(buildRequest('/tickets'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('from')).toBe('/tickets');
  });

  it('redireciona /tickets/123 (subrota) para /login quando não há cookie de sessão', () => {
    const response = middleware(buildRequest('/tickets/123'));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe(
      '/login',
    );
  });

  it('redireciona /painel-agente para /login quando não há cookie de sessão', () => {
    const response = middleware(buildRequest('/painel-agente'));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe(
      '/login',
    );
  });

  it('deixa passar /tickets quando o cookie de sessão está presente', () => {
    const response = middleware(
      buildRequest('/tickets', 'access_token=fake.jwt.token'),
    );

    expect(response.headers.get('location')).toBeNull();
  });

  it('não interfere em rotas não protegidas, mesmo sem cookie', () => {
    const response = middleware(buildRequest('/login'));

    expect(response.headers.get('location')).toBeNull();
  });
});
