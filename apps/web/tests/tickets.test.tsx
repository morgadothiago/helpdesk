import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TicketsPage from '@/app/tickets/page';
import type { PaginatedTickets, Ticket } from '@/lib/tickets';

const searchParamsMock = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock,
  useRouter: () => ({ push: vi.fn() }),
}));

function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    title: 'Não consigo acessar minha conta',
    description: 'Erro ao logar com email e senha corretos.',
    status: 'OPEN',
    priority: 'HIGH',
    category: 'TECHNICAL',
    createdById: 'user-1',
    assignedToId: null,
    dueAt: '2026-08-04T12:00:00.000Z',
    overdue: false,
    createdAt: '2026-08-03T10:00:00.000Z',
    updatedAt: '2026-08-03T10:00:00.000Z',
    closedAt: null,
    ...overrides,
  };
}

function mockListResponse(data: Ticket[]): PaginatedTickets {
  return { data, page: 1, pageSize: 100, total: data.length };
}

describe('TicketsPage (SPEC-06)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    searchParamsMock.delete('created');
  });

  it('renderiza a listagem com os tickets retornados por GET /tickets', async () => {
    const tickets = [
      buildTicket({
        id: 'ticket-1',
        title: 'Não consigo acessar minha conta',
        status: 'OPEN',
      }),
      buildTicket({
        id: 'ticket-2',
        title: 'Cobrança duplicada na fatura',
        status: 'RESOLVED',
        category: 'BILLING',
        overdue: true,
      }),
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockListResponse(tickets),
    }) as unknown as typeof fetch;

    render(<TicketsPage />);

    await waitFor(() =>
      expect(
        screen.getAllByText('Não consigo acessar minha conta').length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getAllByText('Cobrança duplicada na fatura').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Atrasado').length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tickets'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('exibe o estado vazio com CTA quando não há tickets', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockListResponse([]),
    }) as unknown as typeof fetch;

    render(<TicketsPage />);

    await waitFor(() =>
      expect(
        screen.getByText('Você ainda não abriu nenhum ticket.'),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole('link', { name: 'Abrir meu primeiro ticket' }),
    ).toBeTruthy();
  });

  it('exibe mensagem amigável de erro quando a API falha', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    }) as unknown as typeof fetch;

    render(<TicketsPage />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Não foi possível carregar/);
  });

  it('filtro por status atualiza a lista exibida sem nova chamada de rede', async () => {
    const user = userEvent.setup();
    const tickets = [
      buildTicket({ id: 'ticket-1', title: 'Ticket aberto', status: 'OPEN' }),
      buildTicket({
        id: 'ticket-2',
        title: 'Ticket resolvido',
        status: 'RESOLVED',
      }),
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockListResponse(tickets),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TicketsPage />);

    await waitFor(() =>
      expect(screen.getAllByText('Ticket aberto').length).toBeGreaterThan(0),
    );
    expect(
      screen.getAllByText('Ticket resolvido').length,
    ).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const statusTrigger = screen.getByLabelText('Filtrar por status');
    await user.click(statusTrigger);

    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Resolvido'));

    await waitFor(() =>
      expect(screen.queryByText('Ticket aberto')).not.toBeInTheDocument(),
    );
    expect(
      screen.getAllByText('Ticket resolvido').length,
    ).toBeGreaterThan(0);
    // Filtro é aplicado inteiramente no cliente (ver src/lib/tickets.ts) —
    // não deve disparar uma nova requisição de rede.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('exibe alerta de sucesso quando a URL indica ?created=true', async () => {
    searchParamsMock.set('created', 'true');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockListResponse([buildTicket()]),
    }) as unknown as typeof fetch;

    render(<TicketsPage />);

    expect(
      await screen.findByText('Ticket criado com sucesso.'),
    ).toBeTruthy();
  });
});
