import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import type { AuthenticatedUser } from '@/lib/auth';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const customerUser: AuthenticatedUser = {
  id: 'user-1',
  name: 'Cliente Exemplo',
  email: 'cliente@example.com',
  role: 'CUSTOMER',
  createdAt: '2026-08-03T12:00:00.000Z',
  updatedAt: '2026-08-03T12:00:00.000Z',
};

const agentUser: AuthenticatedUser = {
  ...customerUser,
  id: 'user-2',
  email: 'agente@example.com',
  role: 'AGENT',
};

describe('LoginPage (SPEC-05)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    pushMock.mockReset();
    vi.restoreAllMocks();
  });

  it('renderiza o formulário de login com campos acessíveis', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('alterna a visibilidade da senha ao clicar no botão de olho', () => {
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText('Senha') as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: 'Mostrar senha' });

    expect(passwordInput.type).toBe('password');
    expect(toggleButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggleButton);

    expect(passwordInput.type).toBe('text');
    expect(
      screen.getByRole('button', { name: 'Ocultar senha' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('exibe mensagem de erro ao submeter com credenciais inválidas, sem recarregar a página', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    }) as unknown as typeof fetch;

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'cliente@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'senha-errada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Email ou senha inválidos/);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('em caso de sucesso, redireciona CUSTOMER para /tickets', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => customerUser,
    }) as unknown as typeof fetch;

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: customerUser.email },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'senha-correta' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/tickets'));
  });

  it('em caso de sucesso, redireciona AGENT para /painel-agente', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => agentUser,
    }) as unknown as typeof fetch;

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: agentUser.email },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'senha-correta' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/painel-agente'),
    );
  });
});
