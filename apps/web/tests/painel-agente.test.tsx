import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PainelAgentePage from '@/app/painel-agente/page';
import type { AuthenticatedUser } from '@/lib/auth';
import type { PaginatedTickets, Ticket } from '@/lib/tickets';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const agentUser: AuthenticatedUser = {
  id: 'agent-1',
  name: 'Agente Exemplo',
  email: 'agente@example.com',
  role: 'AGENT',
  createdAt: '2026-08-03T10:00:00.000Z',
  updatedAt: '2026-08-03T10:00:00.000Z',
};

const customerUser: AuthenticatedUser = {
  id: 'user-1',
  name: 'Cliente Exemplo',
  email: 'cliente@example.com',
  role: 'CUSTOMER',
  createdAt: '2026-08-03T10:00:00.000Z',
  updatedAt: '2026-08-03T10:00:00.000Z',
};

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

interface MockCounts {
  open: number;
  unassigned: number;
  overdue: number;
}

/**
 * Roteador de `fetch` mockado por URL/método, cobrindo as chamadas feitas
 * pelo painel do agente (SPEC-08): `GET /auth/me`, `GET /tickets`
 * (listagem paginada da fila e as 3 chamadas leves de contadores,
 * distinguidas por `pageSize=1`) e `PATCH /tickets/:id` (ação "Assumir").
 */
function mockApi({
  user,
  tickets,
  counts,
  onPatch,
}: {
  user: AuthenticatedUser;
  tickets: Ticket[];
  counts: MockCounts;
  onPatch?: (ticket: Ticket, body: Partial<Ticket>) => Ticket;
}) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => user,
        };
      }

      if (url.includes('/tickets/') && method === 'PATCH') {
        const id = url.split('/tickets/')[1];
        const ticket = tickets.find((t) => t.id === id);
        if (!ticket) throw new Error(`Ticket não mockado: ${id}`);
        const body = JSON.parse(init?.body as string) as Partial<Ticket>;
        const updated = onPatch
          ? onPatch(ticket, body)
          : ({ ...ticket, ...body } as Ticket);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => updated,
        };
      }

      if (url.includes('/tickets') && method === 'GET') {
        const urlObj = new URL(url, 'http://localhost');
        const pageSize = urlObj.searchParams.get('pageSize');

        if (pageSize === '1') {
          const status = urlObj.searchParams.get('status');
          const assignedToId = urlObj.searchParams.get('assignedToId');
          const overdue = urlObj.searchParams.get('overdue');
          let total = 0;
          if (status === 'OPEN') total = counts.open;
          else if (assignedToId === 'unassigned') total = counts.unassigned;
          else if (overdue === 'true') total = counts.overdue;

          const response: PaginatedTickets = {
            data: [],
            page: 1,
            pageSize: 1,
            total,
          };
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => response,
          };
        }

        const response: PaginatedTickets = {
          data: tickets,
          page: 1,
          pageSize: 20,
          total: tickets.length,
        };
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => response,
        };
      }

      throw new Error(`Chamada de fetch não mockada: ${method} ${url}`);
    },
  );

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('PainelAgentePage (SPEC-08)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    pushMock.mockClear();
  });

  it('renderiza a fila com todos os tickets do sistema, colunas e contadores (RF02)', async () => {
    const tickets = [
      buildTicket({
        id: 'ticket-1',
        title: 'Não consigo acessar minha conta',
        status: 'OPEN',
        priority: 'HIGH',
        createdById: 'user-1',
        assignedToId: null,
      }),
      buildTicket({
        id: 'ticket-2',
        title: 'Cobrança duplicada na fatura',
        status: 'RESOLVED',
        category: 'BILLING',
        overdue: true,
        assignedToId: 'agent-1',
      }),
    ];

    mockApi({
      user: agentUser,
      tickets,
      counts: { open: 1, unassigned: 1, overdue: 1 },
    });

    render(<PainelAgentePage />);

    await waitFor(() =>
      expect(
        screen.getAllByText('Não consigo acessar minha conta').length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getAllByText('Cobrança duplicada na fatura').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Atrasado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Você').length).toBeGreaterThan(0);

    // Contadores de resumo (baseados em `.total` das chamadas de
    // `GET /tickets?pageSize=1`, ver `mockApi`).
    await waitFor(() => {
      const counts = screen.getAllByText('1');
      expect(counts.length).toBeGreaterThanOrEqual(3);
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  it('ação "Assumir" atribui o ticket ao agente logado e atualiza a linha sem reload completo (RF04)', async () => {
    const user = userEvent.setup();
    const ticket = buildTicket({
      id: 'ticket-1',
      title: 'Ticket sem responsável',
      assignedToId: null,
    });

    const fetchMock = mockApi({
      user: agentUser,
      tickets: [ticket],
      counts: { open: 1, unassigned: 1, overdue: 0 },
      onPatch: (current, body) => ({ ...current, ...body }),
    });

    render(<PainelAgentePage />);

    // A tabela (>= md) e a versão em cards (< md) renderizam ambas no DOM
    // em jsdom (a alternância é só via classes de media query do
    // Tailwind), então há dois botões "Assumir" — clicar no primeiro é
    // suficiente para validar a ação.
    const assumeButtons = await screen.findAllByRole('button', {
      name: 'Assumir',
    });

    await user.click(assumeButtons[0]);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            typeof input === 'string' &&
            input.includes('/tickets/ticket-1') &&
            (init as RequestInit | undefined)?.method === 'PATCH',
        ),
      ).toBe(true),
    );

    // A linha reflete a atribuição (agente logado) sem precisar de reload:
    // o botão "Assumir" desaparece e a célula de agente responsável passa
    // a exibir "Você".
    await waitFor(() =>
      expect(
        screen.queryAllByRole('button', { name: 'Assumir' }).length,
      ).toBe(0),
    );
    expect(screen.getAllByText('Você').length).toBeGreaterThan(0);
  });

  it('CUSTOMER é redirecionado para /tickets ao acessar o painel do agente (RF01, guard de acesso)', async () => {
    mockApi({
      user: customerUser,
      tickets: [buildTicket()],
      counts: { open: 1, unassigned: 1, overdue: 0 },
    });

    render(<PainelAgentePage />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/tickets'));

    // Nenhum dado da fila deve ser exibido para o CUSTOMER.
    expect(screen.queryByText('Painel do agente')).toBeNull();
  });

  it('filtros combinados (status + prioridade) são enviados juntos na query string de GET /tickets', async () => {
    const user = userEvent.setup();
    const tickets = [buildTicket({ id: 'ticket-1' })];
    const fetchMock = mockApi({
      user: agentUser,
      tickets,
      counts: { open: 1, unassigned: 1, overdue: 0 },
    });

    render(<PainelAgentePage />);

    await waitFor(() =>
      expect(screen.getAllByText(tickets[0].title).length).toBeGreaterThan(0),
    );

    const statusTrigger = screen.getByLabelText('Filtrar por status');
    await user.click(statusTrigger);
    let listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Aberto'));

    const priorityTrigger = screen.getByLabelText('Filtrar por prioridade');
    await user.click(priorityTrigger);
    listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Alta'));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          if (typeof input !== 'string') return false;
          const url = new URL(input, 'http://localhost');
          return (
            url.pathname.endsWith('/tickets') &&
            url.searchParams.get('pageSize') === '20' &&
            url.searchParams.get('status') === 'OPEN' &&
            url.searchParams.get('priority') === 'HIGH'
          );
        }),
      ).toBe(true),
    );
  });
});
