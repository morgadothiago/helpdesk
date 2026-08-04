import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegistroPage from '@/app/registro/page';
import type { AuthenticatedUser } from '@/lib/auth';

const newUser: AuthenticatedUser = {
  id: 'user-3',
  name: 'Novo Cliente',
  email: 'novo@example.com',
  role: 'CUSTOMER',
  createdAt: '2026-08-03T12:00:00.000Z',
  updatedAt: '2026-08-03T12:00:00.000Z',
};

describe('RegistroPage (SPEC-05)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function fillForm() {
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: newUser.name },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: newUser.email },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'senha-forte-123' },
    });
  }

  it('renderiza o formulário de registro com campos acessíveis', () => {
    render(<RegistroPage />);

    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeTruthy();
    expect(screen.getByLabelText('Nome')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
  });

  it('alterna a visibilidade da senha ao clicar no botão de olho', () => {
    render(<RegistroPage />);

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

  it('exibe erro quando o email já está cadastrado (409)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({}),
    }) as unknown as typeof fetch;

    render(<RegistroPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/já está cadastrado/);
  });

  it('exibe mensagem de sucesso e link para /login após criar a conta', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: 'Created',
      json: async () => newUser,
    }) as unknown as typeof fetch;

    render(<RegistroPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() =>
      expect(screen.getByText(/Conta criada com sucesso/)).toBeTruthy(),
    );
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toBeTruthy();
  });
});
