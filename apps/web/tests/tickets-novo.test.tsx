import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NovoTicketPage from '@/app/tickets/novo/page';
import type { Ticket } from '@/lib/tickets';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const createdTicket: Ticket = {
  id: 'ticket-novo-1',
  title: 'Erro ao emitir nota fiscal',
  description: 'O sistema retorna erro 500 ao tentar emitir a nota.',
  status: 'OPEN',
  priority: 'MEDIUM',
  category: 'GENERAL',
  createdById: 'user-1',
  assignedToId: null,
  dueAt: '2026-08-04T12:00:00.000Z',
  overdue: false,
  createdAt: '2026-08-03T10:00:00.000Z',
  updatedAt: '2026-08-03T10:00:00.000Z',
  closedAt: null,
};

describe('NovoTicketPage (SPEC-06)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    pushMock.mockReset();
    vi.restoreAllMocks();
  });

  function fillForm() {
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: createdTicket.title },
    });
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: createdTicket.description },
    });
  }

  it('renderiza o formulário com os campos exigidos pela SPEC (título, descrição, prioridade, categoria, anexo)', () => {
    render(<NovoTicketPage />);

    expect(
      screen.getByRole('heading', { name: 'Novo ticket' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Título')).toBeTruthy();
    expect(screen.getByLabelText('Descrição')).toBeTruthy();
    expect(screen.getByLabelText('Prioridade')).toBeTruthy();
    expect(screen.getByLabelText('Categoria')).toBeTruthy();
    expect(screen.getByLabelText('Anexo (opcional)')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Criar ticket' }),
    ).toBeTruthy();
  });

  it('exibe erro de validação e não submete quando o título está vazio (RF04)', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<NovoTicketPage />);

    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'Descrição válida preenchida.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar ticket' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Título é obrigatório/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('exibe erro de validação quando a descrição está vazia, sem submeter', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<NovoTicketPage />);

    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Título válido' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar ticket' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Descrição é obrigatória/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submete com sucesso e redireciona para /tickets com indicador de sucesso', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: 'Created',
      json: async () => createdTicket,
    }) as unknown as typeof fetch;

    render(<NovoTicketPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Criar ticket' }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/tickets?created=true'),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tickets'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          title: createdTicket.title,
          description: createdTicket.description,
          priority: 'MEDIUM',
          category: 'GENERAL',
        }),
      }),
    );
  });

  it('exibe mensagem de erro amigável quando a criação falha na API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: { code: 'INTERNAL_SERVER_ERROR' } }),
    }) as unknown as typeof fetch;

    render(<NovoTicketPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Criar ticket' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Não foi possível criar o ticket/);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
