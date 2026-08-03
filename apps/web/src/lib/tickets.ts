import { API_BASE_URL } from './api-client';

/**
 * Enums do domínio de tickets (SPEC-03/SPEC-06).
 * Duplicado manualmente de `apps/api/prisma/schema.prisma` (`enum
 * TicketStatus`/`TicketPriority`/`TicketCategory`) — mesma convenção de
 * duplicação manual já aceita em `src/lib/auth.ts` (SPEC-02, seção 4).
 */
export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketCategory =
  | 'GENERAL'
  | 'TECHNICAL'
  | 'BILLING'
  | 'ACCOUNT'
  | 'FEATURE_REQUEST'
  | 'OTHER';

/** Espelha `AttachmentResponse` (`apps/api/src/tickets/types/ticket-response.type.ts`). */
export interface TicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  createdAt: string;
  downloadUrl: string;
}

/** Espelha `TicketResponse` (`apps/api/src/tickets/types/ticket-response.type.ts`). */
export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  createdById: string;
  assignedToId: string | null;
  dueAt: string | null;
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  attachments?: TicketAttachment[];
}

/** Espelha `PaginatedTickets` (`apps/api/src/tickets/tickets.service.ts`). */
export interface PaginatedTickets {
  data: Ticket[];
  page: number;
  pageSize: number;
  total: number;
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  WAITING_CUSTOMER: 'Aguardando cliente',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  GENERAL: 'Geral',
  TECHNICAL: 'Técnico',
  BILLING: 'Faturamento',
  ACCOUNT: 'Conta',
  FEATURE_REQUEST: 'Sugestão de funcionalidade',
  OTHER: 'Outro',
};

/**
 * Erro de chamada à API de tickets com o `status` HTTP original preservado
 * (mesma convenção de `AuthError` em `src/lib/auth.ts`, SPEC-05).
 */
export class TicketsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TicketsError';
  }
}

/**
 * Extrai a mensagem amigável do formato de erro padronizado do
 * `TicketsController` (`{ error: { code, message } }`, ver
 * `apps/api/src/tickets/filters/tickets-exception.filter.ts`). Nunca propaga
 * stack trace para a UI (SPEC-06, seção 6).
 */
async function extractErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: { message?: unknown } })?.error
      ?.message;
    if (typeof message === 'string') {
      return message;
    }
  } catch {
    // corpo não é JSON (falha de infraestrutura) — usa a mensagem padrão.
  }
  return fallback;
}

export interface ListTicketsParams {
  page?: number;
  pageSize?: number;
  status?: TicketStatus;
  category?: TicketCategory;
}

/**
 * Lista tickets via `GET /tickets` (SPEC-03/SPEC-06 RF01).
 *
 * NOTA (decisão de implementação documentada, SPEC-06): o backend
 * (`TicketsService.findAll`, SPEC-03 seção 3) só aplica os filtros
 * `status`/`category`/`priority` da query string para os papéis
 * `AGENT`/`ADMIN` — para `CUSTOMER` a única restrição aplicada é
 * `createdById === session.user.id`, os demais parâmetros são ignorados.
 * Como o `CUSTOMER` só pode filtrar os próprios tickets, o filtro por
 * status/category desta tela (`/tickets`) é aplicado inteiramente no
 * cliente sobre o conjunto já retornado, não via query string — ainda
 * assim os parâmetros são enviados aqui (inofensivo, e mantém a função
 * reutilizável caso o backend passe a suportá-los para `CUSTOMER` no
 * futuro).
 */
export async function listTickets(
  params: ListTicketsParams = {},
): Promise<PaginatedTickets> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined)
    query.set('pageSize', String(params.pageSize));
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);

  const queryString = query.toString();
  const response = await fetch(
    `${API_BASE_URL}/tickets${queryString ? `?${queryString}` : ''}`,
    {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    },
  );

  if (!response.ok) {
    throw new TicketsError(
      await extractErrorMessage(
        response,
        'Não foi possível carregar seus tickets agora. Tente novamente.',
      ),
      response.status,
    );
  }

  return (await response.json()) as PaginatedTickets;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  priority?: TicketPriority;
  category?: TicketCategory;
}

/** Cria um ticket via `POST /tickets` (SPEC-03/SPEC-06 RF03/RF04). */
export async function createTicket(
  payload: CreateTicketPayload,
): Promise<Ticket> {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new TicketsError(
      await extractErrorMessage(
        response,
        'Não foi possível criar o ticket agora. Tente novamente.',
      ),
      response.status,
    );
  }

  return (await response.json()) as Ticket;
}

/**
 * Envia o anexo opcional via `POST /tickets/:id/attachments`
 * (`multipart/form-data`) logo após a criação do ticket (SPEC-06, seção 3:
 * sequenciamento a critério do dev-frontend — anexo é enviado em uma
 * segunda chamada, após `createTicket` resolver com sucesso).
 *
 * Não usa `apiFetch`/o `fetch` de `createTicket` porque `FormData` precisa
 * que o browser defina o `Content-Type` (com boundary) automaticamente —
 * nunca deve ser forçado para `application/json`.
 */
export async function uploadTicketAttachment(
  ticketId: string,
  file: File,
): Promise<TicketAttachment> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_BASE_URL}/tickets/${ticketId}/attachments`,
    {
      method: 'POST',
      credentials: 'include',
      body: formData,
    },
  );

  if (!response.ok) {
    throw new TicketsError(
      await extractErrorMessage(
        response,
        'O ticket foi criado, mas não foi possível enviar o anexo.',
      ),
      response.status,
    );
  }

  return (await response.json()) as TicketAttachment;
}

/** Formata datas ISO em `pt-BR` (`dd/mm/aaaa HH:MM`), ou `"—"` quando nulas. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}
