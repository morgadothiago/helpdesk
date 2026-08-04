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
  priority?: TicketPriority;
  category?: TicketCategory;
  /**
   * Espelha o contrato de `ListTicketsQueryDto`
   * (`apps/api/src/tickets/dto/list-tickets-query.schema.ts`, SPEC-03,
   * seção 3): aceita o valor especial `"unassigned"` para tickets sem
   * agente responsável, além de um ID de usuário concreto. Só é de fato
   * aplicado pelo backend para os papéis `AGENT`/`ADMIN` (SPEC-08).
   */
  assignedToId?: string;
  overdue?: boolean;
}

/**
 * Lista tickets via `GET /tickets` (SPEC-03/SPEC-06 RF01/SPEC-08 RF02-RF05).
 *
 * NOTA (decisão de implementação documentada, SPEC-06): o backend
 * (`TicketsService.findAll`, SPEC-03 seção 3) só aplica os filtros
 * `status`/`category`/`priority`/`assignedToId`/`overdue` da query string
 * para os papéis `AGENT`/`ADMIN` — para `CUSTOMER` a única restrição
 * aplicada é `createdById === session.user.id`, os demais parâmetros são
 * ignorados. Como o `CUSTOMER` só pode filtrar os próprios tickets, o
 * filtro por status/category da tela `/tickets` (SPEC-06) é aplicado
 * inteiramente no cliente sobre o conjunto já retornado, não via query
 * string — ainda assim os parâmetros são enviados aqui (inofensivo, e
 * mantém a função reutilizável). Já a tela `/painel-agente` (SPEC-08,
 * `AGENT`/`ADMIN`) usa os filtros e a paginação reais do backend, sem
 * nenhum workaround client-side, pois o backend já os suporta para esses
 * papéis.
 */
export async function listTickets(
  params: ListTicketsParams = {},
): Promise<PaginatedTickets> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined)
    query.set('pageSize', String(params.pageSize));
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.category) query.set('category', params.category);
  if (params.assignedToId) query.set('assignedToId', params.assignedToId);
  if (params.overdue !== undefined)
    query.set('overdue', String(params.overdue));

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

/**
 * Busca o detalhe de um ticket via `GET /tickets/:id` (SPEC-03/SPEC-07,
 * RF07/RF09). Retorna sempre `attachments` preenchido (ver
 * `TicketsService.findOne`).
 *
 * 404 (`TicketsError.status === 404`) é o comportamento esperado quando um
 * `CUSTOMER` tenta acessar ticket de outro usuário (SPEC-07, RF02) — a
 * página de detalhe trata esse status renderizando "não encontrado", nunca
 * um erro genérico.
 */
export async function getTicket(id: string): Promise<Ticket> {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new TicketsError(
      await extractErrorMessage(
        response,
        'Não foi possível carregar este ticket agora. Tente novamente.',
      ),
      response.status,
    );
  }

  return (await response.json()) as Ticket;
}

/**
 * Payload de `PATCH /tickets/:id` (SPEC-03, seção 7): união de todos os
 * campos possíveis — quais campos cada papel pode de fato enviar é
 * decidido pelo backend (`TicketsService.update`), a UI só reflete
 * visualmente essa restrição (SPEC-07, seção 10: "nenhuma regra de
 * autorização decidida apenas no frontend").
 */
export interface UpdateTicketPayload {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedToId?: string | null;
}

/**
 * Atualiza um ticket via `PATCH /tickets/:id` (SPEC-07, RF03/permissões por
 * papel). Erros 400/403/404/409 (ex.: transição de status inválida,
 * `assignedToId` inexistente, campo não permitido para o papel) são
 * propagados como `TicketsError` com a mensagem amigável já formatada pelo
 * backend (`TicketsExceptionFilter`), para exibição direta na UI.
 */
export async function updateTicket(
  id: string,
  payload: UpdateTicketPayload,
): Promise<Ticket> {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new TicketsError(
      await extractErrorMessage(
        response,
        'Não foi possível salvar as alterações agora. Tente novamente.',
      ),
      response.status,
    );
  }

  return (await response.json()) as Ticket;
}

