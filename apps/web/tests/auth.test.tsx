import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { getCurrentUser, useSession, type AuthenticatedUser } from '@/lib/auth';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  name: 'Cliente Exemplo',
  email: 'cliente@example.com',
  role: 'CUSTOMER',
  createdAt: '2026-08-03T12:00:00.000Z',
  updatedAt: '2026-08-03T12:00:00.000Z',
};

describe('getCurrentUser - GET /auth/me (SPEC-02)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('envia credentials: "include" e retorna o usuário autenticado', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockUser,
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await getCurrentUser();

    expect(result).toEqual(mockUser);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('retorna null (sem lançar) quando a API responde 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it('lança erro para falhas de infraestrutura (não-401)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(getCurrentUser()).rejects.toThrow(
      /Falha ao buscar usuário autenticado/,
    );
  });
});

function SessionProbe() {
  const { user, isLoading } = useSession();

  if (isLoading) return <span>carregando</span>;
  if (!user) return <span>sem-sessao</span>;
  return <span>logado-como-{user.email}</span>;
}

describe('useSession - hidratação de sessão client-side (SPEC-02)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('expõe o usuário autenticado após resolver GET /auth/me', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockUser,
    }) as unknown as typeof fetch;

    render(<SessionProbe />);

    expect(screen.getByText('carregando')).toBeTruthy();

    await waitFor(() =>
      expect(screen.getByText(`logado-como-${mockUser.email}`)).toBeTruthy(),
    );
  });

  it('expõe user: null quando não há sessão (401)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    }) as unknown as typeof fetch;

    render(<SessionProbe />);

    await waitFor(() => expect(screen.getByText('sem-sessao')).toBeTruthy());
  });
});
