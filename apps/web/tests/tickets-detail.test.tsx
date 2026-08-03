import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TicketDetailPage from '@/app/tickets/[id]/page';
import type { AuthenticatedUser } from '@/lib/auth';
import type { Comment, Ticket } from '@/lib/tickets';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'ticket-1' }),
}));

const customerUser: AuthenticatedUser = {
  id: 'user-1',
  name: 'Cliente Exemplo',
  email: 'cliente@example.com',
  role: 'CUSTOMER',
  createdAt: '2026-08-03T10:00:00.000Z',
  updatedAt: '2026-08-03T10:00:00.000Z',
};

const agentUser: AuthenticatedUser = {
  id: 'agent-1',
  name: 'Agente Exemplo',
  email: 'agente@example.com',
  role: 'AGENT',
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
    attachments: [],
    ...overrides,
  };
}

function buildComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    content: 'Já tentei redefinir a senha, sem sucesso.',
    ticketId: 'ticket-1',
    authorId: 'user-1',
    author: { id: 'user-1', name: 'Cliente Exemplo', role: 'CUSTOMER' },
    attachments: [],
    createdAt: '2026-08-03T11:00:00.000Z',
    ...overrides,
  };
}

/**
 * Roteador de `fetch` mockado por URL/método, cobrindo as chamadas feitas
 * pela página de detalhe (SPEC-07): `GET /auth/me`, `GET /tickets/:id`,
 * `GET /tickets/:id/comments`, `PATCH /tickets/:id` e
 * `POST /tickets/:id/comments`.
 */
function mockApi({
  user,
  ticket,
  comments,
  onPatch,
  onCreateComment,
}: {
  user: AuthenticatedUser;
  ticket: Ticket;
  comments: Comment[];
  onPatch?: (body: unknown) => Ticket;
  onCreateComment?: (formData: FormData) => Comment;
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

      if (url.includes('/comments') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => comments,
        };
      }

      if (url.includes('/comments') && method === 'POST') {
        const formData = init?.body as FormData;
        const created = onCreateComment
          ? onCreateComment(formData)
          : buildComment({ content: String(formData.get('content')) });
        return {
          ok: true,
          status: 201,
          statusText: 'Created',
          json: async () => created,
        };
      }

      if (url.endsWith(`/tickets/${ticket.id}`) && method === 'GET') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ticket,
        };
      }

      if (url.endsWith(`/tickets/${ticket.id}`) && method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        const updated = onPatch
          ? onPatch(body)
          : { ...ticket, ...body };
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => updated,
        };
      }

      throw new Error(`Chamada de fetch não mockada: ${method} ${url}`);
    },
  );

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('TicketDetailPage (SPEC-07)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renderiza o detalhe do ticket com dados mockados (título, descrição, badges, prazo, autor)', async () => {
    const ticket = buildTicket();
    mockApi({ user: customerUser, ticket, comments: [buildComment()] });

    render(<TicketDetailPage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Não consigo acessar minha conta',
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByText('Erro ao logar com email e senha corretos.')
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Aberto').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Técnico').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Você').length).toBeGreaterThan(0);

    expect(
      await screen.findByText('Já tentei redefinir a senha, sem sucesso.'),
    ).toBeTruthy();
  });

  it('exibe "não encontrado" quando a API retorna 404 (CUSTOMER em ticket alheio)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => customerUser,
        };
      }
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: { code: 'TICKET_NOT_FOUND', message: 'Não encontrado.' },
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TicketDetailPage />);

    expect(
      await screen.findByRole('heading', { name: 'Ticket não encontrado' }),
    ).toBeTruthy();
  });

  it('CUSTOMER consegue enviar um novo comentário e ele aparece na lista imediatamente (RF04)', async () => {
    const user = userEvent.setup();
    const ticket = buildTicket();
    mockApi({ user: customerUser, ticket, comments: [] });

    render(<TicketDetailPage />);

    await waitFor(() =>
      expect(screen.getByLabelText('Novo comentário')).toBeTruthy(),
    );

    await user.type(
      screen.getByLabelText('Novo comentário'),
      'Consegui resolver sozinho, obrigado.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Enviar comentário' }),
    );

    expect(
      await screen.findByText('Consegui resolver sozinho, obrigado.'),
    ).toBeTruthy();
  });

  it('AGENT altera o status do ticket via PATCH e a UI reflete a mudança sem reload completo (RF03)', async () => {
    const user = userEvent.setup();
    const ticket = buildTicket({ status: 'OPEN' });
    const fetchMock = mockApi({
      user: agentUser,
      ticket,
      comments: [],
      onPatch: (body) => ({
        ...ticket,
        ...(body as Partial<Ticket>),
      }),
    });

    render(<TicketDetailPage />);

    const statusTrigger = await screen.findByLabelText('Status');
    await user.click(statusTrigger);
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Em andamento'));

    await user.click(
      screen.getByRole('button', { name: 'Salvar alterações' }),
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
        ),
      ).toBe(true),
    );

    expect(
      await screen.findByText('Alterações salvas com sucesso.'),
    ).toBeTruthy();
    expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0);
  });

  it('bloqueia o formulário de comentário quando o ticket está CLOSED (RF05)', async () => {
    const ticket = buildTicket({ status: 'CLOSED', closedAt: '2026-08-03T12:00:00.000Z' });
    mockApi({ user: customerUser, ticket, comments: [] });

    render(<TicketDetailPage />);

    expect(
      await screen.findByText(
        'Este ticket está encerrado — não é possível adicionar novos comentários.',
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Novo comentário')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Enviar comentário' }),
    ).not.toBeInTheDocument();
  });
});