/** Espelha `CommentAttachmentResponse` (`apps/api/src/comments/types/comment-response.type.ts`). */
export interface CommentAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  createdAt: string;
  downloadUrl: string;
}

/** Espelha `CommentAuthorResponse` — nunca inclui dados sensíveis (senha/hash). */
export interface CommentAuthor {
  id: string;
  name: string | null;
  role: 'CUSTOMER' | 'AGENT' | 'ADMIN';
}

/** Espelha `CommentResponse` (`apps/api/src/comments/types/comment-response.type.ts`). */
export interface Comment {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
  author: CommentAuthor;
  attachments: CommentAttachment[];
  createdAt: string;
}

/**
 * Lista comentários do ticket via `GET /tickets/:id/comments` (SPEC-04),
 * já ordenados por `createdAt asc` pelo backend.
 */
export async function listComments(ticketId: string): Promise<Comment[]> {
  const response = await fetch(
    `${API_BASE_URL}/tickets/${ticketId}/comments`,
    {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    },
  );

  if (!response.ok) {
    throw new TicketsError(
      await extractErrorMessage(
        response,
        'Não foi possível carregar os comentários agora. Tente novamente.',
      ),
      response.status,
    );
  }

  return (await response.json()) as Comment[];
}

/**
 * Cria um comentário via `POST /tickets/:id/comments`
 * (`multipart/form-data`, SPEC-04): `content` obrigatório, `files[]`
 * opcional. Bloqueado pelo backend (409 `TICKET_CLOSED`) se o ticket
 * estiver `CLOSED` — a UI desabilita o formulário antes disso (SPEC-07,
 * RF05), mas o erro de rede ainda é tratado aqui de forma defensiva.
 *
 * Não usa `apiFetch` pelo mesmo motivo de `uploadTicketAttachment`:
 * `FormData` precisa que o browser defina o `Content-Type` (com boundary)
 * automaticamente.
 */
export async function createComment(
  ticketId: string,
  formData: FormData,
): Promise<Comment> {
  const response = await fetch(
    `${API_BASE_URL}/tickets/${ticketId}/comments`,
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
        'Não foi possível enviar o comentário agora. Tente novamente.',
      ),
      response.status,
    );
  }

  return (await response.json()) as Comment;
}

/**
 * Monta a URL absoluta de download autenticado a partir do `downloadUrl`
 * relativo retornado pela API (ex.:
 * `/tickets/:id/attachments/:attachmentId/download`). A navegação do
 * browser para essa URL (link `<a>`, nunca `fetch`) envia o cookie httpOnly
 * de sessão automaticamente por ser uma requisição de primeira parte para o
 * domínio da API (SPEC-03/SPEC-04, download autenticado).
 */
export function attachmentDownloadUrl(relativeUrl: string): string {
  return `${API_BASE_URL}${relativeUrl}`;
}

/**
 * Identifica o usuário referenciado (`createdById`/`assignedToId`) de forma
 * amigável: "Você" quando é a sessão atual, "Não atribuído" quando `null`
 * (só faz sentido para `assignedToId`), senão o próprio ID.
 *
 * NOTA (limitação conhecida, documentada desde a SPEC-07): `TicketResponse`
 * (`apps/api/src/tickets/types/ticket-response.type.ts`, SPEC-03) só expõe
 * o ID do solicitante/agente responsável, sem nome — não existe endpoint de
 * listagem de usuários no backend (fora de escopo criar um nas SPECs
 * 07/08). O ID bruto é exibido como alternativa mínima em vez de inventar
 * um contrato novo. Compartilhado entre a tela de detalhe (SPEC-07) e o
 * painel do agente (SPEC-08) em vez de duplicado.
 */
export function formatUserRef(
  id: string | null,
  currentUserId: string | undefined,
): string {
  if (!id) return '—';
  if (id === currentUserId) return 'Você';
  return id;
}

/**
 * Formata bytes em uma unidade legível (KB/MB), para listas de anexo
 * (ticket e comentário — SPEC-09, seção 7: compartilhado em vez de
 * duplicado entre `AttachmentsCard` e `CommentThread`).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
